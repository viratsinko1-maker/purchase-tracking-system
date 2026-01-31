/**
 * Script สำหรับ sync WO PO Detail (Purchase Order) จาก SAP ไปยัง PostgreSQL
 * ดึงรายละเอียด PO ที่เชื่อมกับ WO ผ่าน PR
 *
 * Flow: WO (OPRQ) -> PR (OPRQ via PRQ21) -> PO (OPOR via POR21)
 *
 * Usage: node scripts/sync-wo-po-detail.mjs
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
  requestTimeout: 600000, // 10 minutes for large queries
};

// PostgreSQL configuration
const pgPool = new Pool({
  host: '192.168.1.3',
  port: 5432,
  database: 'PR_PO',
  user: 'sa',
  password: '@12345',
});

async function syncWOPODetail() {
  console.log('🚀 Starting WO PO Detail sync...');
  console.log('📅 Time:', new Date().toLocaleString('th-TH'));

  let sqlPool = null;

  try {
    // Connect to SQL Server
    console.log('📡 Connecting to SQL Server...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');

    // Query: หา PO ที่ link กับ WO ผ่าน PR แล้วดึงทุก lines ของ PO เหล่านั้น
    // รวมวันที่รับของจากทั้ง GRPO (OPDN) และ A/P Invoice (OPCH)
    // FIX: ใช้ subquery เพื่อดึง GRPO date แรกของแต่ละ PO line เพื่อป้องกัน duplicate records
    console.log('🔍 Querying WO PO Detail from SAP...');
    const result = await sqlPool.request().query(`
      WITH WO_PO_Link AS (
        -- หา PO ที่ link กับ WO ผ่าน PR (โดยใช้ BaseRef ที่เก็บ PR DocNum)
        SELECT DISTINCT
          WO.DocNum AS WO_DocNum,
          WO_NNM1.SeriesName AS WO_SeriesName,
          PR.DocNum AS PR_DocNum,
          PR_NNM1.SeriesName AS PR_SeriesName,
          PR.ReqName AS Requester,
          PO.DocEntry AS PO_DocEntry
        FROM OPRQ WO
        INNER JOIN NNM1 WO_NNM1 ON WO.Series = WO_NNM1.Series
        INNER JOIN PRQ21 ON WO.DocEntry = PRQ21.RefDocEntr AND PRQ21.RefObjType = WO.ObjType
        INNER JOIN OPRQ PR ON PRQ21.DocEntry = PR.DocEntry
        INNER JOIN NNM1 PR_NNM1 ON PR.Series = PR_NNM1.Series
        INNER JOIN POR1 ON PR.DocNum = POR1.BaseRef AND POR1.BaseType = 1470000113
        INNER JOIN OPOR PO ON POR1.DocEntry = PO.DocEntry
        WHERE WO_NNM1.BeginStr LIKE 'WO%'
      ),
      -- Subquery: ดึง GRPO date แรกของแต่ละ PO line (ป้องกัน duplicate จาก partial delivery)
      GRPO_First AS (
        SELECT
          PDN1.BaseEntry AS PO_DocEntry,
          PDN1.BaseLine AS PO_LineNum,
          MIN(OPDN.DocDate) AS GRPO_DocDate,
          MIN(OPDN.DocNum) AS GRPO_DocNum
        FROM PDN1
        INNER JOIN OPDN ON PDN1.DocEntry = OPDN.DocEntry
        WHERE PDN1.BaseType = 22  -- PO
        GROUP BY PDN1.BaseEntry, PDN1.BaseLine
      ),
      -- Subquery: ดึง A/P Invoice date แรกของแต่ละ PO line (กรณีไม่มี GRPO)
      APINV_First AS (
        SELECT
          PCH1.BaseEntry AS PO_DocEntry,
          PCH1.BaseLine AS PO_LineNum,
          MIN(OPCH.DocDate) AS APINV_DocDate,
          MIN(OPCH.DocNum) AS APINV_DocNum
        FROM PCH1
        INNER JOIN OPCH ON PCH1.DocEntry = OPCH.DocEntry
        WHERE PCH1.BaseType = 22  -- PO
        GROUP BY PCH1.BaseEntry, PCH1.BaseLine
      )
      SELECT
        WPL.WO_DocNum,
        WPL.WO_SeriesName,
        WPL.PR_DocNum,
        WPL.PR_SeriesName,
        WPL.Requester,
        PO.DocNum AS PO_DocNum,
        PO.DocDate AS PO_DocDate,
        PO.Canceled AS PO_Canceled,
        POR1.LineNum AS PO_LineNum,
        POR1.ItemCode,
        POR1.Dscription AS Description,
        POR1.Quantity,
        POR1.unitMsr AS UnitMsr,
        POR1.LineTotal,
        POR1.Price,
        -- ดึงวันที่รับของจาก GRPO หรือ A/P Invoice (ใช้อันที่มีก่อน)
        COALESCE(GRPO.GRPO_DocDate, APINV.APINV_DocDate) AS GRPO_DocDate,
        COALESCE(GRPO.GRPO_DocNum, APINV.APINV_DocNum) AS GRPO_DocNum
      FROM WO_PO_Link WPL
      INNER JOIN OPOR PO ON WPL.PO_DocEntry = PO.DocEntry
      INNER JOIN POR1 ON PO.DocEntry = POR1.DocEntry
      -- GRPO (Goods Receipt PO) - ใช้ subquery ที่ GROUP BY แล้ว
      LEFT JOIN GRPO_First GRPO ON POR1.DocEntry = GRPO.PO_DocEntry AND POR1.LineNum = GRPO.PO_LineNum
      -- A/P Invoice - ใช้ subquery ที่ GROUP BY แล้ว
      LEFT JOIN APINV_First APINV ON POR1.DocEntry = APINV.PO_DocEntry AND POR1.LineNum = APINV.PO_LineNum
      ORDER BY WPL.WO_DocNum DESC, PO.DocNum ASC, POR1.LineNum ASC
    `);

    const records = result.recordset;
    console.log(`📊 Fetched ${records.length} WO PO Detail records from SAP`);

    if (records.length === 0) {
      console.log('⚠️ No WO PO Detail records found');
      return;
    }

    // Check if wo_po_detail table exists, if not create it
    console.log('🔧 Checking/Creating wo_po_detail table...');
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS wo_po_detail (
        id SERIAL PRIMARY KEY,
        wo_doc_num INT NOT NULL,
        wo_series_name VARCHAR(50),
        pr_doc_num INT,
        pr_series_name VARCHAR(50),
        po_doc_num INT NOT NULL,
        po_doc_date DATE,
        po_canceled VARCHAR(1),
        po_line_num INT,
        item_code VARCHAR(100),
        description TEXT,
        quantity DECIMAL(19,6),
        unit_msr VARCHAR(50),
        price DECIMAL(19,6),
        line_total DECIMAL(19,6),
        requester VARCHAR(255),
        grpo_doc_num INT,
        grpo_doc_date DATE,
        last_sync_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wo_po_detail_wo_doc_num ON wo_po_detail(wo_doc_num);
      CREATE INDEX IF NOT EXISTS idx_wo_po_detail_po_doc_num ON wo_po_detail(po_doc_num);
    `);

    // Clear old data
    console.log('🗑️ Clearing old WO PO Detail data...');
    await pgPool.query('DELETE FROM wo_po_detail');
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
            INSERT INTO wo_po_detail (
              wo_doc_num, wo_series_name, pr_doc_num, pr_series_name,
              po_doc_num, po_doc_date, po_canceled, po_line_num,
              item_code, description, quantity, unit_msr, price, line_total,
              requester, grpo_doc_num, grpo_doc_date, last_sync_date
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11, $12, $13, $14,
              $15, $16, $17, NOW()
            )
          `, [
            record.WO_DocNum,
            record.WO_SeriesName || null,
            record.PR_DocNum || null,
            record.PR_SeriesName || null,
            record.PO_DocNum,
            record.PO_DocDate || null,
            record.PO_Canceled || null,
            record.PO_LineNum || null,
            record.ItemCode || null,
            record.Description || null,
            record.Quantity || null,
            record.UnitMsr || null,
            record.Price || null,
            record.LineTotal || null,
            record.Requester || null,
            record.GRPO_DocNum || null,
            record.GRPO_DocDate || null,
          ]);
          insertedCount++;
        } catch (err) {
          console.error(`❌ Error inserting record WO-${record.WO_DocNum} PO-${record.PO_DocNum} Line-${record.PO_LineNum}:`, err.message);
        }
      }

      console.log(`  📝 Progress: ${Math.min(i + batchSize, records.length)}/${records.length}`);
    }

    console.log('');
    console.log('✅ WO PO Detail sync completed!');
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
syncWOPODetail();
