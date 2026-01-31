/**
 * Script สำหรับ sync WO GI Detail (Goods Issue) จาก SAP ไปยัง PostgreSQL
 * ลบข้อมูลทั้งหมดแล้วดึงใหม่
 *
 * Usage: node scripts/sync-wo-gi-detail.mjs
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
  requestTimeout: 300000, // 5 minutes for large queries
};

// PostgreSQL configuration
const pgPool = new Pool({
  host: '192.168.1.3',
  port: 5432,
  database: 'PR_PO',
  user: 'sa',
  password: '@12345',
});

async function syncWOGIDetail() {
  console.log('🚀 Starting WO GI Detail sync...');
  console.log('📅 Time:', new Date().toLocaleString('th-TH'));

  let sqlPool = null;

  try {
    // Connect to SQL Server
    console.log('📡 Connecting to SQL Server...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');

    // Query WO GI Detail data
    console.log('🔍 Querying WO GI Detail from SAP...');
    const result = await sqlPool.request().query(`
      SELECT
        T7.SeriesName AS WO_SeriesName,
        T7.BeginStr AS WO_BeginStr,
        T4.RefDocNum AS WO_RefDocNum,
        T0.DocNum AS GI_DocNum,
        T0.DocDate AS GI_DocDate,
        T5.DocDate AS WTQ_DocDate,
        T2.ItemCode,
        T2.Dscription AS Description,
        T2.OcrCode,
        T2.OcrCode2,
        T2.OcrCode4 AS Machine,
        T2.Project,
        P0.OcrName AS OcrName,
        P2.OcrName AS OcrName2,
        T2.Quantity,
        T2.unitMsr,
        T2.INMPrice,
        T2.StockSum,
        T2.StockValue,
        T0.U_IN_EmpName AS EmpName,
        T6.U_U_PR_FOR AS PR_FOR
      FROM OIGE T0
      INNER JOIN NNM1 T1 ON T0.Series = T1.Series
      INNER JOIN IGE1 T2 ON T0.DocEntry = T2.DocEntry
      INNER JOIN IGE21 T3 ON T0.DocEntry = T3.DocEntry
      INNER JOIN WTQ21 T4 ON T3.RefDocEntr = T4.DocEntry AND T3.RefObjType = T4.ObjectType
      INNER JOIN OWTQ T5 ON T4.DocEntry = T5.DocEntry
      INNER JOIN OPRQ T6 ON T4.RefDocEntr = T6.DocEntry AND T4.RefObjType = T6.ObjType
      INNER JOIN NNM1 T7 ON T6.Series = T7.Series
      LEFT OUTER JOIN OOCR P0 ON T2.OcrCode = P0.OcrCode
      LEFT OUTER JOIN OOCR P2 ON T2.OcrCode2 = P2.OcrCode
      WHERE T7.BeginStr NOT IN ('PR', 'WR')
      ORDER BY T4.RefDocNum DESC, T0.DocNum DESC
    `);

    const records = result.recordset;
    console.log(`📊 Fetched ${records.length} WO GI Detail records from SAP`);

    if (records.length === 0) {
      console.log('⚠️ No WO GI Detail records found');
      return;
    }

    // Clear old data
    console.log('🗑️ Clearing old WO GI Detail data...');
    await pgPool.query('DELETE FROM wo_gi_detail');
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
            INSERT INTO wo_gi_detail (
              wo_doc_num, wo_series_name, gi_doc_num, gi_doc_date, wtq_doc_date,
              item_code, description, quantity, unit_msr, inm_price, stock_value,
              ocr_code, ocr_code2, ocr_name, ocr_name2, ocr_code4, project,
              emp_name, pr_for, last_sync_date
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17,
              $18, $19, NOW()
            )
          `, [
            record.WO_RefDocNum,
            record.WO_SeriesName || null,
            record.GI_DocNum,
            record.GI_DocDate || null,
            record.WTQ_DocDate || null,
            record.ItemCode || null,
            record.Description || null,
            record.Quantity || null,
            record.unitMsr || null,
            record.INMPrice || null,
            record.StockValue || null,
            record.OcrCode || null,
            record.OcrCode2 || null,
            record.OcrName || null,
            record.OcrName2 || null,
            record.Machine || null,
            record.Project || null,
            record.EmpName || null,
            record.PR_FOR || null,
          ]);
          insertedCount++;
        } catch (err) {
          console.error(`❌ Error inserting record WO-${record.WO_RefDocNum} GI-${record.GI_DocNum}:`, err.message);
        }
      }

      console.log(`  📝 Progress: ${Math.min(i + batchSize, records.length)}/${records.length}`);
    }

    console.log('');
    console.log('✅ WO GI Detail sync completed!');
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
syncWOGIDetail();
