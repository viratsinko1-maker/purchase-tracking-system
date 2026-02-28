import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import sql from "mssql";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

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

async function handler(
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
    const { action, userId: adminUserId, userName: adminUserName } = req.body as {
      action?: string;
      userId?: string;
      userName?: string;
    };

    // Manual create
    if (action === "create") {
      const { code, name, remarks } = req.body as {
        code?: number;
        name?: string;
        remarks?: string;
      };

      if (!code || !name) {
        return res.status(400).json({ error: "กรุณาระบุ code และ name" });
      }

      try {
        // Check duplicate code
        const existingCode = await db.ocr_code_and_name.findUnique({ where: { code } });
        if (existingCode) {
          return res.status(400).json({ error: `รหัส code ${code} มีอยู่แล้ว (${existingCode.name})` });
        }

        // Check duplicate name
        const existingName = await db.ocr_code_and_name.findUnique({ where: { name: name.trim() } });
        if (existingName) {
          return res.status(400).json({ error: `ชื่อ OCR "${name.trim()}" มีอยู่แล้ว (code: ${existingName.code})` });
        }

        const now = new Date();
        const created = await db.ocr_code_and_name.create({
          data: {
            code,
            name: name.trim(),
            remarks: remarks?.trim() || null,
            updatedAt: now,
          },
        });

        // Audit log
        createAuditLog(db, {
          userId: adminUserId,
          userName: adminUserName,
          action: AuditAction.CREATE,
          tableName: "ocr_code_and_name",
          recordId: String(created.id),
          newValues: { code, name: name.trim(), remarks: remarks?.trim() || null },
          description: `เพิ่มรหัสแผนกด้วยมือ: ${name.trim()} (code: ${code})`,
          ipAddress: getIpFromRequest(req),
        }).catch(console.error);

        return res.status(201).json({
          success: true,
          data: created,
          message: `สร้างรหัสแผนก ${name.trim()} สำเร็จ`,
        });
      } catch (error) {
        console.error("Create OCR code error:", error);
        return res.status(500).json({
          error: "เกิดข้อผิดพลาดในการสร้างรหัสแผนก",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

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

        // Audit log: Sync OCR codes
        createAuditLog(db, {
          userId: adminUserId,
          userName: adminUserName,
          action: AuditAction.SYNC_DATA,
          tableName: "ocr_code_and_name",
          description: `Sync OCR Codes จาก SAP: สร้างใหม่ ${created}, อัพเดท ${updated}`,
          metadata: { created, updated, deactivated, totalFromSAP: sapRecords.length },
          ipAddress: getIpFromRequest(req),
        }).catch(console.error);

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

      // Get old values first
      const oldOcr = await db.ocr_code_and_name.findUnique({ where: { id } });

      const updatedOcr = await db.ocr_code_and_name.update({
        where: { id },
        data: updateData,
      });

      // Audit log: Update OCR approver
      createAuditLog(db, {
        action: AuditAction.UPDATE,
        tableName: "ocr_code_and_name",
        recordId: String(id),
        oldValues: oldOcr ? {
          lineApproverId: oldOcr.lineApproverId,
          costCenterApproverId: oldOcr.costCenterApproverId,
        } : undefined,
        newValues: {
          lineApproverId: updatedOcr.lineApproverId,
          costCenterApproverId: updatedOcr.costCenterApproverId,
        },
        description: `อัพเดทผู้อนุมัติ OCR Code: ${updatedOcr.name}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

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

  // DELETE - ลบรหัสแผนก (เฉพาะที่ไม่มีสมาชิกและผู้อนุมัติ)
  if (req.method === "DELETE") {
    const { id, userId: adminUserId, userName: adminUserName } = req.body as {
      id?: number;
      userId?: string;
      userName?: string;
    };

    if (!id) {
      return res.status(400).json({ error: "กรุณาระบุ id" });
    }

    try {
      // Check if OCR code exists
      const ocrCode = await db.ocr_code_and_name.findUnique({ where: { id } });
      if (!ocrCode) {
        return res.status(404).json({ error: "ไม่พบรหัสแผนกนี้" });
      }

      // Check for members
      const memberCount = await db.ocr_user_assignment.count({
        where: { ocrCodeId: id },
      });
      if (memberCount > 0) {
        return res.status(400).json({
          error: `ไม่สามารถลบได้ — มีสมาชิกอยู่ ${memberCount} คน กรุณาลบสมาชิกออกก่อน`,
        });
      }

      // Check for approvers
      const approverCount = await db.ocr_approver.count({
        where: { ocrCodeId: id },
      });
      if (approverCount > 0) {
        return res.status(400).json({
          error: `ไม่สามารถลบได้ — มีผู้อนุมัติอยู่ ${approverCount} คน กรุณาลบผู้อนุมัติออกก่อน`,
        });
      }

      // Delete
      await db.ocr_code_and_name.delete({ where: { id } });

      // Audit log
      createAuditLog(db, {
        userId: adminUserId,
        userName: adminUserName,
        action: AuditAction.DELETE,
        tableName: "ocr_code_and_name",
        recordId: String(id),
        oldValues: { code: ocrCode.code, name: ocrCode.name, remarks: ocrCode.remarks },
        description: `ลบรหัสแผนก: ${ocrCode.name} (code: ${ocrCode.code})`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({
        success: true,
        message: `ลบรหัสแผนก ${ocrCode.name} สำเร็จ`,
      });
    } catch (error) {
      console.error("Delete OCR code error:", error);
      return res.status(500).json({
        error: "เกิดข้อผิดพลาดในการลบรหัสแผนก",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// Apply permission middleware - protect admin workflow/OCR codes management
// GET ไม่ต้อง check permission — ทุก role ต้องใช้ชื่อแผนกในหน้า pr-tracking
export default withMethodPermissions(handler, {
  POST: { tableName: 'admin_workflow', action: 'sync' },
  PUT: { tableName: 'admin_workflow', action: 'update' },
  DELETE: { tableName: 'admin_workflow', action: 'delete' },
});
