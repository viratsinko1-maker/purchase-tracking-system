/**
 * PR Project Sync Service
 * ดึงข้อมูล Project (รหัสและชื่อโครงการ) ของ PR จาก SAP B1
 * - T1.[Project] = รหัสโครงการที่เก็บใน pr_lines.project
 * - T3.[PrjCode] = รหัสโครงการจาก OPRJ
 * - T3.[PrjName] = ชื่อโครงการจาก OPRJ
 */

import * as sql from 'mssql';
import { db } from '~/server/db';

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
  requestTimeout: 60000,
};

export async function syncPRProjects() {
  let sqlPool: sql.ConnectionPool | null = null;
  const syncStartTime = new Date();

  try {
    console.log('[PR-PROJECT-SYNC] Starting sync...');

    // เชื่อมต่อ SAP B1
    sqlPool = await sql.connect(sqlConfig);

    // Query ดึง Project info จาก SAP B1
    // LEFT JOIN OPRJ เพื่อดึงชื่อโครงการจาก PrjCode
    const query = `
      SELECT
        T0.[DocNum] AS DocNum,
        T1.[LineNum] AS LineNum,
        T3.[PrjCode] AS PrjCode,
        T3.[PrjName] AS PrjName
      FROM
        OPRQ T0
        INNER JOIN PRQ1 T1 ON T0.[DocEntry] = T1.[DocEntry]
        LEFT JOIN OPRJ T3 ON T1.[Project] = T3.[PrjCode]
      WHERE
        T3.[PrjCode] IS NOT NULL
        AND T3.[PrjCode] <> ''
      ORDER BY T0.[DocNum] DESC, T1.[LineNum] ASC
    `;

    const result = await sqlPool.request().query(query);
    const sapData = result.recordset;

    console.log(`[PR-PROJECT-SYNC] Fetched ${sapData.length} project records from SAP`);

    let insertCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    // Upsert project links
    for (const row of sapData) {
      try {
        const result = await db.$executeRawUnsafe(`
          INSERT INTO pr_project_link (
            pr_doc_num,
            line_num,
            prj_code,
            prj_name,
            last_sync_date,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
          ON CONFLICT (pr_doc_num, line_num)
          DO UPDATE SET
            prj_code = EXCLUDED.prj_code,
            prj_name = EXCLUDED.prj_name,
            last_sync_date = NOW(),
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `,
          row.DocNum,
          row.LineNum,
          row.PrjCode,
          row.PrjName
        );

        // xmax = 0 หมายความว่าเป็น INSERT (ไม่ใช่ UPDATE)
        if (result && Array.isArray(result) && result[0] && 'inserted' in result[0] && result[0].inserted) {
          insertCount++;
        } else {
          updateCount++;
        }
      } catch (error) {
        skipCount++;
        console.log(`[PR-PROJECT-SYNC] Error on PR ${row.DocNum} line ${row.LineNum}:`, error);
      }
    }

    const syncEndTime = new Date();
    const durationSeconds = (syncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[PR-PROJECT-SYNC] ✅ Completed: ${insertCount} inserted, ${updateCount} updated, ${skipCount} skipped in ${durationSeconds.toFixed(2)}s`);

    return {
      success: true,
      insertCount,
      updateCount,
      skipCount,
      totalFetched: sapData.length,
      durationSeconds,
    };

  } catch (error: any) {
    console.error('[PR-PROJECT-SYNC] ❌ Error:', error);
    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}
