/**
 * Script สำหรับ sync PR-WO Link ครั้งแรก
 *
 * วิธีใช้: node scripts/sync-pr-wo-link.mjs
 *
 * Query จะดึงความสัมพันธ์ PR → WO โดยตรงจาก SAP (PRQ1 + PRQ21)
 */

import sql from 'mssql';
import pg from 'pg';

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
  requestTimeout: 120000,
};

// PostgreSQL configuration
const pgConfig = {
  host: '192.168.1.3',
  port: 5432,
  database: 'PR_PO',
  user: 'sa',
  password: '@12345',
};

async function main() {
  let sqlPool = null;
  let pgClient = null;

  try {
    console.log('='.repeat(60));
    console.log('PR-WO Link Initial Sync');
    console.log('='.repeat(60));

    // Connect to SQL Server
    console.log('\n[1/4] Connecting to SQL Server (SAP B1)...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('Connected to SQL Server');

    // Connect to PostgreSQL
    console.log('\n[2/4] Connecting to PostgreSQL...');
    pgClient = new pg.Client(pgConfig);
    await pgClient.connect();
    console.log('Connected to PostgreSQL');

    // Query PR-WO links from SAP
    // FIX: เช็คว่า RefDocNum เป็น WO จริงๆ (SeriesName ขึ้นต้นด้วย 'WO')
    console.log('\n[3/4] Fetching PR-WO links from SAP...');
    const result = await sqlPool.request().query(`
      SELECT DISTINCT
          PR.DocNum AS PRNo,
          WO.DocNum AS WONo
      FROM OPRQ PR
      INNER JOIN PRQ1 T1 ON PR.DocEntry = T1.DocEntry
      INNER JOIN PRQ21 T2 ON T1.DocEntry = T2.DocEntry
      INNER JOIN OPRQ WO ON T2.RefDocEntr = WO.DocEntry
      INNER JOIN NNM1 WO_NNM1 ON WO.Series = WO_NNM1.Series
      WHERE PR.Series IN (SELECT Series FROM NNM1 WHERE BeginStr = 'PR')
        AND WO_NNM1.SeriesName LIKE 'WO%'
      ORDER BY PR.DocNum DESC
    `);

    const records = result.recordset;
    console.log(`Found ${records.length} PR-WO links`);

    if (records.length === 0) {
      console.log('No records to sync');
      return;
    }

    // Show sample records
    console.log('\nSample records (first 10):');
    console.log('-'.repeat(40));
    records.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. PR: ${r.PRNo} -> WO: ${r.WONo}`);
    });

    // Insert into PostgreSQL
    console.log('\n[4/4] Inserting into PostgreSQL...');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      if (!record.PRNo || !record.WONo) {
        skippedCount++;
        continue;
      }

      try {
        await pgClient.query(`
          INSERT INTO pr_wo_link (pr_doc_num, wo_doc_num, last_sync_date, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW(), NOW())
          ON CONFLICT (pr_doc_num, wo_doc_num)
          DO UPDATE SET last_sync_date = NOW(), updated_at = NOW()
        `, [Number(record.PRNo), Number(record.WONo)]);

        insertedCount++;

        // Progress indicator
        if (insertedCount % 100 === 0) {
          process.stdout.write(`  Processed: ${insertedCount}/${records.length}\r`);
        }
      } catch (err) {
        console.error(`Error inserting PR ${record.PRNo} -> WO ${record.WONo}:`, err.message);
        skippedCount++;
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('Sync Complete!');
    console.log('='.repeat(60));
    console.log(`  Total records:   ${records.length}`);
    console.log(`  Inserted/Updated: ${insertedCount}`);
    console.log(`  Skipped:         ${skippedCount}`);

    // Verify count
    const countResult = await pgClient.query('SELECT COUNT(*) as count FROM pr_wo_link');
    console.log(`  Records in DB:   ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  } finally {
    if (sqlPool) {
      await sqlPool.close();
      console.log('\nSQL Server connection closed');
    }
    if (pgClient) {
      await pgClient.end();
      console.log('PostgreSQL connection closed');
    }
  }
}

main();
