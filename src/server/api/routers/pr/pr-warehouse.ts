/**
 * PR Warehouse Router - Receive Goods Management
 */
import { z } from "zod";
import { createTRPCRouter, createTableProcedure } from "~/server/api/trpc";
import { createAuditLog, AuditAction, getIpFromContext } from "~/server/api/utils/auditLog";
import { sendTelegramMessageToUser } from "~/server/services/telegram";
import { updateKpiReceiveSummary } from "~/server/kpi-receive-aggregator";

export const prWarehouseRouter = createTRPCRouter({
  // 🔹 บันทึกการรับของ (สามารถรับหลายรายการพร้อมกัน)
  saveReceiveGoods: createTableProcedure('receive_good', 'create')
    .input(z.object({
      prDocNum: z.number(),
      items: z.array(z.object({
        prLineId: z.number(),
        lineNum: z.number(),
        itemCode: z.string().nullable(),
        description: z.string().nullable(),
        originalQty: z.number(),
        receivedQty: z.number(),
        unitMsr: z.string().nullable(),
      })),
      receivedBy: z.string(),
      receivedByUserId: z.string().optional(),
      remarks: z.string().optional(),
      batchKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { prDocNum, items, receivedBy, receivedByUserId, remarks, batchKey } = input;

      // Filter only items that are actually being received (receivedQty > 0)
      const itemsToSave = items.filter(item => item.receivedQty > 0);

      if (itemsToSave.length === 0) {
        throw new Error("ไม่มีรายการที่ต้องบันทึก");
      }

      // Validate quantities
      for (const item of itemsToSave) {
        // Get total already received for this line
        const existingReceived = await ctx.db.$queryRawUnsafe<[{ total: number }]>(`
          SELECT COALESCE(SUM(received_qty), 0)::FLOAT as total
          FROM warehouse_receivegood
          WHERE pr_line_id = $1
        `, item.prLineId);

        const totalAlreadyReceived = existingReceived[0]?.total || 0;
        const remainingQty = item.originalQty - totalAlreadyReceived;

        if (item.receivedQty > remainingQty) {
          throw new Error(`รายการ "${item.description}" รับได้ไม่เกิน ${remainingQty} (รับไปแล้ว ${totalAlreadyReceived})`);
        }
      }

      // Insert records
      const results = await Promise.all(
        itemsToSave.map(item =>
          ctx.db.warehouse_receivegood.create({
            data: {
              pr_doc_num: prDocNum,
              pr_line_id: item.prLineId,
              line_num: item.lineNum,
              item_code: item.itemCode,
              description: item.description,
              original_qty: item.originalQty,
              received_qty: item.receivedQty,
              unit_msr: item.unitMsr,
              received_by: receivedBy,
              received_by_user_id: receivedByUserId || null,
              remarks: remarks || null,
              batch_key: batchKey || null,
            }
          })
        )
      );

      // Audit log: Create receive goods
      createAuditLog(ctx.db, {
        userId: receivedByUserId,
        userName: receivedBy,
        action: AuditAction.CREATE,
        tableName: "warehouse_receivegood",
        recordId: batchKey || String(prDocNum),
        prNo: prDocNum,
        newValues: {
          itemCount: results.length,
          items: itemsToSave.map(i => ({ lineNum: i.lineNum, qty: i.receivedQty })),
        },
        description: `รับของ PR #${prDocNum} จำนวน ${results.length} รายการ`,
        metadata: { batchKey },
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      // 🔔 Notification: แจ้งผู้เปิด PR ว่าของพร้อมรับแล้ว
      try {
        // ดึงข้อมูล PR
        const prMaster = await ctx.db.pr_master.findUnique({
          where: { doc_num: prDocNum },
          select: { req_name: true, job_name: true },
        });

        if (prMaster?.req_name) {
          // หา user จาก linked_req_name
          const requesterUser = await ctx.db.user_production.findFirst({
            where: {
              linked_req_name: prMaster.req_name,
              isActive: true,
            },
            select: { id: true, name: true, telegramChatId: true },
          });

          if (requesterUser) {
            // 1. สร้าง In-App Notification (สำหรับ TopBar)
            await ctx.db.user_notification.create({
              data: {
                user_id: requesterUser.id,
                type: 'goods_ready',
                title: `PR #${prDocNum} - ของพร้อมรับแล้ว`,
                message: `Warehouse รับของเข้าคลังแล้ว${prMaster.job_name ? ` (${prMaster.job_name})` : ''} กรุณามารับของ`,
                pr_doc_num: prDocNum,
                is_read: false,
              },
            });

            // 2. ส่ง Telegram (ถ้ามี telegramChatId)
            if (requesterUser.telegramChatId) {
              const now = new Date();
              const telegramMessage = `📦 <b>แจ้งเตือน: ของพร้อมรับแล้ว</b>

PR #${prDocNum}
${prMaster.job_name ? `🏗️ โครงการ: ${prMaster.job_name}` : ''}
✅ สถานะ: Warehouse รับของเข้าคลังแล้ว
👤 รับโดย: ${receivedBy}
🕐 เวลา: ${now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

กรุณามารับของที่ Warehouse`;

              sendTelegramMessageToUser(requesterUser.telegramChatId, telegramMessage)
                .catch(err => console.error('[Notification] Telegram send failed:', err));
            }
          }
        }
      } catch (notifyError) {
        // Log error แต่ไม่ fail การบันทึก
        console.error('[Notification] Failed to send goods ready notification:', notifyError);
      }

      return {
        success: true,
        savedCount: results.length,
        message: `บันทึกการรับของ ${results.length} รายการสำเร็จ`,
      };
    }),

  // 🔹 ดึงข้อมูลการรับของทั้งหมดของ PR (สำหรับหน้า receive-good list)
  getReceivedByPR: createTableProcedure('receive_good', 'read')
    .input(z.object({
      prDocNum: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.warehouse_receivegood.findMany({
        where: { pr_doc_num: input.prDocNum },
        orderBy: [
          { line_num: 'asc' },
          { received_at: 'desc' },
        ],
      });

      return records;
    }),

  // 🔹 ดึงจำนวนที่รับไปแล้วของแต่ละ line (สำหรับ form รับของ)
  getReceivedQtyByLines: createTableProcedure('receive_good', 'read')
    .input(z.object({
      prDocNum: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const results = await ctx.db.$queryRawUnsafe<Array<{
        pr_line_id: number;
        line_num: number;
        total_received: number;
      }>>(`
        SELECT
          pr_line_id,
          line_num,
          SUM(received_qty)::FLOAT as total_received
        FROM warehouse_receivegood
        WHERE pr_doc_num = $1
        GROUP BY pr_line_id, line_num
      `, input.prDocNum);

      // Convert to map for easy lookup
      const receivedMap: Record<number, number> = {};
      results.forEach(r => {
        receivedMap[r.pr_line_id] = r.total_received;
      });

      return receivedMap;
    }),

  // 🔹 ดึงรายการรับของทั้งหมด (สำหรับหน้า /receive-good)
  getAllReceived: createTableProcedure('receive_good', 'read')
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { search, limit } = input;

      let whereClause = '';
      const params: any[] = [];

      if (search) {
        whereClause = `WHERE
          w.pr_doc_num::TEXT ILIKE $1 OR
          w.item_code ILIKE $1 OR
          w.description ILIKE $1 OR
          w.received_by ILIKE $1 OR
          m.req_name ILIKE $1 OR
          m.job_name ILIKE $1`;
        params.push(`%${search}%`);
      }

      const query = `
        SELECT
          w.*,
          m.req_name,
          m.job_name,
          m.doc_date as pr_date
        FROM warehouse_receivegood w
        LEFT JOIN pr_master m ON w.pr_doc_num = m.doc_num
        ${whereClause}
        ORDER BY w.received_at DESC
        LIMIT ${limit}
      `;

      const records = search
        ? await ctx.db.$queryRawUnsafe(query, ...params)
        : await ctx.db.$queryRawUnsafe(query);

      return records as any[];
    }),

  // 🔹 ลบการบันทึกรับของ (Admin only)
  deleteReceived: createTableProcedure('receive_good', 'delete')
    .input(z.object({
      id: z.number(),
      deletedBy: z.string(),
      deletedByUserId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, deletedBy, deletedByUserId } = input;

      // Get record first for logging
      const record = await ctx.db.warehouse_receivegood.findUnique({
        where: { id },
      });

      if (!record) {
        throw new Error("ไม่พบรายการที่ต้องการลบ");
      }

      // Delete the record
      await ctx.db.warehouse_receivegood.delete({
        where: { id },
      });

      // Audit log: Delete receive goods
      createAuditLog(ctx.db, {
        userId: deletedByUserId,
        userName: deletedBy,
        action: AuditAction.DELETE,
        tableName: "warehouse_receivegood",
        recordId: String(id),
        prNo: record.pr_doc_num,
        oldValues: {
          lineNum: record.line_num,
          itemCode: record.item_code,
          description: record.description,
          receivedQty: record.received_qty,
        },
        description: `ลบรายการรับของ PR #${record.pr_doc_num} Line ${record.line_num}`,
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      return {
        success: true,
        message: `ลบรายการ PR #${record.pr_doc_num} Line ${record.line_num} สำเร็จ`,
        deletedRecord: record,
      };
    }),

  // 🔹 ลบการบันทึกรับของหลายรายการ (Admin only)
  deleteMultipleReceived: createTableProcedure('receive_good', 'delete')
    .input(z.object({
      ids: z.array(z.number()),
      deletedBy: z.string(),
      deletedByUserId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ids, deletedBy, deletedByUserId } = input;

      const result = await ctx.db.warehouse_receivegood.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      // Audit log: Delete multiple receive goods
      createAuditLog(ctx.db, {
        userId: deletedByUserId,
        userName: deletedBy,
        action: AuditAction.DELETE,
        tableName: "warehouse_receivegood",
        oldValues: { deletedIds: ids },
        description: `ลบรายการรับของหลายรายการ จำนวน ${result.count} รายการ`,
        metadata: { deletedCount: result.count },
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      return {
        success: true,
        deletedCount: result.count,
        message: `ลบรายการ ${result.count} รายการสำเร็จ`,
      };
    }),

  // 🔹 ดึงไฟล์แนบตาม batch_key
  getAttachmentsByBatch: createTableProcedure('receive_good', 'read')
    .input(z.object({
      batchKey: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const attachments = await ctx.db.warehouse_receive_attachment.findMany({
        where: { batch_key: input.batchKey },
        orderBy: { uploaded_at: 'desc' },
      });

      return attachments;
    }),

  // 🔹 ดึงไฟล์แนบทั้งหมดของ PR
  getAttachmentsByPR: createTableProcedure('receive_good', 'read')
    .input(z.object({
      prDocNum: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const attachments = await ctx.db.warehouse_receive_attachment.findMany({
        where: { pr_doc_num: input.prDocNum },
        orderBy: { uploaded_at: 'desc' },
      });

      return attachments;
    }),

  // 🔹 ลบไฟล์แนบ
  deleteAttachment: createTableProcedure('receive_attachment', 'delete')
    .input(z.object({
      id: z.number(),
      deletedBy: z.string().optional(),
      deletedByUserId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.warehouse_receive_attachment.findUnique({
        where: { id: input.id },
      });

      if (!attachment) {
        throw new Error("ไม่พบไฟล์ที่ต้องการลบ");
      }

      // Delete from database
      await ctx.db.warehouse_receive_attachment.delete({
        where: { id: input.id },
      });

      // Audit log: Delete attachment
      createAuditLog(ctx.db, {
        userId: input.deletedByUserId,
        userName: input.deletedBy,
        action: AuditAction.DELETE,
        tableName: "warehouse_receive_attachment",
        recordId: String(input.id),
        prNo: attachment.pr_doc_num || undefined,
        oldValues: {
          fileName: attachment.file_name,
          filePath: attachment.file_path,
        },
        description: `ลบไฟล์แนบ: ${attachment.file_name}`,
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      // Note: Physical file deletion is handled separately if needed

      return {
        success: true,
        message: `ลบไฟล์ ${attachment.file_name} สำเร็จ`,
      };
    }),

  // 🔹 ดึงรายการรับของตาม batch_key (สำหรับหน้า confirm)
  getReceivedByBatch: createTableProcedure('receive_good', 'read')
    .input(z.object({
      batchKey: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const query = `
        SELECT
          w.*,
          m.req_name,
          m.job_name,
          m.doc_date as pr_date
        FROM warehouse_receivegood w
        LEFT JOIN pr_master m ON w.pr_doc_num = m.doc_num
        WHERE w.batch_key = $1
        ORDER BY w.line_num ASC
      `;

      const records = await ctx.db.$queryRawUnsafe(query, input.batchKey);
      return records as any[];
    }),

  // 🔹 อัพเดทสถานะ confirm สำหรับหลายรายการ
  updateBatchConfirmStatus: createTableProcedure('receive_confirm', 'execute')
    .input(z.object({
      items: z.array(z.object({
        id: z.number(),
        confirm_status: z.enum(['waiting', 'confirmed', 'rejected']),
        confirm_remarks: z.string().optional(),
      })),
      confirmed_by: z.string(),
      confirmed_by_user_id: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, confirmed_by, confirmed_by_user_id } = input;
      const now = new Date();

      // Get existing records first (for KPI calculation)
      const existingRecords = await ctx.db.warehouse_receivegood.findMany({
        where: { id: { in: items.map(i => i.id) } },
        select: {
          id: true,
          pr_doc_num: true,
          batch_key: true,
          received_at: true,
          confirm_status: true,
        },
      });

      // Update each item
      const updates = items.map((item) =>
        ctx.db.warehouse_receivegood.update({
          where: { id: item.id },
          data: {
            confirm_status: item.confirm_status,
            confirm_remarks: item.confirm_status === 'rejected' ? item.confirm_remarks : null,
            confirmed_at: item.confirm_status !== 'waiting' ? now : null,
            confirmed_by: item.confirm_status !== 'waiting' ? confirmed_by : null,
            updated_at: now,
          },
        })
      );

      await Promise.all(updates);

      const confirmedCount = items.filter(i => i.confirm_status === 'confirmed').length;
      const rejectedCount = items.filter(i => i.confirm_status === 'rejected').length;

      // 🔹 KPI Tracking: บันทึก receive confirm KPI metric
      try {
        // Only record KPI for items that are being confirmed or rejected (not waiting)
        const itemsToTrack = items.filter(i => i.confirm_status !== 'waiting');

        if (itemsToTrack.length > 0) {
          // Get SLA config for receive confirm
          const slaConfig = await ctx.db.kpi_sla_config.findFirst({
            where: {
              kpi_type: 'receive_confirm',
              is_active: true,
            },
          });

          const slaTargetMinutes = slaConfig?.target_minutes ?? null;

          // Group by batch_key for KPI recording
          const batchMap = new Map<string, {
            prDocNum: number;
            receivedAt: Date;
            itemCount: number;
            confirmStatus: string;
          }>();

          for (const item of itemsToTrack) {
            const existingRecord = existingRecords.find(r => r.id === item.id);
            if (!existingRecord) continue;

            const batchKey = existingRecord.batch_key || `single-${existingRecord.id}`;

            if (!batchMap.has(batchKey)) {
              batchMap.set(batchKey, {
                prDocNum: existingRecord.pr_doc_num,
                receivedAt: existingRecord.received_at,
                itemCount: 0,
                confirmStatus: item.confirm_status,
              });
            }

            const batch = batchMap.get(batchKey)!;
            batch.itemCount++;
            // If any item is rejected, mark batch as rejected
            if (item.confirm_status === 'rejected') {
              batch.confirmStatus = 'rejected';
            }
          }

          // Insert KPI metric for each batch
          for (const [batchKey, batch] of batchMap) {
            const durationSeconds = Math.floor((now.getTime() - new Date(batch.receivedAt).getTime()) / 1000);
            const durationMinutes = durationSeconds / 60;
            const isOnTime = slaTargetMinutes !== null ? durationMinutes <= slaTargetMinutes : null;

            await ctx.db.receive_confirm_kpi_metric.create({
              data: {
                pr_doc_num: batch.prDocNum,
                batch_key: batchKey,
                user_id: confirmed_by_user_id || 'unknown',
                user_name: confirmed_by,
                received_at: batch.receivedAt,
                confirmed_at: now,
                duration_seconds: durationSeconds,
                duration_minutes: durationMinutes,
                sla_target_minutes: slaTargetMinutes,
                is_on_time: isOnTime,
                confirm_status: batch.confirmStatus,
                items_count: batch.itemCount,
              },
            });

            // Update pre-aggregated summary tables
            updateKpiReceiveSummary({
              userId: confirmed_by_user_id || 'unknown',
              userName: confirmed_by,
              confirmedAt: now,
              durationMinutes,
              isOnTime,
              confirmStatus: batch.confirmStatus as 'confirmed' | 'rejected',
            }).catch(console.error);
          }
        }
      } catch (kpiError) {
        // Log error but don't fail the confirm operation
        console.error('[KPI] Failed to record receive confirm KPI metric:', kpiError);
      }

      // 🔔 Notification: ลบ notification เมื่อผู้เปิด PR confirm รับของแล้ว
      try {
        // หา PR numbers ที่ถูก confirm ในครั้งนี้
        const confirmedPRDocNums = [...new Set(
          existingRecords
            .filter(r => items.some(i => i.id === r.id && i.confirm_status === 'confirmed'))
            .map(r => r.pr_doc_num)
        )];

        for (const prDocNum of confirmedPRDocNums) {
          // ดึงข้อมูล PR
          const prMaster = await ctx.db.pr_master.findUnique({
            where: { doc_num: prDocNum },
            select: { req_name: true },
          });

          if (!prMaster?.req_name) continue;

          // หา user จาก linked_req_name
          const requesterUser = await ctx.db.user_production.findFirst({
            where: {
              linked_req_name: prMaster.req_name,
              isActive: true,
            },
            select: { id: true },
          });

          if (!requesterUser) continue;

          // ลบ notification ของ goods_ready สำหรับ PR นี้
          await ctx.db.user_notification.deleteMany({
            where: {
              user_id: requesterUser.id,
              type: 'goods_ready',
              pr_doc_num: prDocNum,
            },
          });
        }
      } catch (notifyError) {
        // Log error แต่ไม่ fail การ confirm
        console.error('[Notification] Failed to delete goods ready notification:', notifyError);
      }

      // Audit log: Update batch confirm status
      createAuditLog(ctx.db, {
        userId: confirmed_by_user_id,
        userName: confirmed_by,
        action: AuditAction.UPDATE,
        tableName: "warehouse_receivegood",
        newValues: {
          confirmedCount,
          rejectedCount,
          items: items.map(i => ({ id: i.id, status: i.confirm_status })),
        },
        description: `ยืนยันการรับของ: ${confirmedCount} รายการยืนยัน, ${rejectedCount} รายการปฏิเสธ`,
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      return {
        success: true,
        message: `บันทึกสำเร็จ: ${confirmedCount} รายการยืนยัน, ${rejectedCount} รายการปฏิเสธ`,
        confirmedCount,
        rejectedCount,
      };
    }),
});
