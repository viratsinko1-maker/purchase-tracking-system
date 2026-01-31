import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // GET - ดึงรายการ OCR Codes ทั้งหมด
  if (req.method === "GET") {
    try {
      const ocrCodes = await db.ocr_code_and_name.findMany({
        orderBy: { name: 'asc' },
      });

      return res.status(200).json({
        success: true,
        data: ocrCodes,
        total: ocrCodes.length,
      });
    } catch (error) {
      console.error("Get OCR codes error:", error);
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
    }
  }

  // POST - Sync ข้อมูลจาก SAP OUDP
  if (req.method === "POST") {
    const { action } = req.body as { action?: string };

    if (action === "sync") {
      let pool: sql.ConnectionPool | null = null;

      try {
        console.log("[OCR-SYNC] Starting sync from SAP OUDP...");

        // Connect to SQL Server
        pool = await sql.connect(sqlConfig);

        // Query all OUDP records
        const result = await pool.request().query(`
          SELECT Code, Name, Remarks, Father
          FROM OUDP
          WHERE Name IS NOT NULL AND Name != ''
          ORDER BY Name
        `);

        const sapRecords = result.recordset;
        console.log(`[OCR-SYNC] Found ${sapRecords.length} records in SAP OUDP`);

        // Get current records from PostgreSQL
        const currentRecords = await db.ocr_code_and_name.findMany();
        const currentCodesSet = new Set(currentRecords.map(r => r.code));
        const sapCodesSet = new Set(sapRecords.map((r: any) => r.Code));

        let created = 0;
        let updated = 0;
        let deactivated = 0;

        const now = new Date();

        // Upsert records from SAP
        for (const record of sapRecords) {
          const code = record.Code as number;
          const name = String(record.Name).trim();
          const remarks = record.Remarks ? String(record.Remarks).trim() : null;
          const father = record.Father as number | null;

          const existing = currentRecords.find(r => r.code === code);

          if (existing) {
            // Update if changed
            if (existing.name !== name || existing.remarks !== remarks || existing.father !== father) {
              await db.ocr_code_and_name.update({
                where: { code },
                data: {
                  name,
                  remarks,
                  father,
                  lastSyncAt: now,
                },
              });
              updated++;
            }
          } else {
            // Create new record
            await db.ocr_code_and_name.create({
              data: {
                code,
                name,
                remarks,
                father,
                lastSyncAt: now,
                updatedAt: now,
              },
            });
            created++;
          }
        }

        // Find records that exist locally but not in SAP (optional: could delete or mark inactive)
        for (const record of currentRecords) {
          if (!sapCodesSet.has(record.code)) {
            // For now, just count them - not deleting
            deactivated++;
          }
        }

        console.log(`[OCR-SYNC] Sync completed: ${created} created, ${updated} updated, ${deactivated} not in SAP`);

        return res.status(200).json({
          success: true,
          message: `Sync สำเร็จ: สร้างใหม่ ${created} รายการ, อัพเดท ${updated} รายการ`,
          stats: { created, updated, deactivated, total: sapRecords.length },
        });

      } catch (error) {
        console.error("[OCR-SYNC] Sync error:", error);
        return res.status(500).json({
          error: "เกิดข้อผิดพลาดในการ Sync ข้อมูล",
          details: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (pool) {
          await pool.close();
        }
      }
    }

    return res.status(400).json({ error: "Invalid action" });
  }

  // PUT - อัพเดทผู้อนุมัติ
  if (req.method === "PUT") {
    const { id, lineApproverId, costCenterApproverId } = req.body as {
      id: number;
      lineApproverId?: string | null;
      costCenterApproverId?: string | null;
    };

    if (!id) {
      return res.status(400).json({ error: "กรุณาระบุ id" });
    }

    try {
      const updateData: {
        lineApproverId?: string | null;
        costCenterApproverId?: string | null;
      } = {};

      if (lineApproverId !== undefined) {
        updateData.lineApproverId = lineApproverId || null;
      }
      if (costCenterApproverId !== undefined) {
        updateData.costCenterApproverId = costCenterApproverId || null;
      }

      const updatedOcr = await db.ocr_code_and_name.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json({
        success: true,
        data: updatedOcr,
        message: "อัพเดทผู้อนุมัติสำเร็จ",
      });
    } catch (error) {
      console.error("Update OCR approver error:", error);
      return res.status(500).json({
        error: "เกิดข้อผิดพลาดในการอัพเดท",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
