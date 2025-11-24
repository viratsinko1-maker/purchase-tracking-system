/**
 * W Series Cron Scheduler
 *
 * Auto Sync ทุก 2 ชั่วโมง (ล้างข้อมูลเก่าและใส่ข้อมูลใหม่)
 * Schedule: Every 2 hours (ทุก 2 ชั่วโมง)
 */

import cron from 'node-cron';
import { db } from '~/server/db';
import sql from "mssql";

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
 * ฟังก์ชันสำหรับ sync ข้อมูล W Series
 */
async function triggerWSeriesSync() {
  let sqlPool: sql.ConnectionPool | null = null;
  const syncStartTime = new Date();

  try {
    console.log(`[W-SERIES-SCHEDULER] Starting sync at ${syncStartTime.toISOString()}`);

    // เชื่อมต่อ SQL Server
    sqlPool = await sql.connect(sqlConfig);

    // ดึงข้อมูล W Series จาก SAP
    const result = await sqlPool.request().query(`
      ;WITH WO_All AS (
          SELECT
              WO.DocNum      AS WO_DocNum,
              WR.DocNum      AS WR_DocNum,
              WA.DocNum      AS WA_DocNum,
              WC.DocNum      AS WC_DocNum
          FROM OPRQ WO
          LEFT JOIN PRQ21 L1 ON WO.DocEntry = L1.DocEntry
          LEFT JOIN OPRQ WR
                 ON L1.RefDocEntr = WR.DocEntry
                AND WR.ObjType = '1470000113'
                AND WR.Series IN (SELECT Series FROM NNM1 WHERE BeginStr='WR')

          LEFT JOIN PRQ21 L2 ON WO.DocEntry = L2.RefDocEntr
          LEFT JOIN OPRQ WA
                 ON L2.DocEntry = WA.DocEntry
                AND WA.ObjType = '1470000113'
                AND WA.Series IN (SELECT Series FROM NNM1 WHERE BeginStr='WA')

          LEFT JOIN PRQ21 L3 ON WO.DocEntry = L3.RefDocEntr
          LEFT JOIN OPRQ WC
                 ON L3.DocEntry = WC.DocEntry
                AND WC.ObjType = '1470000113'
                AND WC.Series IN (SELECT Series FROM NNM1 WHERE BeginStr='WC')
          WHERE WO.ObjType = '1470000113'
            AND SUBSTRING(CONVERT(VARCHAR(20), WO.DocNum), 5, 1) = '3'
      ),
      WO_Ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                     PARTITION BY WO_DocNum
                     ORDER BY
                         (CASE WHEN WR_DocNum IS NOT NULL THEN 1 ELSE 0 END +
                          CASE WHEN WA_DocNum IS NOT NULL THEN 1 ELSE 0 END +
                          CASE WHEN WC_DocNum IS NOT NULL THEN 1 ELSE 0 END) DESC
                 ) AS RN
          FROM WO_All
      ),
      PO_PR AS (
          SELECT DISTINCT
              T0.DocNum AS PO_DocNum,
              T1.BaseRef AS PRNo,
              T4.RefDocNum AS WONo
          FROM OPOR T0
          INNER JOIN POR1 T1 ON T0.DocEntry = T1.DocEntry
          LEFT JOIN PRQ1 T3 ON T1.BaseEntry = T3.DocEntry AND T1.BaseType = T3.ObjType
          LEFT JOIN PRQ21 T4 ON T3.DocEntry = T4.DocEntry
          WHERE T0.CANCELED = 'N'
            AND ISNULL(T1.OcrCode4,'') NOT LIKE 'RA%'
      )
      SELECT DISTINCT
          PO.PO_DocNum,
          PO.PRNo,
          WO.WO_DocNum,
          WO.WR_DocNum,
          WO.WA_DocNum,
          WO.WC_DocNum
      FROM WO_Ranked WO
      LEFT JOIN PO_PR PO
          ON WO.WO_DocNum = PO.WONo
      WHERE WO.RN = 1
      ORDER BY WO.WO_DocNum;
    `);

    const records = result.recordset;
    console.log(`[W-SERIES-SCHEDULER] Fetched ${records.length} records from SAP`);

    // ล้างข้อมูลเก่าทั้งหมด
    await db.$executeRaw`DELETE FROM w_series_tracking`;
    console.log(`[W-SERIES-SCHEDULER] Cleared old data from w_series_tracking`);

    // Insert ข้อมูลใหม่
    let insertedCount = 0;
    for (const record of records) {
      await db.w_series_tracking.create({
        data: {
          po_doc_num: record.PO_DocNum ? Number(record.PO_DocNum) : null,
          pr_no: record.PRNo ? String(record.PRNo) : null,
          wo_doc_num: Number(record.WO_DocNum),
          wr_doc_num: record.WR_DocNum ? Number(record.WR_DocNum) : null,
          wa_doc_num: record.WA_DocNum ? Number(record.WA_DocNum) : null,
          wc_doc_num: record.WC_DocNum ? Number(record.WC_DocNum) : null,
        }
      });
      insertedCount++;
    }

    console.log(`[W-SERIES-SCHEDULER] Inserted ${insertedCount} records`);

    // คำนวณเวลาที่ใช้ และบันทึก sync log
    const syncEndTime = new Date();
    const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);

    // บันทึก sync log
    await db.w_series_sync_log.create({
      data: {
        sync_date: syncEndTime,
        sync_type: 'FULL',
        records_synced: insertedCount,
        duration_seconds: durationSeconds,
        status: 'SUCCESS',
        error_message: null,
      }
    });

    console.log(`[W-SERIES-SCHEDULER] ✅ Sync completed in ${durationSeconds}s`);

    return {
      success: true,
      records_synced: insertedCount,
      duration_seconds: durationSeconds,
    };

  } catch (error) {
    const syncEndTime = new Date();
    const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[W-SERIES-SCHEDULER] ❌ Sync error:', error);

    try {
      await db.w_series_sync_log.create({
        data: {
          sync_date: syncEndTime,
          sync_type: 'FULL',
          records_synced: 0,
          duration_seconds: durationSeconds,
          status: 'FAILED',
          error_message: errorMessage,
        }
      });
    } catch (logError) {
      console.error('[W-SERIES-SCHEDULER] Failed to log sync error:', logError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

/**
 * เริ่มต้น W Series Cron Scheduler
 *
 * Schedule: Every 2 hours (cron pattern in code)
 * Timezone: Asia/Bangkok
 */
export function initWSeriesScheduler() {
  // W Series Sync: ทุก 2 ชั่วโมง
  cron.schedule('0 */2 * * *', async () => {
    const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    console.log(`[W-SERIES-SCHEDULER] 🕐 Triggered W Series Sync at ${currentTime}`);
    await triggerWSeriesSync();
  }, {
    timezone: 'Asia/Bangkok'
  });

  console.log('[W-SERIES-SCHEDULER] ✅ W Series Scheduler initialized');
  console.log('[W-SERIES-SCHEDULER] 📅 Auto Sync: Every 2 hours');
}
