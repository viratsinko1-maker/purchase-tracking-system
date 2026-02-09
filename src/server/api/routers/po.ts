import { z } from "zod";
import sql from "mssql";
import {
  createTRPCRouter,
  createTableProcedure,
} from "~/server/api/trpc";
import { notifyPODeliveryTracking } from "~/server/services/telegram";

// SQL Server configuration (SAP B1)
const sqlConfig = {
  server: '10.1.1.199',
  database: 'TMK_PRD',
  user: 'powerquery_hq',
  password: '@Tmk963*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

/**
 * PO Router สำหรับ PO Tracking System
 * ใช้ raw SQL queries กับ schema (po_master, po_lines, mv_po_summary)
 */
export const poRouter = createTRPCRouter({

  // 🔹 1. ดึงสรุป PO ทั้งหมดจาก Materialized View
  getAllSummary: createTableProcedure('po_tracking', 'read')
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, dateFrom, dateTo } = input;

      // สร้าง WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        // ค้นหาทั้งเลข PO และเลข PR ที่เชื่อมกับ PO นี้
        conditions.push(`(
          doc_num::TEXT ILIKE $${paramIndex} OR
          ARRAY_TO_STRING(pr_numbers, ',') ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        conditions.push(`doc_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // Query จาก Materialized View
      const query = `
        SELECT
          doc_num, doc_date, doc_due_date, doc_status, update_date,
          create_date, req_date, cancel_date, canceled, total_lines, total_quantity, pr_numbers
        FROM mv_po_summary
        ${whereClause}
        ORDER BY doc_num DESC
        LIMIT 500
      `;

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      return {
        success: true,
        data,
        count: data.length,
      };
    }),

  // 🔹 2. ดึงสถิติ PO
  getStats: createTableProcedure('po_tracking', 'read')
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, dateFrom, dateTo } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        // ค้นหาทั้งเลข PO และเลข PR ที่เชื่อมกับ PO นี้
        conditions.push(`(
          doc_num::TEXT ILIKE $${paramIndex} OR
          ARRAY_TO_STRING(pr_numbers, ',') ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        conditions.push(`doc_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const query = `
        SELECT
          COUNT(*) as total_po,
          COUNT(*) FILTER (WHERE doc_status = 'O') as open_po,
          COUNT(*) FILTER (WHERE doc_status = 'C') as closed_po
        FROM mv_po_summary
        ${whereClause}
      `;

      const stats = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      return {
        total_po: Number(stats[0]?.total_po || 0),
        open_po: Number(stats[0]?.open_po || 0),
        closed_po: Number(stats[0]?.closed_po || 0),
      };
    }),

  // 🔹 3. ดึงรายละเอียด PO พร้อม lines
  getDetail: createTableProcedure('po_tracking', 'read')
    .input(z.object({ poNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const { poNo } = input;

      // ดึงข้อมูล PO master
      const poMaster = await ctx.db.$queryRawUnsafe(`
        SELECT
          doc_num, doc_date, doc_due_date, doc_status, update_date,
          create_date, req_date, cancel_date, canceled
        FROM po_master
        WHERE doc_num = $1
      `, poNo) as any[];

      if (poMaster.length === 0) {
        throw new Error('PO not found');
      }

      // ดึงข้อมูล PO lines
      const poLines = await ctx.db.$queryRawUnsafe(`
        SELECT
          id, line_num, item_code, description, quantity,
          line_status, base_ref
        FROM po_lines
        WHERE po_doc_num = $1
        ORDER BY line_num ASC
      `, poNo) as any[];

      return {
        success: true,
        po: poMaster[0],
        lines: poLines,
      };
    }),

  // 🔹 4. ดึงประวัติ Sync
  getSyncHistory: createTableProcedure('admin_sync_po', 'read')
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`DATE(sync_date) >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`DATE(sync_date) <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const query = `
        SELECT
          id, sync_date, sync_type, records_synced, duration_seconds, status, error_message
        FROM po_sync_log
        ${whereClause}
        ORDER BY sync_date DESC
        LIMIT 100
      `;

      const sessions = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      return {
        success: true,
        sessions,
      };
    }),

  // 🔹 5. Sync ข้อมูลจาก SAP (Full Sync Only)
  sync: createTableProcedure('po_tracking', 'sync').mutation(async ({ ctx }) => {
    let sqlPool: sql.ConnectionPool | null = null;
    const syncStartTime = new Date();

    try {
      console.log(`[PO SYNC] Starting FULL sync...`);

      // เชื่อมต่อ SAP B1
      sqlPool = await sql.connect(sqlConfig);

      // Query จาก SAP (รวม PO ที่ถูก CANCELED ด้วย)
      const query = `
        SELECT
          T0.[DocNum], T0.[DocDate], T0.[DocDueDate], T1.[ItemCode], T1.[Dscription],
          T1.[Quantity], T0.[DocStatus], T0.[UpdateDate], T0.[CreateDate],
          T0.[ReqDate], T0.[CancelDate], T0.[CANCELED], T1.[LineStatus], T1.[BaseRef], T1.[BaseLine], T1.[LineNum]
        FROM
          OPOR T0
          INNER JOIN POR1 T1 ON T0.[DocEntry] = T1.[DocEntry]
        ORDER BY
          T0.[DocNum]
      `;

      const result = await sqlPool.request().query(query);
      const sapData = result.recordset;

      console.log(`[PO SYNC] Fetched ${sapData.length} records from SAP`);

      // จัดกลุ่มข้อมูล
      const poMap = new Map();

      sapData.forEach((row: any) => {
        const docNum = row.DocNum;

        if (!poMap.has(docNum)) {
          poMap.set(docNum, {
            doc_num: docNum,
            doc_date: row.DocDate,
            doc_due_date: row.DocDueDate,
            doc_status: row.DocStatus,
            update_date: row.UpdateDate,
            create_date: row.CreateDate,
            req_date: row.ReqDate,
            cancel_date: row.CancelDate,
            canceled: row.CANCELED,
            lines: [],
          });
        }

        poMap.get(docNum).lines.push({
          line_num: row.LineNum || 0,
          item_code: row.ItemCode,
          description: row.Dscription,
          quantity: row.Quantity,
          line_status: row.LineStatus,
          base_ref: row.BaseRef ? parseInt(row.BaseRef) : null,
          base_line: row.BaseLine != null ? parseInt(row.BaseLine) : null,
        });
      });

      // บันทึกลง PostgreSQL
      let poCount = 0;
      let lineCount = 0;

      for (const [docNum, poData] of poMap.entries()) {
        // Upsert po_master
        await ctx.db.$executeRawUnsafe(`
          INSERT INTO po_master (
            doc_num, doc_date, doc_due_date, doc_status, update_date,
            create_date, req_date, cancel_date, canceled, last_sync_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (doc_num) DO UPDATE SET
            doc_date = EXCLUDED.doc_date,
            doc_due_date = EXCLUDED.doc_due_date,
            doc_status = EXCLUDED.doc_status,
            update_date = EXCLUDED.update_date,
            create_date = EXCLUDED.create_date,
            req_date = EXCLUDED.req_date,
            cancel_date = EXCLUDED.cancel_date,
            canceled = EXCLUDED.canceled,
            last_sync_date = NOW()
        `,
          poData.doc_num,
          poData.doc_date,
          poData.doc_due_date,
          poData.doc_status,
          poData.update_date,
          poData.create_date,
          poData.req_date,
          poData.cancel_date,
          poData.canceled
        );
        poCount++;

        // Upsert po_lines
        for (const line of poData.lines) {
          await ctx.db.$executeRawUnsafe(`
            INSERT INTO po_lines (
              po_doc_num, line_num, item_code, description, quantity,
              line_status, base_ref, base_line, last_sync_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (po_doc_num, line_num, description) DO UPDATE SET
              item_code = EXCLUDED.item_code,
              quantity = EXCLUDED.quantity,
              line_status = EXCLUDED.line_status,
              base_ref = EXCLUDED.base_ref,
              base_line = EXCLUDED.base_line,
              last_sync_date = NOW()
          `,
            docNum,
            line.line_num,
            line.item_code,
            line.description,
            line.quantity,
            line.line_status,
            line.base_ref,
            line.base_line
          );
          lineCount++;
        }
      }

      // Refresh materialized view
      console.log('[PO SYNC] Refreshing materialized view...');
      await ctx.db.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_po_summary');

      // หมายเหตุ: PO Attachments จะถูก sync โดย Attachment-Sync Scheduler แยกต่างหาก (ทุก 2 ชม. ที่ :30)

      const syncEndTime = new Date();
      const durationSeconds = (syncEndTime.getTime() - syncStartTime.getTime()) / 1000;

      // บันทึก sync log
      await ctx.db.$executeRawUnsafe(`
        INSERT INTO po_sync_log (
          sync_date, sync_type, records_synced, duration_seconds, status
        ) VALUES (NOW(), 'FULL', $1, $2, 'success')
      `, poCount + lineCount, durationSeconds);

      console.log(`[PO SYNC] ✅ Completed: ${poCount} POs, ${lineCount} lines in ${durationSeconds.toFixed(2)}s`);

      return {
        success: true,
        message: 'PO sync completed successfully',
        po_count: poCount,
        line_count: lineCount,
        duration_seconds: durationSeconds,
      };

    } catch (error: any) {
      console.error('[PO SYNC] ❌ Error:', error);

      // บันทึก error log
      await ctx.db.$executeRawUnsafe(`
        INSERT INTO po_sync_log (
          sync_date, sync_type, status, error_message
        ) VALUES (NOW(), 'FULL', 'failed', $1)
      `, error.message);

      throw new Error(`PO sync failed: ${error.message}`);
    } finally {
      if (sqlPool) {
        await sqlPool.close();
      }
    }
  }),

  // 🔹 6. บันทึกการติดตามการส่งของ PO
  createDeliveryTracking: createTableProcedure('po_delivery', 'create')
    .input(z.object({
      poNo: z.number(),
      deliveryStatus: z.enum(['ปกติ', 'ไม่ปกติ', 'อื่นๆ']),
      note: z.string().optional(),
      trackedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tracking = await ctx.db.$executeRawUnsafe<Array<{ id: number }>>(`
        INSERT INTO po_delivery_tracking_log (
          po_doc_num, delivery_status, note, tracked_by
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, tracked_at
      `, input.poNo, input.deliveryStatus, input.note || null, input.trackedBy || null);

      // ดึงข้อมูล PO เพื่อส่ง Telegram notification
      try {
        const poData = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          doc_date: Date | string | null;
          doc_due_date: Date | string | null;
          doc_status: string;
        }>>(`
          SELECT doc_num, doc_date, doc_due_date, doc_status
          FROM po_master
          WHERE doc_num = $1
        `, input.poNo);

        // ดึง PR numbers ที่เชื่อมกับ PO นี้
        const prNumbers = await ctx.db.$queryRawUnsafe<Array<{ base_ref: number | null }>>(`
          SELECT DISTINCT base_ref
          FROM po_lines
          WHERE po_doc_num = $1 AND base_ref IS NOT NULL
        `, input.poNo);

        if (poData && poData.length > 0) {
          const po = poData[0];
          const prNumbersArray = prNumbers
            .map(pr => pr.base_ref)
            .filter((num): num is number => num !== null);

          // ส่ง Telegram notification
          await notifyPODeliveryTracking({
            poNo: input.poNo,
            docDate: po?.doc_date || null,
            docDueDate: po?.doc_due_date || null,
            docStatus: po?.doc_status || '',
            prNumbers: prNumbersArray.length > 0 ? prNumbersArray : null,
            deliveryStatus: input.deliveryStatus,
            note: input.note || null,
            trackedBy: input.trackedBy || null,
            trackedAt: new Date(), // ใช้เวลาปัจจุบัน
          });
        }
      } catch (error) {
        console.error('[createDeliveryTracking] Failed to send Telegram notification:', error);
        // ไม่ throw error เพื่อไม่ให้การบันทึก tracking ล้มเหลว
      }

      return { success: true };
    }),

  // 🔹 7. ดึงประวัติการติดตามการส่งของ PO
  getDeliveryTrackingHistory: createTableProcedure('po_tracking', 'read')
    .input(z.object({ poNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.$queryRawUnsafe(`
        SELECT
          id, po_doc_num, delivery_status, note, tracked_by, tracked_at
        FROM po_delivery_tracking_log
        WHERE po_doc_num = $1
        ORDER BY tracked_at DESC
      `, input.poNo) as any[];

      return history;
    }),

  // 🔹 8. ดึงการติดตามล่าสุดของ PO แต่ละใบ (สำหรับแสดงใน card)
  getLatestDeliveryTrackings: createTableProcedure('po_tracking', 'read')
    .input(z.object({ poNumbers: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      if (input.poNumbers.length === 0) {
        return new Map();
      }

      const trackings = await ctx.db.$queryRawUnsafe<Array<{
        po_doc_num: number;
        delivery_status: string;
        note: string | null;
        tracked_at: Date;
        tracked_by: string | null;
      }>>(`
        SELECT DISTINCT ON (po_doc_num)
          po_doc_num,
          delivery_status,
          note,
          tracked_at,
          tracked_by
        FROM po_delivery_tracking_log
        WHERE po_doc_num = ANY($1::int[])
        ORDER BY po_doc_num, tracked_at DESC
      `, input.poNumbers);

      // สร้าง Map สำหรับค้นหาง่าย
      const trackingMap = new Map();
      trackings.forEach(tracking => {
        trackingMap.set(tracking.po_doc_num, tracking);
      });

      return trackingMap;
    }),

  // 🔹 9. ดึงไฟล์แนบของ PO
  getPOAttachments: createTableProcedure('po_tracking', 'read')
    .input(z.object({
      poNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const attachments = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        po_doc_num: number;
        attachment_entry: number;
        file_name: string;
        src_path: string | null;
        trgt_path: string | null;
        file_ext: string | null;
        created_at: Date;
        uploaded_date: Date | null;
      }>>(`
        SELECT
          id,
          po_doc_num,
          attachment_entry,
          file_name,
          src_path,
          trgt_path,
          file_ext,
          created_at,
          uploaded_date
        FROM po_attachments
        WHERE po_doc_num = $1
        ORDER BY created_at DESC
      `, input.poNo);

      return attachments;
    }),
});
