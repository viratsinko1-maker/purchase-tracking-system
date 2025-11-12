import { z } from "zod";
import sql from "mssql";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { notifyPRTracking, notifyPRTrackingResponse } from "~/server/services/telegram";
import { getClientIp } from "~/server/utils/getClientIp";

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
 * PR Router สำหรับ Schema v2.0
 * ใช้ raw SQL queries กับ schema ใหม่ (pr_master, pr_lines, pr_po_link, mv_pr_summary)
 */
export const prRouter = createTRPCRouter({

  // 🔹 1. ดึงสรุป PR ทั้งหมดจาก Materialized View
  getAllSummary: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        series: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        onlyPending: z.boolean().optional(), // แสดงเฉพาะ PR ที่ยังไม่ครบ
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, series, dateFrom, dateTo, onlyPending } = input;

      // สร้าง WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        // ตรวจสอบว่าเป็น exact match หรือไม่ (ใช้ prefix EXACT:)
        if (search.startsWith('EXACT:')) {
          const exactValue = search.replace('EXACT:', '');
          conditions.push(`doc_num = $${paramIndex}::INTEGER`);
          params.push(exactValue);
          paramIndex++;
        } else if (search.startsWith('PRNUMS:')) {
          // ค้นหาโดยใช้ list ของ PR numbers (comma-separated)
          const prNumsStr = search.replace('PRNUMS:', '');
          const prNums = prNumsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          if (prNums.length > 0) {
            conditions.push(`doc_num = ANY($${paramIndex}::int[])`);
            params.push(prNums);
            paramIndex++;
          }
        } else {
          // Partial match (ปกติ)
          conditions.push(`(
            doc_num::TEXT ILIKE $${paramIndex} OR
            req_name ILIKE $${paramIndex} OR
            department_name ILIKE $${paramIndex} OR
            job_name ILIKE $${paramIndex}
          )`);
          params.push(`%${search}%`);
          paramIndex++;
        }
      }

      if (status) {
        conditions.push(`doc_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (series) {
        conditions.push(`series_name ILIKE $${paramIndex}`);
        params.push(`${series}%`);
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

      if (onlyPending) {
        conditions.push(`is_complete = FALSE AND doc_status = 'O'`);
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // Query จาก Materialized View
      const query = `
        SELECT
          doc_num, req_name, department_name, doc_date, doc_due_date,
          doc_status, series_name, update_date, job_name, remarks, total_lines, lines_with_po,
          pending_lines, is_complete, po_numbers, total_po_quantity
        FROM mv_pr_summary
        ${whereClause}
        ORDER BY doc_date DESC, doc_num DESC
      `;

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      // แปลง BigInt เป็น Number สำหรับ fields ที่เป็นตัวเลข
      const convertedData = data.map(row => ({
        ...row,
        total_lines: row.total_lines ? Number(row.total_lines) : 0,
        lines_with_po: row.lines_with_po ? Number(row.lines_with_po) : 0,
        pending_lines: row.pending_lines ? Number(row.pending_lines) : 0,
        total_po_quantity: row.total_po_quantity ? Number(row.total_po_quantity) : null,
      }));

      return {
        data: convertedData,
        total: convertedData.length,
      };
    }),

  // 🔹 2. ดึงรายละเอียด PR เฉพาะใบ (รวม Lines และ PO)
  getByPRNo: publicProcedure
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      // ดึงจาก view vw_pr_detail
      const data = await ctx.db.$queryRawUnsafe(`
        SELECT
          pr_doc_num, pr_req_name, pr_department, pr_date, pr_due_date,
          pr_status, pr_series, pr_update_date, pr_req_date, pr_job_name, pr_remarks,
          pr_line_id, pr_line_num, pr_item_code, pr_description, pr_quantity,
          pr_line_status, pr_project, pr_vendor, has_po,
          po_doc_num, po_due_date, po_description, po_quantity, po_unit, po_status
        FROM vw_pr_detail
        WHERE pr_doc_num = $1
        ORDER BY pr_line_num ASC
      `, input.prNo) as any[];

      if (data.length === 0) {
        return null;
      }

      // จัดกลุ่มข้อมูล
      const prInfo = {
        doc_num: data[0].pr_doc_num,
        req_name: data[0].pr_req_name,
        department: data[0].pr_department,
        date: data[0].pr_date,
        due_date: data[0].pr_due_date,
        status: data[0].pr_status,
        series: data[0].pr_series,
        update_date: data[0].pr_update_date,
        req_date: data[0].pr_req_date,
        job_name: data[0].pr_job_name,
        remarks: data[0].pr_remarks,
      };

      // จัดกลุ่ม lines และ PO
      const linesMap = new Map();
      data.forEach(row => {
        if (row.pr_line_id) {
          if (!linesMap.has(row.pr_line_id)) {
            linesMap.set(row.pr_line_id, {
              line_id: row.pr_line_id,
              line_num: row.pr_line_num,
              item_code: row.pr_item_code,
              description: row.pr_description,
              quantity: row.pr_quantity,
              line_status: row.pr_line_status,
              project: row.pr_project,
              vendor: row.pr_vendor,
              has_po: row.has_po,
              po_list: []
            });
          }

          // เพิ่ม PO (ถ้ามี)
          if (row.po_doc_num) {
            linesMap.get(row.pr_line_id).po_list.push({
              po_doc_num: row.po_doc_num,
              po_due_date: row.po_due_date,
              po_description: row.po_description,
              po_quantity: row.po_quantity,
              po_unit: row.po_unit,
              po_status: row.po_status,
            });
          }
        }
      });

      return {
        ...prInfo,
        lines: Array.from(linesMap.values())
      };
    }),

  // 🔹 3. ดึงสถิติต่างๆ (ตามช่วงวันที่)
  getStats: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        series: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        onlyPending: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, series, dateFrom, dateTo, onlyPending } = input;

      // สร้าง WHERE conditions เหมือนกับ getAllSummary
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        conditions.push(`(
          doc_num::TEXT ILIKE $${paramIndex} OR
          req_name ILIKE $${paramIndex} OR
          department_name ILIKE $${paramIndex} OR
          job_name ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        conditions.push(`doc_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (series) {
        conditions.push(`series_name ILIKE $${paramIndex}`);
        params.push(`${series}%`);
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

      if (onlyPending) {
        conditions.push(`is_complete = FALSE AND doc_status = 'O'`);
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // ดึงสถิติจาก mv_pr_summary ตาม filter
      const stats = await ctx.db.$queryRawUnsafe(`
        SELECT
          COUNT(*) as total_pr,
          COUNT(*) FILTER (WHERE doc_status = 'O') as open_pr,
          COUNT(*) FILTER (WHERE doc_status = 'C') as closed_pr,
          COUNT(*) FILTER (WHERE is_complete = FALSE AND doc_status = 'O') as pending_pr,
          SUM(total_lines) as total_lines,
          SUM(lines_with_po) as lines_with_po,
          SUM(pending_lines) as pending_lines
        FROM mv_pr_summary
        ${whereClause}
      `, ...params) as any[];

    // ดึง last sync
    const lastSync = await ctx.db.$queryRawUnsafe(`
      SELECT sync_date, status, records_processed, duration_seconds
      FROM sync_log
      ORDER BY sync_date DESC
      LIMIT 1
    `) as any[];

    return {
      total_pr: Number(stats[0]?.total_pr || 0),
      open_pr: Number(stats[0]?.open_pr || 0),
      closed_pr: Number(stats[0]?.closed_pr || 0),
      pending_pr: Number(stats[0]?.pending_pr || 0),
      total_lines: Number(stats[0]?.total_lines || 0),
      lines_with_po: Number(stats[0]?.lines_with_po || 0),
      pending_lines: Number(stats[0]?.pending_lines || 0),
      last_sync: lastSync[0] || null,
    };
  }),

  // 🔹 4. Sync ข้อมูลจาก SAP (Incremental Sync + PO Check + Full Sync ทุกวันอาทิตย์ 17:00)
  sync: publicProcedure
    .input(z.object({
      fullSync: z.boolean().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
    let sqlPool: sql.ConnectionPool | null = null;
    const syncStartTime = new Date();

    try {
      // ✅ STEP 0: ตรวจสอบว่าวันนี้มี Full Sync แล้วหรือยัง
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const fullSyncTodayResult = await ctx.db.$queryRawUnsafe(`
        SELECT sync_date, sync_type
        FROM sync_log
        WHERE status = 'success'
          AND sync_type = 'FULL'
          AND DATE(sync_date) = $1::DATE
        ORDER BY sync_date DESC
        LIMIT 1
      `, today) as any[];

      const hasFullSyncToday = fullSyncTodayResult.length > 0;

      // ดึง last_sync_date สำหรับ log และตรวจสอบ
      const lastSyncResult = await ctx.db.$queryRawUnsafe(`
        SELECT sync_date
        FROM sync_log
        WHERE status = 'success'
        ORDER BY sync_date DESC
        LIMIT 1
      `) as any[];

      const lastSyncDate = lastSyncResult[0]?.sync_date;

      // ถ้าวันนี้ยังไม่เคย Full Sync → บังคับให้ทำ Full Sync
      let isFullSync = false;
      let forceFullSyncWarning = false;

      // ถ้า input มีการบังคับให้ทำ fullSync
      if (input?.fullSync) {
        isFullSync = true;
        console.log(`[SYNC] 🔄 Manual Full Sync requested`);
      } else if (!hasFullSyncToday) {
        isFullSync = true;
        forceFullSyncWarning = true;
        console.log(`[SYNC] ⚠️  No Full Sync today - forcing FULL SYNC (may be slower than usual)`);
      } else {
        // มี Full Sync วันนี้แล้ว → ใช้ Incremental Sync
        isFullSync = false;
      }

      const syncType = isFullSync ? 'FULL' : 'INCREMENTAL';

      console.log(`[SYNC] Starting ${syncType} sync...`);
      if (lastSyncDate) {
        console.log(`[SYNC] Last sync: ${lastSyncDate}`);
      }

      // ✅ STEP 1: เชื่อมต่อ SQL Server
      sqlPool = await sql.connect(sqlConfig);

      // ✅ STEP 1.5: ถ้าเป็น Full Sync ให้ล้างข้อมูลเก่าก่อน
      if (isFullSync) {
        console.log('[SYNC] Full Sync - clearing tables first...');
        await ctx.db.$executeRaw`TRUNCATE TABLE pr_po_link CASCADE`;
        await ctx.db.$executeRaw`TRUNCATE TABLE pr_lines CASCADE`;
        await ctx.db.$executeRaw`TRUNCATE TABLE pr_master CASCADE`;
        console.log('[SYNC] Tables cleared successfully');
      }

      // ✅ STEP 2: สร้าง WHERE clause ตาม sync type
      let whereClause = "T2.[BeginStr] = 'PR'";

      if (!isFullSync && lastSyncDate) {
        // Incremental Sync: ใช้ DATE-ONLY comparison เพราะ SAP เก็บเวลาเป็นเที่ยงคืนเสมอ
        const lastSyncDateStr = new Date(lastSyncDate).toISOString().split('T')[0]; // YYYY-MM-DD only

        // 🔹 จับ PR ใหม่ (CreateDate), PR ที่อัพเดท (UpdateDate), หรือ PR ที่มี PO ใหม่
        // ใช้ CAST AS DATE เพื่อเปรียบเทียบวันที่เท่านั้น ไม่สนเวลา
        whereClause += ` AND (
          CAST(T0.[CreateDate] AS DATE) >= '${lastSyncDateStr}' OR
          CAST(T0.[UpdateDate] AS DATE) >= '${lastSyncDateStr}' OR
          EXISTS (
            SELECT 1
            FROM POR1 T3_SUB
            INNER JOIN OPOR T4_SUB ON T3_SUB.[DocEntry] = T4_SUB.[DocEntry]
            WHERE T3_SUB.[BaseRef] = T0.[DocNum]
              AND CAST(T4_SUB.[DocDate] AS DATE) >= '${lastSyncDateStr}'
          )
        )`;

        console.log(`[SYNC] Fetching records where: CreateDate/UpdateDate >= ${lastSyncDateStr} (DATE ONLY) OR NEW PO`);
      } else {
        console.log(`[SYNC] Fetching all records (Full Sync)`);
      }

      // ✅ STEP 3: ดึงข้อมูลจาก SAP
      const result = await sqlPool.request().query(`
        SELECT
            -- 🔹 ข้อมูลหัวเอกสาร PR
            T0.[DocNum]            AS "เลขที่ PR",
            T0.[ReqName]           AS "ชื่อผู้เปิด PR",
            T5.[Remarks]           AS "ชื่อหน่วยงานผู้เปิด PR",
            T0.[DocDate]           AS "วันที่เปิด PR",
            T0.[DocDueDate]        AS "วันที่ครบกำหนด PR",
            T0.[DocStatus]         AS "สถานะเอกสาร PR",
            T0.[UpdateDate]        AS "วันที่อัปเดตล่าสุด",
            T0.[CreateDate]        AS "วันที่สร้างเอกสาร",
            T0.[ReqDate]           AS "วันที่ต้องการของ",
            T0.[U_U_PR_FOR]        AS "ชื่องานที่ขอจัดซื้อ (U_U_PR_FOR)",
            T0.[U_U_PR_MAC]        AS "รหัสเครื่องจักร (U_U_PR_MAC)",
            T0.[Comments]          AS "หมายเหตุ PR",

            -- 🔹 รายละเอียดรายการใน PR
            T1.[LineNum]           AS "LineNum (PR)",
            T1.[ItemCode]          AS "รหัสสินค้า (PR)",
            T1.[Dscription]        AS "ชื่อสินค้า / รายการ (PR)",
            T1.[Quantity]          AS "จำนวนที่ขอ (PR)",
            T1.[LineStatus]        AS "สถานะรายการ (PR)",
            T1.[DocDate]           AS "วันที่รายการ (PR)",
            T1.[OcrCode],
            T1.[OcrCode2],
            T1.[OcrCode4],
            T1.[Project]           AS "รหัสโครงการ (PR)",
            T1.[VendorNum]         AS "รหัสผู้ขาย (PR)",
            T1.[SerialNum]         AS "Serial Number (PR)",

            -- 🔹 ข้อมูลเกี่ยวกับเอกสาร PR / Series
            T2.[Series],
            T2.[BeginStr]          AS "คำนำหน้าเอกสาร PR",

            -- 🔹 ข้อมูลที่เชื่อมโยงกับ PO
            T3.[BaseRef]           AS "เลขที่ PR ที่อ้างอิงใน PO",
            T4.[DocNum]            AS "เลขที่ PO",
            T4.[DocDate]           AS "วันที่สร้าง PO",
            T4.[DocDueDate]        AS "วันที่ครบกำหนด PO",
            T3.[Dscription]        AS "รายละเอียดสินค้า (PO)",
            T3.[Quantity]          AS "จำนวนใน PO",
            T3.[unitMsr]           AS "หน่วยใน PO",
            T3.[LineStatus]        AS "สถานะรายการ (PO)"

        FROM
            OPRQ T0
            INNER JOIN PRQ1 T1 ON T0.[DocEntry] = T1.[DocEntry]
            LEFT JOIN NNM1 T2 ON T0.[Series] = T2.[Series]
            LEFT JOIN POR1 T3
                ON (T0.[DocNum] = T3.[BaseRef] AND T1.[Dscription] = T3.[Dscription])
            LEFT JOIN OPOR T4 ON T3.[DocEntry] = T4.[DocEntry]
            LEFT JOIN OUDP T5 ON T0.[Department] = T5.[Code]

        WHERE
            ${whereClause}

        ORDER BY
            T0.[DocNum];
      `);

      const records = result.recordset;

      console.log(`[SYNC] Fetched ${records.length} records from SAP`);

      // ✅ STEP 4: แปลงข้อมูลเป็น JSON format
      const prMasterMap = new Map();
      const prLinesMap = new Map();
      const prPoLinksMap = new Map();
      const poInfoMap = new Map(); // 🆕 สำหรับเก็บข้อมูล PO (เลขที่ PO + วันที่ออก PO)

      records.forEach((record: any) => {
        const prDocNum = record['เลขที่ PR'];

        // PR Master
        if (!prMasterMap.has(prDocNum)) {
          prMasterMap.set(prDocNum, {
            doc_num: prDocNum,
            req_name: record['ชื่อผู้เปิด PR'],
            department_name: record['ชื่อหน่วยงานผู้เปิด PR'],
            doc_date: record['วันที่เปิด PR'] ? new Date(record['วันที่เปิด PR']).toISOString().split('T')[0] : null,
            doc_due_date: record['วันที่ครบกำหนด PR'] ? new Date(record['วันที่ครบกำหนด PR']).toISOString().split('T')[0] : null,
            doc_status: record['สถานะเอกสาร PR'],
            update_date: record['วันที่อัปเดตล่าสุด'] ? new Date(record['วันที่อัปเดตล่าสุด']).toISOString() : null,
            create_date: record['วันที่สร้างเอกสาร'] ? new Date(record['วันที่สร้างเอกสาร']).toISOString() : null,
            req_date: record['วันที่ต้องการของ'] ? new Date(record['วันที่ต้องการของ']).toISOString().split('T')[0] : null,
            job_name: record['ชื่องานที่ขอจัดซื้อ (U_U_PR_FOR)'],
            machine_code: record['รหัสเครื่องจักร (U_U_PR_MAC)'],
            remarks: record['หมายเหตุ PR'],
            series: record['Series'],
            series_name: record['คำนำหน้าเอกสาร PR']
          });
        }

        // PR Lines - ใช้ LineNum จาก SAP เป็น unique key
        const lineKey = `${prDocNum}-${record['LineNum (PR)']}`;
        if (!prLinesMap.has(lineKey)) {
          prLinesMap.set(lineKey, {
            pr_doc_num: prDocNum,
            line_num: record['LineNum (PR)'],
            item_code: record['รหัสสินค้า (PR)'],
            description: record['ชื่อสินค้า / รายการ (PR)'],
            quantity: record['จำนวนที่ขอ (PR)'],
            line_status: record['สถานะรายการ (PR)'],
            line_date: record['วันที่รายการ (PR)'] ? new Date(record['วันที่รายการ (PR)']).toISOString().split('T')[0] : null,
            ocr_code: record['OcrCode'],
            ocr_code2: record['OcrCode2'],
            ocr_code4: record['OcrCode4'],
            project: record['รหัสโครงการ (PR)'],
            vendor_num: record['รหัสผู้ขาย (PR)'],
            serial_num: record['Serial Number (PR)']
          });
        }

        // PO Links
        if (record['เลขที่ PO']) {
          const poKey = `${prDocNum}-${record['ชื่อสินค้า / รายการ (PR)']}-${record['เลขที่ PO']}`;
          if (!prPoLinksMap.has(poKey)) {
            prPoLinksMap.set(poKey, {
              pr_doc_num: prDocNum,
              pr_line_description: record['ชื่อสินค้า / รายการ (PR)'],
              po_doc_num: record['เลขที่ PO'],
              po_due_date: record['วันที่ครบกำหนด PO'] ? new Date(record['วันที่ครบกำหนด PO']).toISOString().split('T')[0] : null,
              po_line_description: record['รายละเอียดสินค้า (PO)'],
              po_quantity: record['จำนวนใน PO'],
              po_unit: record['หน่วยใน PO'],
              po_line_status: record['สถานะรายการ (PO)']
            });
          }

          // 🆕 เก็บข้อมูล PO Info (วันที่ออก PO)
          const poDocNum = record['เลขที่ PO'];
          if (!poInfoMap.has(poDocNum)) {
            poInfoMap.set(poDocNum, {
              po_doc_num: poDocNum,
              po_doc_date: record['วันที่สร้าง PO'] ? new Date(record['วันที่สร้าง PO']).toISOString().split('T')[0] : null,
              po_due_date: record['วันที่ครบกำหนด PO'] ? new Date(record['วันที่ครบกำหนด PO']).toISOString().split('T')[0] : null,
            });
          }
        }
      });

      // ใช้ line_num จาก SAP โดยตรง ไม่ต้อง generate ใหม่
      const jsonData = {
        pr_master: Array.from(prMasterMap.values()),
        pr_lines: Array.from(prLinesMap.values()),
        pr_po_links: Array.from(prPoLinksMap.values())
      };

      const poInfoList = Array.from(poInfoMap.values());
      console.log(`[SYNC] Processing ${jsonData.pr_master.length} PR masters, ${jsonData.pr_lines.length} lines, ${jsonData.pr_po_links.length} PO links, ${poInfoList.length} PO info`);

      // ✅ STEP 5: เรียก upsert_pr_data()
      const upsertResult = await ctx.db.$queryRawUnsafe(
        'SELECT * FROM upsert_pr_data($1::JSONB)',
        JSON.stringify(jsonData)
      ) as any[];

      // ✅ STEP 5.5: Sync ข้อมูล PO Info (วันที่ออก PO)
      let poInfoUpdated = 0;
      for (const poInfo of poInfoList) {
        if (poInfo.po_doc_date) {
          await ctx.db.po_info.upsert({
            where: { po_doc_num: poInfo.po_doc_num },
            update: {
              po_doc_date: new Date(poInfo.po_doc_date),
              po_due_date: poInfo.po_due_date ? new Date(poInfo.po_due_date) : null,
              updated_at: new Date(),
            },
            create: {
              po_doc_num: poInfo.po_doc_num,
              po_doc_date: new Date(poInfo.po_doc_date),
              po_due_date: poInfo.po_due_date ? new Date(poInfo.po_due_date) : null,
            },
          });
          poInfoUpdated++;
        }
      }
      console.log(`[SYNC] Updated ${poInfoUpdated} PO info records`);

      // ✅ STEP 6: Refresh Materialized View
      await ctx.db.$queryRawUnsafe('SELECT quick_refresh_view()');

      // ✅ STEP 7: คำนวณเวลาที่ใช้ และบันทึก sync log
      const syncEndTime = new Date();
      const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);

      // บันทึก sync log และดึง ID กลับมา
      const syncLogResult = await ctx.db.$queryRawUnsafe<{ id: number }[]>(`
        INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, syncEndTime, 'success', records.length, durationSeconds, syncType, null);

      const syncLogId = syncLogResult[0]?.id;

      console.log(`[SYNC] ✅ ${syncType} sync completed in ${durationSeconds}s`);
      console.log(`[SYNC] Updated: ${upsertResult[0].pr_master_updated} PRs, ${upsertResult[0].pr_lines_updated} lines, ${upsertResult[0].po_links_updated} PO links`);

      // Note: PR Attachments ถูก sync แยกโดย Attachment Scheduler (attachment-sync-scheduler.ts)

      // ✅ STEP 8: บันทึก change log (เฉพาะ Incremental Sync)
      if (syncLogId && syncType === 'INCREMENTAL' && jsonData.pr_master.length > 0) {
        console.log(`[SYNC] Recording ${jsonData.pr_master.length} changes to sync_change_log...`);

        // สำหรับแต่ละ PR ที่มีการเปลี่ยนแปลง
        for (const prMaster of jsonData.pr_master) {
          const prNo = prMaster.doc_num;

          // ดึงข้อมูล PR เก่า (สถานะและวันที่ก่อนหน้า)
          const oldPRData = await ctx.db.$queryRawUnsafe<Array<{
            doc_status: string;
            req_name: string;
            doc_date: string;
            update_date: string;
          }>>(`
            SELECT doc_status, req_name, doc_date, update_date FROM pr_master WHERE doc_num = $1
          `, prNo);

          const oldStatus = oldPRData[0]?.doc_status;
          const newStatus = prMaster.doc_status;
          const reqName = prMaster.req_name;

          // หา PO ที่เกี่ยวข้องกับ PR นี้
          const poLinks = jsonData.pr_po_links.filter(link => link.pr_doc_num === prNo);

          // 🔹 ตรวจสอบว่า PR ใหม่หรือไม่
          const isNewPR = !oldStatus;

          // 🔹 ตรวจสอบว่าวันที่เปิด PR ตรงกับวันที่อัพเดตหรือไม่ (ถ้าตรง = PR ใหม่)
          const docDate = prMaster.doc_date ? new Date(prMaster.doc_date).toISOString().split('T')[0] : null;
          const updateDate = prMaster.update_date ? new Date(prMaster.update_date).toISOString().split('T')[0] : null;
          const isJustCreated = docDate && updateDate && docDate === updateDate;

          // กรณีที่ 1: มีการเปลี่ยนสถานะ
          if (oldStatus && oldStatus !== newStatus) {
            // ตรวจสอบว่าเคยบันทึก log นี้ไปแล้วหรือยัง
            const existingLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
              SELECT id FROM sync_change_log
              WHERE change_type = 'PR_STATUS_CHANGED'
                AND pr_no = $1
                AND old_status = $2
                AND new_status = $3
              LIMIT 1
            `, prNo, oldStatus, newStatus);

            if (existingLog.length === 0) {
              await ctx.db.$queryRawUnsafe(`
                INSERT INTO sync_change_log (
                  sync_log_id, change_type, pr_no, pr_description,
                  old_status, new_status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, syncLogId, 'PR_STATUS_CHANGED', prNo, reqName, oldStatus, newStatus, syncEndTime);
            }
          }

          // กรณีที่ 2: PR ใหม่
          if (isNewPR || isJustCreated) {
            // ตรวจสอบว่าเคยบันทึก PR_NEW ไปแล้วหรือยัง
            const existingLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
              SELECT id FROM sync_change_log
              WHERE change_type = 'PR_NEW'
                AND pr_no = $1
              LIMIT 1
            `, prNo);

            if (existingLog.length === 0) {
              await ctx.db.$queryRawUnsafe(`
                INSERT INTO sync_change_log (
                  sync_log_id, change_type, pr_no, pr_description,
                  new_status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `, syncLogId, 'PR_NEW', prNo, reqName, newStatus, syncEndTime);
            }
          }
          // กรณีที่ 3: PR อัพเดท (ไม่เปลี่ยนสถานะและไม่ใช่ PR ใหม่)
          else if (oldStatus === newStatus && !isJustCreated) {
            // ตรวจสอบว่าเคยบันทึก PR_UPDATED ในรอบนี้ไปแล้วหรือยัง (ใช้เวลาเป็นตัวตัดสิน)
            const existingLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
              SELECT id FROM sync_change_log
              WHERE change_type = 'PR_UPDATED'
                AND pr_no = $1
                AND sync_log_id = $2
              LIMIT 1
            `, prNo, syncLogId);

            if (existingLog.length === 0) {
              await ctx.db.$queryRawUnsafe(`
                INSERT INTO sync_change_log (
                  sync_log_id, change_type, pr_no, pr_description,
                  new_status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `, syncLogId, 'PR_UPDATED', prNo, reqName, newStatus, syncEndTime);
            }
          }

          // กรณีที่ 4: บันทึก PO ที่เกี่ยวข้อง
          for (const poLink of poLinks) {
            // ตรวจสอบว่าเคย link PO นี้ไปแล้วหรือยัง
            const existingPOLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
              SELECT id FROM sync_change_log
              WHERE change_type = 'PO_LINKED'
                AND pr_no = $1
                AND po_no = $2
                AND po_description = $3
              LIMIT 1
            `, prNo, poLink.po_doc_num, poLink.po_line_description);

            if (existingPOLog.length === 0) {
              await ctx.db.$queryRawUnsafe(`
                INSERT INTO sync_change_log (
                  sync_log_id, change_type, pr_no, pr_description,
                  po_no, po_description, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, syncLogId, 'PO_LINKED', prNo, reqName, poLink.po_doc_num, poLink.po_line_description, syncEndTime);
            }
          }
        }

        console.log(`[SYNC] ✅ Recorded changes to sync_change_log`);
      }

      // สร้าง message พร้อม warning ถ้าเป็น forced full sync
      let message = `[${syncType}] Synced ${upsertResult[0].pr_master_updated} PRs, ${upsertResult[0].pr_lines_updated} lines, ${upsertResult[0].po_links_updated} PO links in ${durationSeconds}s`;

      if (forceFullSyncWarning) {
        message = `⚠️ ยังไม่เคย Full Sync วันนี้ - ทำ Full Sync แทน (ช้ากว่าปกติ)\n${message}`;
      }

      return {
        success: true,
        sync_type: syncType,
        records_fetched: records.length,
        duration_seconds: durationSeconds,
        forced_full_sync: forceFullSyncWarning,
        ...upsertResult[0],
        message,
      };

    } catch (error) {
      // บันทึก error log
      const syncEndTime = new Date();
      const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      try {
        await ctx.db.$queryRawUnsafe(`
          INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, syncEndTime, 'error', 0, durationSeconds, 'UNKNOWN', errorMessage);
      } catch (logError) {
        console.error('Failed to log sync error:', logError);
      }

      console.error('[SYNC] ❌ Sync error:', error);
      throw new Error(`Sync failed: ${errorMessage}`);
    } finally {
      if (sqlPool) {
        await sqlPool.close();
      }
    }
  }),

  // 🔹 5. Refresh Materialized View
  refreshView: publicProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.$queryRawUnsafe('SELECT quick_refresh_view()') as any[];
    return {
      success: true,
      message: result[0]?.quick_refresh_view || 'Refreshed successfully',
    };
  }),

  // 🔹 6. ดึง Sync History พร้อม changes (grouped by sync session)
  getSyncHistory: publicProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      // สร้าง WHERE conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`sync_date >= $${paramIndex}`);
        params.push(new Date(dateFrom));
        paramIndex++;
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999); // สิ้นสุดวัน
        conditions.push(`sync_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // ดึง sync sessions (ทั้งหมด ไม่มี limit)
      const syncSessions = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        sync_date: Date;
        sync_type: string;
        status: string;
        records_processed: number;
        duration_seconds: number;
      }>>(`
        SELECT
          id,
          sync_date,
          sync_type,
          status,
          records_processed,
          duration_seconds
        FROM sync_log
        ${whereClause}
        ORDER BY sync_date DESC
      `, ...params);

      // ดึง changes สำหรับแต่ละ sync session
      const historyWithChanges = await Promise.all(
        syncSessions.map(async (session) => {
          const changes = await ctx.db.$queryRawUnsafe<Array<{
            id: number;
            change_type: string;
            pr_no: number;
            pr_description: string | null;
            po_no: number | null;
            po_description: string | null;
            old_status: string | null;
            new_status: string | null;
            created_at: Date;
          }>>(`
            SELECT
              id,
              change_type,
              pr_no,
              pr_description,
              po_no,
              po_description,
              old_status,
              new_status,
              created_at
            FROM sync_change_log
            WHERE sync_log_id = $1
            ORDER BY created_at DESC, pr_no ASC
          `, session.id);

          return {
            ...session,
            changes,
            change_count: changes.length,
          };
        })
      );

      return {
        sessions: historyWithChanges,
        total: historyWithChanges.length,
      };
    }),

  // 🔹 7. ดึง changes ของ sync session เฉพาะ
  getSyncChanges: publicProcedure
    .input(z.object({
      syncLogId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const changes = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        change_type: string;
        pr_no: number;
        pr_description: string | null;
        po_no: number | null;
        po_description: string | null;
        old_status: string | null;
        new_status: string | null;
        created_at: Date;
      }>>(`
        SELECT
          id,
          change_type,
          pr_no,
          pr_description,
          po_no,
          po_description,
          old_status,
          new_status,
          created_at
        FROM sync_change_log
        WHERE sync_log_id = $1
        ORDER BY created_at DESC, pr_no ASC
      `, input.syncLogId);

      return changes;
    }),

  // 🔹 8. ดึงข้อมูล PO Info (วันที่ออก PO)
  getPOInfo: publicProcedure
    .input(z.object({
      poNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const poInfo = await ctx.db.po_info.findUnique({
        where: { po_doc_num: input.poNo },
      });

      return poInfo;
    }),

  // 🔹 9. ดึงข้อมูล PO Info หลายตัว
  getPOInfoBatch: publicProcedure
    .input(z.object({
      poNumbers: z.array(z.number()),
    }))
    .query(async ({ ctx, input }) => {
      const poInfoList = await ctx.db.po_info.findMany({
        where: {
          po_doc_num: {
            in: input.poNumbers,
          },
        },
      });

      // สร้าง Map สำหรับค้นหาง่าย
      const poInfoMap = new Map();
      poInfoList.forEach(info => {
        poInfoMap.set(info.po_doc_num, info);
      });

      return poInfoMap;
    }),

  // 🔹 10. สร้าง User Tracking Log ใหม่
  createTracking: publicProcedure
    .input(z.object({
      prNo: z.number(),
      urgencyLevel: z.enum(['ด่วนที่สุด', 'ด่วน', 'ปกติ', 'ปิดแล้ว']),
      note: z.string().optional(),
      trackedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tracking = await ctx.db.user_tracking_log.create({
        data: {
          pr_doc_num: input.prNo,
          urgency_level: input.urgencyLevel,
          note: input.note || null,
          tracked_by: input.trackedBy || null,
        },
      });

      // Log activity trail
      try {
        const ipAddress = ctx.req ? getClientIp(ctx.req) : 'unknown';
        await ctx.db.activity_trail.create({
          data: {
            user_id: undefined,
            user_name: input.trackedBy ?? undefined,
            ip_address: ipAddress,
            action: 'TRACK_PR',
            description: input.note || 'บันทึกการติดตาม PR',
            pr_no: input.prNo,
            tracking_id: tracking.id,
            metadata: {
              urgency_level: input.urgencyLevel,
            },
          },
        });
      } catch (error) {
        console.error('[createTracking] Failed to log activity:', error);
      }

      // ดึงข้อมูล PR เพื่อส่ง Telegram notification
      try {
        const prData = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          job_name: string | null;
          req_name: string | null;
          department_name: string | null;
        }>>(`
          SELECT doc_num, job_name, req_name, department_name
          FROM pr_master
          WHERE doc_num = $1
        `, input.prNo);

        if (prData && prData.length > 0) {
          const pr = prData[0];

          // ส่ง Telegram notification
          await notifyPRTracking({
            prNo: input.prNo,
            jobName: pr?.job_name || null,
            prRemarks: null, // PR master ไม่มี remarks field
            requesterName: pr?.req_name || null,
            departmentName: pr?.department_name || null,
            urgencyLevel: input.urgencyLevel,
            trackingNote: input.note || null,
            trackedBy: input.trackedBy || null,
            trackedAt: tracking.tracked_at,
          });
        }
      } catch (error) {
        console.error('[createTracking] Failed to send Telegram notification:', error);
        // ไม่ throw error เพื่อไม่ให้การบันทึก tracking ล้มเหลว
      }

      return tracking;
    }),

  // 🔹 11. ดึงประวัติ Tracking ของ PR
  getTrackingHistory: publicProcedure
    .input(z.object({
      prNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.user_tracking_log.findMany({
        where: {
          pr_doc_num: input.prNo,
        },
        orderBy: {
          tracked_at: 'desc',
        },
      });

      return history;
    }),

  // 🔹 12. ดึง Tracking ล่าสุดของแต่ละ PR พร้อมคำตอบล่าสุด (สำหรับแสดงในหน้าหลัก)
  getLatestTrackings: publicProcedure
    .input(z.object({
      prNumbers: z.array(z.number()),
    }))
    .query(async ({ ctx, input }) => {
      console.log('[getLatestTrackings] Input PR numbers:', input.prNumbers);

      // ดึง tracking ล่าสุดของแต่ละ PR พร้อม tracking_id
      const trackings = await ctx.db.$queryRawUnsafe<Array<{
        tracking_id: number;
        pr_doc_num: number;
        urgency_level: string;
        note: string | null;
        tracked_at: Date;
        tracked_by: string | null;
      }>>(`
        SELECT DISTINCT ON (pr_doc_num)
          id as tracking_id,
          pr_doc_num,
          urgency_level,
          note,
          tracked_at,
          tracked_by
        FROM user_tracking_log
        WHERE pr_doc_num = ANY($1::int[])
        ORDER BY pr_doc_num, tracked_at DESC
      `, input.prNumbers);

      console.log('[getLatestTrackings] Found trackings:', trackings.length);

      // ดึงคำตอบล่าสุดของแต่ละ tracking
      const trackingIds = trackings.map(t => t.tracking_id);

      let latestResponses: Array<{
        tracking_id: number;
        response_note: string | null;
        responded_by: string | null;
        responded_at: Date;
      }> = [];

      if (trackingIds.length > 0) {
        latestResponses = await ctx.db.$queryRawUnsafe(`
          SELECT DISTINCT ON (tracking_id)
            tracking_id,
            response_note,
            responded_by,
            responded_at
          FROM tracking_response_log
          WHERE tracking_id = ANY($1::int[])
          ORDER BY tracking_id, responded_at DESC
        `, trackingIds);
      }

      // ดึงจำนวนคำถามทั้งหมดและจำนวนคำถามที่มีคำตอบสำหรับแต่ละ PR
      const trackingStats = await ctx.db.$queryRawUnsafe<Array<{
        pr_doc_num: number;
        total_questions: number;
        answered_questions: number;
      }>>(`
        SELECT
          utl.pr_doc_num,
          COUNT(DISTINCT utl.id)::int as total_questions,
          COUNT(DISTINCT CASE WHEN trl.tracking_id IS NOT NULL THEN utl.id END)::int as answered_questions
        FROM user_tracking_log utl
        LEFT JOIN tracking_response_log trl ON utl.id = trl.tracking_id
        WHERE utl.pr_doc_num = ANY($1::int[])
        GROUP BY utl.pr_doc_num
      `, input.prNumbers);

      // สร้าง Map สำหรับค้นหาง่าย
      const responseMap = new Map();
      latestResponses.forEach(response => {
        responseMap.set(response.tracking_id, response);
      });

      const statsMap = new Map();
      trackingStats.forEach(stat => {
        statsMap.set(stat.pr_doc_num, {
          total_questions: stat.total_questions,
          answered_questions: stat.answered_questions,
        });
      });

      // รวม tracking กับ response และ stats
      const trackingMap: Record<number, any> = {};
      trackings.forEach(tracking => {
        const latestResponse = responseMap.get(tracking.tracking_id);
        const stats = statsMap.get(tracking.pr_doc_num) || { total_questions: 0, answered_questions: 0 };
        trackingMap[tracking.pr_doc_num] = {
          ...tracking,
          latest_response: latestResponse || null,
          total_questions: stats.total_questions,
          answered_questions: stats.answered_questions,
        };
      });

      console.log('[getLatestTrackings] Map size:', Object.keys(trackingMap).length);
      console.log('[getLatestTrackings] Responses found:', latestResponses.length);

      return trackingMap;
    }),

  // 🔹 13. สร้าง Tracking Response (คำตอบจากฝ่ายจัดซื้อ)
  createTrackingResponse: publicProcedure
    .input(z.object({
      trackingId: z.number(),
      prNo: z.number(),
      responseNote: z.string().optional(),
      respondedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.tracking_response_log.create({
        data: {
          tracking_id: input.trackingId,
          pr_doc_num: input.prNo,
          response_note: input.responseNote || null,
          responded_by: input.respondedBy || null,
        },
      });

      // Log activity trail
      try {
        const ipAddress = ctx.req ? getClientIp(ctx.req) : 'unknown';
        await ctx.db.activity_trail.create({
          data: {
            user_id: undefined,
            user_name: input.respondedBy ?? undefined,
            ip_address: ipAddress,
            action: 'RESPONSE_PR',
            description: input.responseNote || 'ตอบกลับการติดตาม PR',
            pr_no: input.prNo,
            tracking_id: input.trackingId,
            metadata: {
              response_id: response.id,
            },
          },
        });
      } catch (error) {
        console.error('[createTrackingResponse] Failed to log activity:', error);
      }

      // ดึงข้อมูล PR และ Tracking เพื่อส่ง Telegram notification
      try {
        const prData = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          job_name: string | null;
          req_name: string | null;
          department_name: string | null;
        }>>(`
          SELECT doc_num, job_name, req_name, department_name
          FROM pr_master
          WHERE doc_num = $1
        `, input.prNo);

        const trackingData = await ctx.db.user_tracking_log.findUnique({
          where: { id: input.trackingId },
        });

        if (prData && prData.length > 0 && trackingData) {
          const pr = prData[0];

          // ส่ง Telegram notification
          await notifyPRTrackingResponse({
            prNo: input.prNo,
            jobName: pr?.job_name || null,
            prRemarks: null, // PR master ไม่มี remarks field
            requesterName: pr?.req_name || null,
            departmentName: pr?.department_name || null,
            urgencyLevel: trackingData.urgency_level,
            trackingNote: trackingData.note,
            trackedBy: trackingData.tracked_by,
            trackedAt: trackingData.tracked_at,
            responseNote: input.responseNote || '',
            respondedBy: input.respondedBy || null,
            respondedAt: response.responded_at,
          });
        }
      } catch (error) {
        console.error('[createTrackingResponse] Failed to send Telegram notification:', error);
        // ไม่ throw error เพื่อไม่ให้การบันทึก response ล้มเหลว
      }

      return response;
    }),

  // 🔹 14. ดึงประวัติคำตอบการติดตาม (Responses) ของ PR
  getTrackingResponses: publicProcedure
    .input(z.object({
      prNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const responses = await ctx.db.tracking_response_log.findMany({
        where: {
          pr_doc_num: input.prNo,
        },
        include: {
          user_tracking: true,
        },
        orderBy: {
          responded_at: 'desc',
        },
      });

      return responses;
    }),

  // 🔹 15. ดึงข้อมูล Tracking พร้อม Responses ล่าสุด (สำหรับแสดงใน Modal)
  getTrackingWithResponses: publicProcedure
    .input(z.object({
      prNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // ดึง trackings ทั้งหมดของ PR นี้
      const trackings = await ctx.db.user_tracking_log.findMany({
        where: {
          pr_doc_num: input.prNo,
        },
        include: {
          tracking_response_log: {
            orderBy: {
              responded_at: 'desc',
            },
          },
        },
        orderBy: {
          tracked_at: 'desc',
        },
      });

      return trackings;
    }),

  // 🔹 16. ดึง PR Numbers ตามระดับความเร่งด่วน (ย้อนหลัง 12 เดือน)
  getPRsByUrgencyLevels: publicProcedure
    .input(z.object({
      urgencyLevels: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      if (input.urgencyLevels.length === 0) {
        return [];
      }

      // คำนวณวันที่ย้อนหลัง 12 เดือน
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const dateString = twelveMonthsAgo.toISOString().split('T')[0];

      // ดึง PR ที่มี tracking ตามระดับความเร่งด่วนที่เลือก
      const trackings = await ctx.db.$queryRawUnsafe<Array<{
        pr_doc_num: number;
        urgency_level: string;
        tracked_at: Date;
      }>>(`
        SELECT DISTINCT ON (pr_doc_num)
          pr_doc_num,
          urgency_level,
          tracked_at
        FROM user_tracking_log
        WHERE urgency_level = ANY($1::text[])
          AND DATE(tracked_at) >= $2::DATE
        ORDER BY pr_doc_num, tracked_at DESC
      `, input.urgencyLevels, dateString);

      return trackings.map(t => t.pr_doc_num);
    }),

  // 🔹 17. ดึงไฟล์แนบของ PR
  getPRAttachments: publicProcedure
    .input(z.object({
      prNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const attachments = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        pr_doc_num: number;
        attachment_entry: number;
        file_name: string;
        src_path: string | null;
        trgt_path: string | null;
        file_ext: string | null;
        created_at: Date;
      }>>(`
        SELECT
          id,
          pr_doc_num,
          attachment_entry,
          file_name,
          src_path,
          trgt_path,
          file_ext,
          created_at
        FROM pr_attachments
        WHERE pr_doc_num = $1
        ORDER BY created_at DESC
      `, input.prNo);

      return attachments;
    }),

  // 🔹 18. ดึงข้อมูล Q&A ทั้งหมดพร้อม Filter (สำหรับหน้า PR Q&A)
  getAllQA: publicProcedure
    .input(z.object({
      trackedBy: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      prNo: z.number().optional(),
      requesterName: z.string().optional(),
      jobName: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // ถ้ามี filter ผู้เปิด PR หรือชื่องาน ต้องกรอง PR ก่อน
      let filteredPrNos: number[] | undefined;

      if (input.requesterName || input.jobName) {
        const prWhereConditions: any = {};

        if (input.requesterName) {
          prWhereConditions.req_name = {
            contains: input.requesterName,
            mode: 'insensitive',
          };
        }

        if (input.jobName) {
          prWhereConditions.job_name = {
            contains: input.jobName,
            mode: 'insensitive',
          };
        }

        const filteredPRs = await ctx.db.pr_master.findMany({
          where: prWhereConditions,
          select: {
            doc_num: true,
          },
        });

        filteredPrNos = filteredPRs.map(pr => pr.doc_num);

        // ถ้าไม่มี PR ที่ตรงเงื่อนไข ให้ return empty
        if (filteredPrNos.length === 0) {
          return [];
        }
      }

      const whereConditions: any = {};

      // Filter by tracked_by (ผู้ถาม)
      if (input.trackedBy) {
        whereConditions.tracked_by = {
          contains: input.trackedBy,
          mode: 'insensitive',
        };
      }

      // Filter by date range
      if (input.dateFrom || input.dateTo) {
        whereConditions.tracked_at = {};
        if (input.dateFrom) {
          whereConditions.tracked_at.gte = new Date(input.dateFrom);
        }
        if (input.dateTo) {
          const toDate = new Date(input.dateTo);
          toDate.setHours(23, 59, 59, 999);
          whereConditions.tracked_at.lte = toDate;
        }
      }

      // Filter by PR No
      if (input.prNo) {
        whereConditions.pr_doc_num = input.prNo;
      }

      // Filter by filtered PR numbers (from requester/job name)
      if (filteredPrNos) {
        whereConditions.pr_doc_num = {
          in: filteredPrNos,
        };
      }

      // ดึงข้อมูล tracking พร้อม PR info และ responses
      const trackings = await ctx.db.user_tracking_log.findMany({
        where: whereConditions,
        include: {
          tracking_response_log: {
            orderBy: {
              responded_at: 'desc',
            },
          },
        },
        orderBy: [
          {
            pr_doc_num: 'desc', // เรียง PR จากมากไปน้อย
          },
          {
            tracked_at: 'desc', // แล้วเรียงตามวันที่ถาม
          },
        ],
      });

      // ดึงข้อมูล PR master สำหรับแต่ละ tracking
      const prNos = [...new Set(trackings.map(t => t.pr_doc_num))];
      const prMasters = await ctx.db.pr_master.findMany({
        where: {
          doc_num: {
            in: prNos,
          },
        },
        select: {
          doc_num: true,
          req_name: true,
          department_name: true,
          series_name: true,
          job_name: true,
        },
      });

      // สร้าง Map สำหรับ PR info
      const prInfoMap = new Map(prMasters.map(pr => [pr.doc_num, pr]));

      // รวมข้อมูล
      const qaData = trackings.map(tracking => ({
        ...tracking,
        pr_info: prInfoMap.get(tracking.pr_doc_num) || null,
      }));

      return qaData;
    }),

  // 🔹 ดึง PR พร้อม Tracking ล่าสุด (12 เดือนย้อนหลัง) - สำหรับ sortBy tracking_date
  getPRsWithTrackingsLast12Months: publicProcedure
    .query(async ({ ctx }) => {
      // คำนวณวันที่ 12 เดือนย้อนหลัง
      const date12MonthsAgo = new Date();
      date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12);
      const dateFrom = date12MonthsAgo.toISOString().split('T')[0];

      console.log('[getPRsWithTrackingsLast12Months] Querying PRs with trackings from:', dateFrom);

      // ดึง PR ทั้งหมดที่มีการติดตามในช่วง 12 เดือน
      const trackingsWithPRs = await ctx.db.$queryRawUnsafe<Array<{
        tracking_id: number;
        pr_doc_num: number;
        urgency_level: string;
        note: string | null;
        tracked_at: Date;
        tracked_by: string | null;
        // PR info
        req_name: string | null;
        department_name: string | null;
        doc_date: Date;
        doc_due_date: Date;
        doc_status: string;
        series_name: string | null;
        update_date: Date;
        job_name: string | null;
        remarks: string | null;
        total_lines: number;
        lines_with_po: number;
        pending_lines: number;
        is_complete: boolean;
        po_numbers: number[];
        total_po_quantity: number | null;
      }>>(`
        SELECT DISTINCT ON (utl.pr_doc_num)
          utl.id as tracking_id,
          utl.pr_doc_num,
          utl.urgency_level,
          utl.note,
          utl.tracked_at,
          utl.tracked_by,
          -- PR info from mv_pr_summary
          mv.req_name,
          mv.department_name,
          mv.doc_date,
          mv.doc_due_date,
          mv.doc_status,
          mv.series_name,
          mv.update_date,
          mv.job_name,
          mv.remarks,
          mv.total_lines,
          mv.lines_with_po,
          mv.pending_lines,
          mv.is_complete,
          mv.po_numbers,
          mv.total_po_quantity
        FROM user_tracking_log utl
        INNER JOIN mv_pr_summary mv ON utl.pr_doc_num = mv.doc_num
        WHERE utl.tracked_at >= $1::DATE
        ORDER BY utl.pr_doc_num, utl.tracked_at DESC
      `, dateFrom);

      console.log('[getPRsWithTrackingsLast12Months] Found PRs with trackings:', trackingsWithPRs.length);

      // ดึง tracking IDs เพื่อหา responses
      const trackingIds = trackingsWithPRs.map(t => t.tracking_id);

      let latestResponses: Array<{
        tracking_id: number;
        response_note: string | null;
        responded_by: string | null;
        responded_at: Date;
      }> = [];

      if (trackingIds.length > 0) {
        latestResponses = await ctx.db.$queryRawUnsafe(`
          SELECT DISTINCT ON (tracking_id)
            tracking_id,
            response_note,
            responded_by,
            responded_at
          FROM tracking_response_log
          WHERE tracking_id = ANY($1::int[])
          ORDER BY tracking_id, responded_at DESC
        `, trackingIds);
      }

      // ดึงจำนวนคำถามทั้งหมดและจำนวนคำถามที่มีคำตอบ
      const prNumbers = trackingsWithPRs.map(t => t.pr_doc_num);
      const trackingStats = await ctx.db.$queryRawUnsafe<Array<{
        pr_doc_num: number;
        total_questions: number;
        answered_questions: number;
      }>>(`
        SELECT
          utl.pr_doc_num,
          COUNT(DISTINCT utl.id)::int as total_questions,
          COUNT(DISTINCT CASE WHEN trl.tracking_id IS NOT NULL THEN utl.id END)::int as answered_questions
        FROM user_tracking_log utl
        LEFT JOIN tracking_response_log trl ON utl.id = trl.tracking_id
        WHERE utl.pr_doc_num = ANY($1::int[])
        GROUP BY utl.pr_doc_num
      `, prNumbers);

      // สร้าง Map
      const responseMap = new Map();
      latestResponses.forEach(response => {
        responseMap.set(response.tracking_id, response);
      });

      const statsMap = new Map();
      trackingStats.forEach(stat => {
        statsMap.set(stat.pr_doc_num, {
          total_questions: stat.total_questions,
          answered_questions: stat.answered_questions,
        });
      });

      // รวมข้อมูล PR + tracking + response
      const result = trackingsWithPRs.map(item => {
        const latestResponse = responseMap.get(item.tracking_id);
        const stats = statsMap.get(item.pr_doc_num) || { total_questions: 0, answered_questions: 0 };

        return {
          // PR info
          doc_num: item.pr_doc_num,
          req_name: item.req_name,
          department_name: item.department_name,
          doc_date: item.doc_date,
          doc_due_date: item.doc_due_date,
          doc_status: item.doc_status,
          series_name: item.series_name,
          update_date: item.update_date,
          job_name: item.job_name,
          remarks: item.remarks,
          total_lines: item.total_lines,
          lines_with_po: item.lines_with_po,
          pending_lines: item.pending_lines,
          is_complete: item.is_complete,
          po_numbers: item.po_numbers,
          total_po_quantity: item.total_po_quantity,
          // Tracking info
          tracking: {
            tracking_id: item.tracking_id,
            urgency_level: item.urgency_level,
            note: item.note,
            tracked_at: item.tracked_at,
            tracked_by: item.tracked_by,
            latest_response: latestResponse || null,
            total_questions: stats.total_questions,
            answered_questions: stats.answered_questions,
          },
        };
      });

      console.log('[getPRsWithTrackingsLast12Months] Returning:', result.length, 'PRs');

      return {
        success: true,
        data: result,
      };
    }),
});
