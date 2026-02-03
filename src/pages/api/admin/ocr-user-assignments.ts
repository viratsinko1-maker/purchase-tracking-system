import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // GET - ดึงรายการ assignments ทั้งหมด หรือ ตาม ocrCodeId
    if (req.method === "GET") {
      const { ocrCodeId, all } = req.query;

      // ดึงทุก assignments พร้อมข้อมูล user (สำหรับ approver tab)
      if (all === "true") {
        const assignments = await db.ocr_user_assignment.findMany({
          orderBy: {
            ocrCodeId: "asc",
          },
        });

        // ดึงข้อมูล user ทั้งหมดที่เกี่ยวข้อง
        const userIds = [...new Set(assignments.map((a) => a.userProductionId))];
        const users = await db.user_production.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            role: true,
            isActive: true,
          },
        });

        // Map users to assignments
        const assignmentsWithUsers = assignments.map((assignment) => {
          const user = users.find((u) => u.id === assignment.userProductionId);
          return {
            ...assignment,
            user,
          };
        });

        return res.status(200).json({
          success: true,
          data: assignmentsWithUsers,
        });
      }

      if (ocrCodeId) {
        // ดึง assignments สำหรับ OCR code เฉพาะ พร้อมข้อมูล user
        const assignments = await db.ocr_user_assignment.findMany({
          where: {
            ocrCodeId: parseInt(ocrCodeId as string),
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        // ดึงข้อมูล user สำหรับแต่ละ assignment
        const userIds = assignments.map((a) => a.userProductionId);
        const users = await db.user_production.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            role: true,
            isActive: true,
          },
        });

        // Map users to assignments
        const assignmentsWithUsers = assignments.map((assignment) => {
          const user = users.find((u) => u.id === assignment.userProductionId);
          return {
            ...assignment,
            user,
          };
        });

        return res.status(200).json({
          success: true,
          data: assignmentsWithUsers,
        });
      }

      // ดึง assignments ทั้งหมด พร้อม count per OCR code
      const assignmentCounts = await db.ocr_user_assignment.groupBy({
        by: ["ocrCodeId"],
        _count: {
          id: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: assignmentCounts.map((item) => ({
          ocrCodeId: item.ocrCodeId,
          count: item._count.id,
        })),
      });
    }

    // POST - เพิ่ม user เข้า OCR code
    if (req.method === "POST") {
      const { ocrCodeId, userProductionId, role, createdBy } = req.body as {
        ocrCodeId: number;
        userProductionId: string;
        role?: string;
        createdBy?: string;
      };

      if (!ocrCodeId || !userProductionId) {
        return res.status(400).json({
          error: "กรุณาระบุ ocrCodeId และ userProductionId",
        });
      }

      // ตรวจสอบว่า OCR code มีอยู่จริง
      const ocrCode = await db.ocr_code_and_name.findUnique({
        where: { id: ocrCodeId },
      });

      if (!ocrCode) {
        return res.status(404).json({
          error: "ไม่พบ OCR Code ที่ระบุ",
        });
      }

      // ตรวจสอบว่า user มีอยู่จริง
      const user = await db.user_production.findUnique({
        where: { id: userProductionId },
      });

      if (!user) {
        return res.status(404).json({
          error: "ไม่พบผู้ใช้ที่ระบุ",
        });
      }

      // ตรวจสอบว่ายังไม่มี assignment นี้อยู่แล้ว
      const existingAssignment = await db.ocr_user_assignment.findUnique({
        where: {
          ocrCodeId_userProductionId: {
            ocrCodeId,
            userProductionId,
          },
        },
      });

      if (existingAssignment) {
        return res.status(400).json({
          error: "ผู้ใช้นี้ถูกเพิ่มในแผนกนี้แล้ว",
        });
      }

      // สร้าง assignment ใหม่
      const assignment = await db.ocr_user_assignment.create({
        data: {
          ocrCodeId,
          userProductionId,
          role: role || "member",
          createdBy,
          updatedAt: new Date(),
        },
      });

      // Audit log: Create OCR user assignment
      createAuditLog(db, {
        userName: createdBy,
        action: AuditAction.CREATE,
        tableName: "ocr_user_assignment",
        recordId: String(assignment.id),
        newValues: {
          ocrCodeId,
          ocrCodeName: ocrCode.remarks || ocrCode.name,
          userProductionId,
          userName: user.username || user.email,
          role: role || "member",
        },
        description: `เพิ่มผู้ใช้ ${user.username || user.email} เข้าแผนก ${ocrCode.remarks || ocrCode.name}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(201).json({
        success: true,
        data: assignment,
        message: `เพิ่ม ${user.username || user.email} เข้าแผนก ${ocrCode.remarks || ocrCode.name} สำเร็จ`,
      });
    }

    // PUT - อัพเดท role ของ assignment
    if (req.method === "PUT") {
      const { id, role } = req.body as {
        id: number;
        role: string;
      };

      if (!id || !role) {
        return res.status(400).json({
          error: "กรุณาระบุ id และ role",
        });
      }

      const oldAssignment = await db.ocr_user_assignment.findUnique({ where: { id } });

      const updatedAssignment = await db.ocr_user_assignment.update({
        where: { id },
        data: { role },
      });

      // Audit log: Update OCR user assignment role
      createAuditLog(db, {
        action: AuditAction.UPDATE,
        tableName: "ocr_user_assignment",
        recordId: String(id),
        oldValues: { role: oldAssignment?.role },
        newValues: { role },
        description: `อัพเดท role: ${oldAssignment?.role} → ${role}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({
        success: true,
        data: updatedAssignment,
      });
    }

    // DELETE - ลบ user ออกจาก OCR code
    if (req.method === "DELETE") {
      const { id } = req.body as { id: number };

      if (!id) {
        return res.status(400).json({
          error: "กรุณาระบุ id",
        });
      }

      // Get assignment before delete for audit log
      const assignmentToDelete = await db.ocr_user_assignment.findUnique({ where: { id } });

      await db.ocr_user_assignment.delete({
        where: { id },
      });

      // Audit log: Delete OCR user assignment
      createAuditLog(db, {
        action: AuditAction.DELETE,
        tableName: "ocr_user_assignment",
        recordId: String(id),
        oldValues: assignmentToDelete ? {
          ocrCodeId: assignmentToDelete.ocrCodeId,
          userProductionId: assignmentToDelete.userProductionId,
          role: assignmentToDelete.role,
        } : undefined,
        description: `ลบผู้ใช้ออกจากแผนก`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({
        success: true,
        message: "ลบผู้ใช้ออกจากแผนกสำเร็จ",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("OCR user assignment error:", error);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาด",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Apply permission middleware - protect admin OCR user assignments (member management)
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_workflow', action: 'read' },
  POST: { tableName: 'admin_ocr_member', action: 'update' },
  PUT: { tableName: 'admin_ocr_member', action: 'update' },
  DELETE: { tableName: 'admin_ocr_member', action: 'update' },
});
