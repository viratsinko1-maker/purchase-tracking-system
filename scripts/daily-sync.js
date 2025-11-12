/**
 * Daily Full Sync Script
 *
 * รัน Full Sync โดยตรงกับ database โดยไม่ต้องผ่าน HTTP API
 * เหมาะสำหรับใช้กับ Windows Task Scheduler หรือ cron job
 *
 * การใช้งาน:
 * node scripts/daily-sync.js
 */

import sql from "mssql";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function runDailySync() {
  let sqlPool = null;
  const syncStartTime = new Date();

  try {
    console.log(`[SYNC] Starting daily full sync at ${syncStartTime.toISOString()}`);

    // ✅ STEP 1: เชื่อมต่อ SQL Server
    sqlPool = await sql.connect(sqlConfig);
    console.log('[SYNC] Connected to SAP database');

    // ✅ STEP 2: ดึงข้อมูลทั้งหมดจาก SAP (Full Sync)
    const whereClause = "T2.[BeginStr] = 'PR'";

    console.log('[SYNC] Fetching data from SAP...');
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

    // ✅ STEP 3: แปลงข้อมูลเป็น JSON format
    console.log('[SYNC] Processing data...');
    const prMasterMap = new Map();
    const prLinesMap = new Map();
    const prPoLinksMap = new Map();

    records.forEach((record) => {
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

      // PR Lines
      const lineKey = `${prDocNum}-${record['รหัสสินค้า (PR)']}-${record['ชื่อสินค้า / รายการ (PR)']}`;
      if (!prLinesMap.has(lineKey)) {
        prLinesMap.set(lineKey, {
          pr_doc_num: prDocNum,
          line_num: 0,
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
      }
    });

    // จัดเรียง pr_lines และใส่ line_num
    const prLinesArray = Array.from(prLinesMap.values());
    const prLinesByDocNum = {};
    prLinesArray.forEach(line => {
      if (!prLinesByDocNum[line.pr_doc_num]) {
        prLinesByDocNum[line.pr_doc_num] = [];
      }
      prLinesByDocNum[line.pr_doc_num].push(line);
    });

    const prLines = [];
    Object.keys(prLinesByDocNum).forEach(docNum => {
      prLinesByDocNum[Number(docNum)].forEach((line, index) => {
        prLines.push({
          ...line,
          line_num: index
        });
      });
    });

    const jsonData = {
      pr_master: Array.from(prMasterMap.values()),
      pr_lines: prLines,
      pr_po_links: Array.from(prPoLinksMap.values())
    };

    console.log(`[SYNC] Processing ${jsonData.pr_master.length} PR masters, ${jsonData.pr_lines.length} lines, ${jsonData.pr_po_links.length} PO links`);

    // ✅ STEP 4: เรียก upsert_pr_data()
    console.log('[SYNC] Upserting data to PostgreSQL...');
    const upsertResult = await prisma.$queryRawUnsafe(
      'SELECT * FROM upsert_pr_data($1::JSONB)',
      JSON.stringify(jsonData)
    );

    // ✅ STEP 5: Refresh Materialized View
    console.log('[SYNC] Refreshing materialized view...');
    await prisma.$queryRawUnsafe('SELECT quick_refresh_view()');

    // ✅ STEP 6: คำนวณเวลาที่ใช้ และบันทึก sync log
    const syncEndTime = new Date();
    const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);

    // บันทึก sync log
    await prisma.$queryRawUnsafe(`
      INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, syncEndTime, 'success', records.length, durationSeconds, 'FULL', null);

    console.log(`[SYNC] ✅ Full sync completed successfully`);
    console.log(`[SYNC] Duration: ${durationSeconds} seconds`);
    console.log(`[SYNC] Updated: ${upsertResult[0].pr_master_updated} PRs, ${upsertResult[0].pr_lines_updated} lines, ${upsertResult[0].po_links_updated} PO links`);

    process.exit(0);

  } catch (error) {
    // บันทึก error log
    const syncEndTime = new Date();
    const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[SYNC] ❌ Sync error:', error);

    try {
      await prisma.$queryRawUnsafe(`
        INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, syncEndTime, 'error', 0, durationSeconds, 'FULL', errorMessage);
    } catch (logError) {
      console.error('[SYNC] Failed to log sync error:', logError);
    }

    process.exit(1);
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
    await prisma.$disconnect();
  }
}

// รัน sync
runDailySync();
