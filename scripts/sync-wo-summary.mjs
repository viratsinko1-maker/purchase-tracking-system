/**
 * Script สำหรับ sync WO Summary จาก SAP ไปยัง PostgreSQL
 * รันครั้งเดียวเพื่อเติมข้อมูลเริ่มต้น
 *
 * Usage: node scripts/sync-wo-summary.mjs
 */

import sql from 'mssql';
import pg from 'pg';

const { Pool } = pg;

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
  requestTimeout: 120000, // 2 minutes for large queries
};

// PostgreSQL configuration
const pgPool = new Pool({
  host: '192.168.1.3',
  port: 5432,
  database: 'PR_PO',
  user: 'sa',
  password: '@12345',
});

async function syncWOSummary() {
  console.log('🚀 Starting WO Summary sync...');
  console.log('📅 Time:', new Date().toLocaleString('th-TH'));

  let sqlPool = null;

  try {
    // Connect to SQL Server
    console.log('📡 Connecting to SQL Server...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');

    // Query WO Summary data (ใช้ TRY_CONVERT เพื่อรองรับข้อมูลที่ไม่ถูกต้อง)
    console.log('🔍 Querying WO Summary from SAP...');
    const result = await sqlPool.request().query(`
      SELECT
        T1.SeriesName AS WO_SeriesName,
        WO.ObjType,
        WO.DocNum AS WO_DocNum,
        WO.DocEntry AS WO_DocEntry,
        WO.DocDate,
        WO.U_U_PR_FOR AS PR_FOR,
        WO.U_U_PR_MAC AS PR_MAC,
        T2.ItemName,
        WO.ReqName,
        WO.Department,
        T3.OcrName AS DeptName,
        WO.U_WOOrder1,
        WO.U_WORespondBy,
        WA.U_FinishDate2,
        TRY_CONVERT(datetime,
          CASE WHEN WO.U_Date IS NOT NULL AND WO.U_time IS NOT NULL AND LEN(WO.U_time) >= 3
            THEN CONVERT(nvarchar(10), WO.U_Date, 102) + ' ' +
              CASE WHEN LEN(WO.U_time) = 3 THEN LEFT(WO.U_time, 1) + ':' + RIGHT(WO.U_time, 2)
                   WHEN LEN(WO.U_time) >= 4 THEN LEFT(WO.U_time, 2) + ':' + RIGHT(WO.U_time, 2)
                   ELSE NULL END
            ELSE NULL END) AS WO_U_DATE,
        TRY_CONVERT(datetime,
          CASE WHEN WO.U_FinishDate IS NOT NULL AND WO.U_TIMEF IS NOT NULL AND LEN(WO.U_TIMEF) >= 3
            THEN CONVERT(nvarchar(10), WO.U_FinishDate, 102) + ' ' +
              CASE WHEN LEN(WO.U_TIMEF) = 3 THEN LEFT(WO.U_TIMEF, 1) + ':' + RIGHT(WO.U_TIMEF, 2)
                   WHEN LEN(WO.U_TIMEF) >= 4 THEN LEFT(WO.U_TIMEF, 2) + ':' + RIGHT(WO.U_TIMEF, 2)
                   ELSE NULL END
            ELSE NULL END) AS WO_U_Finish,
        WR.UpdateDate AS WR_CloseDate,
        WO.UpdateDate AS WO_CloseDate,
        WA.UpdateDate AS WA_CloseDate,
        WC.UpdateDate AS WC_CloseDate,
        TRY_CONVERT(datetime,
          CASE WHEN WA.U_FinishDate2 IS NOT NULL AND WA.U_FinishTime2 IS NOT NULL AND LEN(WA.U_FinishTime2) >= 3
            THEN CONVERT(nvarchar(10), WA.U_FinishDate2, 102) + ' ' +
              CASE WHEN LEN(WA.U_FinishTime2) = 3 THEN LEFT(WA.U_FinishTime2, 1) + ':' + RIGHT(WA.U_FinishTime2, 2)
                   WHEN LEN(WA.U_FinishTime2) >= 4 THEN LEFT(WA.U_FinishTime2, 2) + ':' + RIGHT(WA.U_FinishTime2, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_FinishDate,
        TRY_CONVERT(datetime,
          CASE WHEN WO.U_WODATEF IS NOT NULL AND WO.U_WOHRTEF IS NOT NULL AND LEN(WO.U_WOHRTEF) >= 3
            THEN CONVERT(nvarchar(10), WO.U_WODATEF, 102) + ' ' +
              CASE WHEN LEN(WO.U_WOHRTEF) = 3 THEN LEFT(WO.U_WOHRTEF, 1) + ':' + RIGHT(WO.U_WOHRTEF, 2)
                   WHEN LEN(WO.U_WOHRTEF) >= 4 THEN LEFT(WO.U_WOHRTEF, 2) + ':' + RIGHT(WO.U_WOHRTEF, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_PlantoWork,
        TRY_CONVERT(datetime,
          CASE WHEN WA.U_startJobDate IS NOT NULL AND WA.U_startJobTime IS NOT NULL AND LEN(WA.U_startJobTime) >= 3
            THEN CONVERT(nvarchar(10), WA.U_startJobDate, 102) + ' ' +
              CASE WHEN LEN(WA.U_startJobTime) = 3 THEN LEFT(WA.U_startJobTime, 1) + ':' + RIGHT(WA.U_startJobTime, 2)
                   WHEN LEN(WA.U_startJobTime) >= 4 THEN LEFT(WA.U_startJobTime, 2) + ':' + RIGHT(WA.U_startJobTime, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_StartWork,
        TRY_CONVERT(datetime,
          CASE WHEN WC.U_WC_MCDate_STO IS NOT NULL AND WC.U_WC_MCTime_STO IS NOT NULL AND LEN(WC.U_WC_MCTime_STO) >= 3
            THEN CONVERT(nvarchar(10), WC.U_WC_MCDate_STO, 102) + ' ' +
              CASE WHEN LEN(WC.U_WC_MCTime_STO) = 3 THEN LEFT(WC.U_WC_MCTime_STO, 1) + ':' + RIGHT(WC.U_WC_MCTime_STO, 2)
                   WHEN LEN(WC.U_WC_MCTime_STO) >= 4 THEN LEFT(WC.U_WC_MCTime_STO, 2) + ':' + RIGHT(WC.U_WC_MCTime_STO, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_MCStop,
        TRY_CONVERT(datetime,
          CASE WHEN WC.U_WC_MCDate_ST IS NOT NULL AND WC.U_WC_MCTime_ST IS NOT NULL AND LEN(WC.U_WC_MCTime_ST) >= 3
            THEN CONVERT(nvarchar(10), WC.U_WC_MCDate_ST, 102) + ' ' +
              CASE WHEN LEN(WC.U_WC_MCTime_ST) = 3 THEN LEFT(WC.U_WC_MCTime_ST, 1) + ':' + RIGHT(WC.U_WC_MCTime_ST, 2)
                   WHEN LEN(WC.U_WC_MCTime_ST) >= 4 THEN LEFT(WC.U_WC_MCTime_ST, 2) + ':' + RIGHT(WC.U_WC_MCTime_ST, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_MCStart,
        WC.U_WC_Du_PDT AS DueMCStop,
        WRN.SeriesName AS WR_SeriesName,
        WR.DocNum AS WR_DocNum,
        WAN.SeriesName AS WA_SeriesName,
        WA.DocNum AS WA_DocNum,
        WCN.SeriesName AS WC_SeriesName,
        WC.DocNum AS WC_DocNum,
        WO.U_WO_Respond1,
        WO.U_WO_Respond2,
        WO.U_WO_Respond3,
        WOA.U_NAME AS WO_Approver,
        WRA.U_NAME AS WR_Approver,
        WO.U_WO_NoteOrder,
        WC.U_WCOReason1,
        WC.U_WCWorkCommit1
      FROM OPRQ WO
      INNER JOIN NNM1 T1 ON WO.Series = T1.Series
      INNER JOIN PRQ21 WO21 ON WO.DocEntry = WO21.DocEntry
      INNER JOIN OPRQ WR ON WO21.RefDocEntr = WR.DocEntry
      INNER JOIN NNM1 WRN ON WR.Series = WRN.Series AND WRN.SeriesName LIKE 'WR%'
      LEFT JOIN PRQ21 WA21 ON WO.DocEntry = WA21.RefDocEntr
      LEFT JOIN OPRQ WA ON WA21.DocEntry = WA.DocEntry
      LEFT JOIN NNM1 WAN ON WA.Series = WAN.Series AND WAN.SeriesName LIKE 'WA%'
      LEFT JOIN PRQ21 WC21 ON WO.DocEntry = WC21.RefDocEntr
      LEFT JOIN OPRQ WC ON WC21.DocEntry = WC.DocEntry
      LEFT JOIN NNM1 WCN ON WC.Series = WCN.Series AND WCN.SeriesName LIKE 'WC%'
      LEFT JOIN OITM T2 ON WO.U_U_PR_MAC = T2.ItemCode
      INNER JOIN (SELECT OUDP.Code, OOCR.* FROM OUDP INNER JOIN OOCR ON OUDP.Name = OOCR.OcrCode) T3 ON WO.Department = T3.Code
      LEFT JOIN (SELECT a.DraftEntry, a.ObjType, c.USERid, c.U_NAME, MAX(b.sortID) SortID
                  FROM OWDD a
                  INNER JOIN WDD1 b ON a.WddCode = b.WddCode
                  INNER JOIN OUSR c ON b.Userid = c.USERID
                  GROUP BY a.DraftEntry, a.ObjType, c.USERid, c.U_NAME) WOA
          ON WO.draftKey = WOA.DraftEntry AND WOA.ObjType = '1470000113'
      LEFT JOIN (SELECT a.DraftEntry, a.ObjType, c.USERid, c.U_NAME, MAX(b.sortID) SortID
                  FROM OWDD a
                  INNER JOIN WDD1 b ON a.WddCode = b.WddCode
                  INNER JOIN OUSR c ON b.UserID = c.USERID
                  GROUP BY a.DraftEntry, a.ObjType, c.USERid, c.U_NAME) WRA
          ON WR.draftKey = WRA.DraftEntry AND WRA.ObjType = '1470000113'
      WHERE T1.SeriesName LIKE 'WO%'
      ORDER BY WO.DocNum DESC
    `);

    const records = result.recordset;
    console.log(`📊 Fetched ${records.length} WO Summary records from SAP`);

    if (records.length === 0) {
      console.log('⚠️ No WO Summary records found');
      return;
    }

    // Clear old data
    console.log('🗑️ Clearing old WO Summary data...');
    await pgPool.query('DELETE FROM wo_summary');
    console.log('✅ Old data cleared');

    // Insert new data in batches
    console.log('💾 Inserting new data...');
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          await pgPool.query(`
            INSERT INTO wo_summary (
              wo_doc_num, wo_doc_entry, wo_series_name, obj_type, doc_date,
              pr_for, pr_mac, item_name, req_name, department, dept_name,
              wo_order_1, wo_respond_by, wo_respond_1, wo_respond_2, wo_respond_3, wo_note_order,
              wo_u_date, wo_u_finish, wo_close_date,
              wr_series_name, wr_doc_num, wr_close_date, wr_approver,
              wa_series_name, wa_doc_num, wa_finish_date, wa_plan_to_work, wa_start_work, wa_close_date, u_finish_date_2,
              wc_series_name, wc_doc_num, wc_close_date, wa_mc_stop, wa_mc_start, due_mc_stop, wc_reason_1, wc_work_commit_1,
              wo_approver, last_sync_date
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17,
              $18, $19, $20,
              $21, $22, $23, $24,
              $25, $26, $27, $28, $29, $30, $31,
              $32, $33, $34, $35, $36, $37, $38, $39,
              $40, NOW()
            )
          `, [
            record.WO_DocNum,
            record.WO_DocEntry || null,
            record.WO_SeriesName || null,
            record.ObjType || null,
            record.DocDate || null,
            record.PR_FOR || null,
            record.PR_MAC || null,
            record.ItemName || null,
            record.ReqName || null,
            record.Department ? String(record.Department) : null,
            record.DeptName || null,
            record.U_WOOrder1 || null,
            record.U_WORespondBy || null,
            record.U_WO_Respond1 || null,
            record.U_WO_Respond2 || null,
            record.U_WO_Respond3 || null,
            record.U_WO_NoteOrder || null,
            record.WO_U_DATE || null,
            record.WO_U_Finish || null,
            record.WO_CloseDate || null,
            record.WR_SeriesName || null,
            record.WR_DocNum || null,
            record.WR_CloseDate || null,
            record.WR_Approver || null,
            record.WA_SeriesName || null,
            record.WA_DocNum || null,
            record.WA_FinishDate || null,
            record.WA_PlantoWork || null,
            record.WA_StartWork || null,
            record.WA_CloseDate || null,
            record.U_FinishDate2 || null,
            record.WC_SeriesName || null,
            record.WC_DocNum || null,
            record.WC_CloseDate || null,
            record.WA_MCStop || null,
            record.WA_MCStart || null,
            record.DueMCStop || null,
            record.U_WCOReason1 || null,
            record.U_WCWorkCommit1 || null,
            record.WO_Approver || null,
          ]);
          insertedCount++;
        } catch (err) {
          console.error(`❌ Error inserting record WO-${record.WO_DocNum}:`, err.message);
        }
      }

      console.log(`  📝 Progress: ${Math.min(i + batchSize, records.length)}/${records.length}`);
    }

    console.log('');
    console.log('✅ WO Summary sync completed!');
    console.log(`📊 Total records inserted: ${insertedCount}`);
    console.log('📅 Finished at:', new Date().toLocaleString('th-TH'));

  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
    await pgPool.end();
  }
}

// Run the sync
syncWOSummary();
