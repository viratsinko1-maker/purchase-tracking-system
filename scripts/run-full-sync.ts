import { PrismaClient } from '@prisma/client';
import sql from 'mssql';

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

async function syncPR() {
  let sqlPool: sql.ConnectionPool | null = null;
  const syncStartTime = new Date();

  try {
    console.log('\n🔄 [PR SYNC] Starting FULL sync...');

    // เชื่อมต่อ SAP B1
    sqlPool = await sql.connect(sqlConfig);

    // Query จาก SAP
    const query = `
      SELECT
        T0.[DocNum], T0.[DocDate], T0.[DocDueDate], T1.[ItemCode], T1.[Dscription],
        T1.[Quantity], T0.[DocStatus], T0.[UpdateDate], T0.[CreateDate],
        T0.[ReqDate], T0.[CANCELED], T1.[LineStatus], T1.[TargetType], T1.[LineNum],
        T2.[PrjName] AS JobName, T3.[Name] AS DepartmentName,
        T0.[ReqName] AS ReqName
      FROM
        OPRQ T0
        INNER JOIN PRQ1 T1 ON T0.[DocEntry] = T1.[DocEntry]
        LEFT JOIN OPRJ T2 ON T0.[Project] = T2.[PrjCode]
        LEFT JOIN OUDP T3 ON T0.[BPLId] = T3.[Code]
      ORDER BY
        T0.[DocNum]
    `;

    const result = await sqlPool.request().query(query);
    const sapData = result.recordset;

    console.log(`[PR SYNC] Fetched ${sapData.length} records from SAP`);

    // จัดกลุ่มข้อมูล
    const prMap = new Map();

    sapData.forEach((row: any) => {
      const docNum = row.DocNum;

      if (!prMap.has(docNum)) {
        prMap.set(docNum, {
          doc_num: docNum,
          doc_date: row.DocDate,
          doc_due_date: row.DocDueDate,
          doc_status: row.DocStatus,
          update_date: row.UpdateDate,
          create_date: row.CreateDate,
          req_date: row.ReqDate,
          canceled: row.CANCELED,
          job_name: row.JobName,
          department_name: row.DepartmentName,
          req_name: row.ReqName,
          lines: [],
        });
      }

      prMap.get(docNum).lines.push({
        line_num: row.LineNum || 0,
        item_code: row.ItemCode,
        description: row.Dscription,
        quantity: row.Quantity,
        line_status: row.LineStatus,
        target_type: row.TargetType,
      });
    });

    // บันทึกลง PostgreSQL
    let prCount = 0;
    let lineCount = 0;

    for (const [docNum, prData] of prMap.entries()) {
      // Upsert pr_master
      await prisma.$executeRawUnsafe(`
        INSERT INTO pr_master (
          doc_num, doc_date, doc_due_date, doc_status, update_date,
          create_date, req_date, canceled, job_name,
          department_name, req_name, last_sync_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (doc_num) DO UPDATE SET
          doc_date = EXCLUDED.doc_date,
          doc_due_date = EXCLUDED.doc_due_date,
          doc_status = EXCLUDED.doc_status,
          update_date = EXCLUDED.update_date,
          create_date = EXCLUDED.create_date,
          req_date = EXCLUDED.req_date,
          canceled = EXCLUDED.canceled,
          job_name = EXCLUDED.job_name,
          department_name = EXCLUDED.department_name,
          req_name = EXCLUDED.req_name,
          last_sync_date = NOW()
      `,
        prData.doc_num,
        prData.doc_date,
        prData.doc_due_date,
        prData.doc_status,
        prData.update_date,
        prData.create_date,
        prData.req_date,
        prData.canceled,
        prData.job_name,
        prData.department_name,
        prData.req_name
      );
      prCount++;

      // Upsert pr_lines
      for (const line of prData.lines) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO pr_lines (
            pr_doc_num, line_num, item_code, description, quantity,
            line_status, target_type, last_sync_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (pr_doc_num, line_num, description) DO UPDATE SET
            item_code = EXCLUDED.item_code,
            quantity = EXCLUDED.quantity,
            line_status = EXCLUDED.line_status,
            target_type = EXCLUDED.target_type,
            last_sync_date = NOW()
        `,
          docNum,
          line.line_num,
          line.item_code,
          line.description,
          line.quantity,
          line.line_status,
          line.target_type
        );
        lineCount++;
      }
    }

    // Refresh materialized view
    console.log('[PR SYNC] Refreshing materialized view...');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary');

    const syncEndTime = new Date();
    const durationSeconds = (syncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    // บันทึก sync log
    await prisma.$executeRawUnsafe(`
      INSERT INTO sync_log (
        sync_date, sync_type, records_synced, duration_seconds, status
      ) VALUES (NOW(), 'FULL', $1, $2, 'success')
    `, prCount + lineCount, durationSeconds);

    console.log(`✅ [PR SYNC] Completed: ${prCount} PRs, ${lineCount} lines in ${durationSeconds.toFixed(2)}s\n`);

    return { prCount, lineCount, durationSeconds };

  } catch (error: any) {
    console.error('❌ [PR SYNC] Error:', error);

    // บันทึก error log
    await prisma.$executeRawUnsafe(`
      INSERT INTO sync_log (
        sync_date, sync_type, status, error_message
      ) VALUES (NOW(), 'FULL', 'failed', $1)
    `, error.message);

    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

async function syncPO() {
  let sqlPool: sql.ConnectionPool | null = null;
  const syncStartTime = new Date();

  try {
    console.log('🔄 [PO SYNC] Starting FULL sync...');

    // เชื่อมต่อ SAP B1
    sqlPool = await sql.connect(sqlConfig);

    // Query จาก SAP
    const query = `
      SELECT
        T0.[DocNum], T0.[DocDate], T0.[DocDueDate], T1.[ItemCode], T1.[Dscription],
        T1.[Quantity], T0.[DocStatus], T0.[UpdateDate], T0.[CreateDate],
        T0.[ReqDate], T0.[CancelDate], T0.[CANCELED], T1.[LineStatus], T1.[BaseRef], T1.[LineNum]
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
      });
    });

    // บันทึกลง PostgreSQL
    let poCount = 0;
    let lineCount = 0;

    for (const [docNum, poData] of poMap.entries()) {
      // Upsert po_master
      await prisma.$executeRawUnsafe(`
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
        await prisma.$executeRawUnsafe(`
          INSERT INTO po_lines (
            po_doc_num, line_num, item_code, description, quantity,
            line_status, base_ref, last_sync_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (po_doc_num, line_num, description) DO UPDATE SET
            item_code = EXCLUDED.item_code,
            quantity = EXCLUDED.quantity,
            line_status = EXCLUDED.line_status,
            base_ref = EXCLUDED.base_ref,
            last_sync_date = NOW()
        `,
          docNum,
          line.line_num,
          line.item_code,
          line.description,
          line.quantity,
          line.line_status,
          line.base_ref
        );
        lineCount++;
      }
    }

    // Refresh materialized view
    console.log('[PO SYNC] Refreshing materialized view...');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_po_summary');

    const syncEndTime = new Date();
    const durationSeconds = (syncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    // บันทึก sync log
    await prisma.$executeRawUnsafe(`
      INSERT INTO po_sync_log (
        sync_date, sync_type, records_synced, duration_seconds, status
      ) VALUES (NOW(), 'FULL', $1, $2, 'success')
    `, poCount + lineCount, durationSeconds);

    console.log(`✅ [PO SYNC] Completed: ${poCount} POs, ${lineCount} lines in ${durationSeconds.toFixed(2)}s\n`);

    return { poCount, lineCount, durationSeconds };

  } catch (error: any) {
    console.error('❌ [PO SYNC] Error:', error);

    // บันทึก error log
    await prisma.$executeRawUnsafe(`
      INSERT INTO po_sync_log (
        sync_date, sync_type, status, error_message
      ) VALUES (NOW(), 'FULL', 'failed', $1)
    `, error.message);

    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('🚀 Starting Full Sync for PR and PO');
  console.log('═══════════════════════════════════════════════\n');

  const totalStartTime = new Date();

  try {
    // Sync PR
    const prResult = await syncPR();

    // Sync PO
    const poResult = await syncPO();

    const totalEndTime = new Date();
    const totalDuration = (totalEndTime.getTime() - totalStartTime.getTime()) / 1000;

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Full Sync Completed Successfully!');
    console.log('═══════════════════════════════════════════════');
    console.log(`📊 PR: ${prResult.prCount} PRs, ${prResult.lineCount} lines (${prResult.durationSeconds.toFixed(2)}s)`);
    console.log(`📦 PO: ${poResult.poCount} POs, ${poResult.lineCount} lines (${poResult.durationSeconds.toFixed(2)}s)`);
    console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════');
    console.error('❌ Full Sync Failed!');
    console.error('═══════════════════════════════════════════════');
    console.error('Error:', error);
    console.error('═══════════════════════════════════════════════\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
main()
  .then(() => {
    console.log('👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
