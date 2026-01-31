/**
 * PR Warehouse Router - Receive Goods Management
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const prWarehouseRouter = createTRPCRouter({
  // 🔹 บันทึกการรับของ (สามารถรับหลายรายการพร้อมกัน)
  saveReceiveGoods: publicProcedure
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

      return {
        success: true,
        savedCount: results.length,
        message: `บันทึกการรับของ ${results.length} รายการสำเร็จ`,
      };
    }),

  // 🔹 ดึงข้อมูลการรับของทั้งหมดของ PR (สำหรับหน้า receive-good list)
  getReceivedByPR: publicProcedure
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
  getReceivedQtyByLines: publicProcedure
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
  getAllReceived: publicProcedure
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
  deleteReceived: publicProcedure
    .input(z.object({
      id: z.number(),
      deletedBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, deletedBy } = input;

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

      return {
        success: true,
        message: `ลบรายการ PR #${record.pr_doc_num} Line ${record.line_num} สำเร็จ`,
        deletedRecord: record,
      };
    }),

  // 🔹 ลบการบันทึกรับของหลายรายการ (Admin only)
  deleteMultipleReceived: publicProcedure
    .input(z.object({
      ids: z.array(z.number()),
      deletedBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ids, deletedBy } = input;

      const result = await ctx.db.warehouse_receivegood.deleteMany({
        where: {
          id: { in: ids },
        },
      });

      return {
        success: true,
        deletedCount: result.count,
        message: `ลบรายการ ${result.count} รายการสำเร็จ`,
      };
    }),

  // 🔹 ดึงไฟล์แนบตาม batch_key
  getAttachmentsByBatch: publicProcedure
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
  getAttachmentsByPR: publicProcedure
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
  deleteAttachment: publicProcedure
    .input(z.object({
      id: z.number(),
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

      // Note: Physical file deletion is handled separately if needed

      return {
        success: true,
        message: `ลบไฟล์ ${attachment.file_name} สำเร็จ`,
      };
    }),

  // 🔹 ดึงรายการรับของตาม batch_key (สำหรับหน้า confirm)
  getReceivedByBatch: publicProcedure
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
  updateBatchConfirmStatus: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.number(),
        confirm_status: z.enum(['waiting', 'confirmed', 'rejected']),
        confirm_remarks: z.string().optional(),
      })),
      confirmed_by: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, confirmed_by } = input;
      const now = new Date();

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

      return {
        success: true,
        message: `บันทึกสำเร็จ: ${confirmedCount} รายการยืนยัน, ${rejectedCount} รายการปฏิเสธ`,
        confirmedCount,
        rejectedCount,
      };
    }),
});
