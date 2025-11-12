/**
 * PO Attachment Sync Service
 * ดึงไฟล์แนบของ Purchase Order จาก SAP B1
 */

import sql from 'mssql';
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

export async function syncPOAttachments() {
  let sqlPool: sql.ConnectionPool | null = null;
  const syncStartTime = new Date();

  try {
    console.log('[PO-ATTACHMENT-SYNC] Starting sync...');

    // เชื่อมต่อ SAP B1
    sqlPool = await sql.connect(sqlConfig);

    // Query ดึงเฉพาะ attachment ของ PO พร้อมวันที่อัพโหลด
    const query = `
      SELECT
        T0.AbsEntry AS AttachmentEntry,
        T1.FileName,
        T1.SrcPath,
        T1.TrgtPath,
        T1.FileExt,
        OPOR.DocNum AS DocumentNumber,
        OPOR.DocDate AS DocumentDate
      FROM OATC T0
      INNER JOIN ATC1 T1 ON T0.AbsEntry = T1.AbsEntry
      LEFT JOIN OPOR ON OPOR.AtcEntry = T0.AbsEntry
      WHERE OPOR.DocNum IS NOT NULL
      ORDER BY T0.AbsEntry DESC
    `;

    const result = await sqlPool.request().query(query);
    const sapData = result.recordset;

    console.log(`[PO-ATTACHMENT-SYNC] Fetched ${sapData.length} attachments from SAP`);

    let insertCount = 0;
    let skipCount = 0;

    // Insert attachments (skip duplicates)
    for (const row of sapData) {
      try {
        // แปลง DocumentDate เป็น date string (YYYY-MM-DD)
        const uploadedDate = row.DocumentDate
          ? new Date(row.DocumentDate).toISOString().split('T')[0]
          : null;

        await db.$executeRawUnsafe(`
          INSERT INTO po_attachments (
            po_doc_num,
            attachment_entry,
            file_name,
            src_path,
            trgt_path,
            file_ext,
            uploaded_date,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::DATE, NOW())
          ON CONFLICT (po_doc_num, attachment_entry, file_name)
          DO UPDATE SET
            uploaded_date = EXCLUDED.uploaded_date
        `,
          row.DocumentNumber,
          row.AttachmentEntry,
          row.FileName,
          row.SrcPath,
          row.TrgtPath,
          row.FileExt,
          uploadedDate
        );
        insertCount++;
      } catch (error) {
        skipCount++;
        console.log(`[PO-ATTACHMENT-SYNC] Skipped duplicate: PO ${row.DocumentNumber} - ${row.FileName}`);
      }
    }

    const syncEndTime = new Date();
    const durationSeconds = (syncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[PO-ATTACHMENT-SYNC] ✅ Completed: ${insertCount} inserted, ${skipCount} skipped in ${durationSeconds.toFixed(2)}s`);

    return {
      success: true,
      insertCount,
      skipCount,
      totalFetched: sapData.length,
      durationSeconds,
    };

  } catch (error: any) {
    console.error('[PO-ATTACHMENT-SYNC] ❌ Error:', error);
    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}
