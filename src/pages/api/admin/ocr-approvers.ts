import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";

interface Approver {
  id: number;
  ocrCodeId: number;
  userProductionId: string;
  approverType: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  user?: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    isActive: boolean;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // GET - ดึงรายการ approvers
    if (req.method === "GET") {
      const { ocrCodeId, approverType, all } = req.query;

      // ดึงทั้งหมดพร้อมข้อมูล user (สำหรับ approvers tab)
      if (all === "true") {
        const approvers = await db.ocr_approver.findMany({
          orderBy: [
            { ocrCodeId: "asc" },
            { approverType: "asc" },
            { priority: "asc" },
          ],
        });

        // ดึงข้อมูล user ทั้งหมดที่เกี่ยวข้อง
        const userIds = [...new Set(approvers.map((a) => a.userProductionId))];
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

        // Map users to approvers
        const approversWithUsers = approvers.map((approver) => {
          const user = users.find((u) => u.id === approver.userProductionId);
          return {
            ...approver,
            user,
          };
        });

        return res.status(200).json({
          success: true,
          data: approversWithUsers,
        });
      }

      // ดึง approvers สำหรับ OCR code เฉพาะ
      if (ocrCodeId) {
        const where: { ocrCodeId: number; approverType?: string } = {
          ocrCodeId: parseInt(ocrCodeId as string),
        };
        if (approverType) {
          where.approverType = approverType as string;
        }

        const approvers = await db.ocr_approver.findMany({
          where,
          orderBy: [
            { approverType: "asc" },
            { priority: "asc" },
          ],
        });

        // ดึงข้อมูล user
        const userIds = approvers.map((a) => a.userProductionId);
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

        // Map users to approvers
        const approversWithUsers = approvers.map((approver) => {
          const user = users.find((u) => u.id === approver.userProductionId);
          return {
            ...approver,
            user,
          };
        });

        return res.status(200).json({
          success: true,
          data: approversWithUsers,
        });
      }

      // ดึงจำนวน approvers per OCR code
      const approverCounts = await db.ocr_approver.groupBy({
        by: ["ocrCodeId", "approverType"],
        _count: {
          id: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: approverCounts.map((item) => ({
          ocrCodeId: item.ocrCodeId,
          approverType: item.approverType,
          count: item._count.id,
        })),
      });
    }

    // POST - เพิ่ม approver
    if (req.method === "POST") {
      const { ocrCodeId, userProductionId, approverType, priority, createdBy } = req.body as {
        ocrCodeId: number;
        userProductionId: string;
        approverType: "line" | "cost_center";
        priority?: number;
        createdBy?: string;
      };

      if (!ocrCodeId || !userProductionId || !approverType) {
        return res.status(400).json({
          error: "กรุณาระบุ ocrCodeId, userProductionId และ approverType",
        });
      }

      if (!["line", "cost_center"].includes(approverType)) {
        return res.status(400).json({
          error: "approverType ต้องเป็น 'line' หรือ 'cost_center'",
        });
      }

      // ตรวจสอบว่า OCR code มีอยู่จริง
      const ocrCode = await db.oCR_codeandName.findUnique({
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

      // ตรวจสอบว่ายังไม่มี approver นี้อยู่แล้ว
      const existingApprover = await db.ocr_approver.findUnique({
        where: {
          ocrCodeId_userProductionId_approverType: {
            ocrCodeId,
            userProductionId,
            approverType,
          },
        },
      });

      if (existingApprover) {
        return res.status(400).json({
          error: "ผู้ใช้นี้เป็นผู้อนุมัติประเภทนี้อยู่แล้ว",
        });
      }

      // หา priority ถัดไปถ้าไม่ได้ระบุ
      let finalPriority = priority;
      if (!finalPriority) {
        const maxPriority = await db.ocr_approver.aggregate({
          where: { ocrCodeId, approverType },
          _max: { priority: true },
        });
        finalPriority = (maxPriority._max.priority || 0) + 1;
      }

      // สร้าง approver ใหม่
      const approver = await db.ocr_approver.create({
        data: {
          ocrCodeId,
          userProductionId,
          approverType,
          priority: finalPriority,
          createdBy,
        },
      });

      const typeLabel = approverType === "line" ? "ผู้อนุมัติตามสายงาน" : "ผู้อนุมัติตาม Cost Center";

      return res.status(201).json({
        success: true,
        data: approver,
        message: `เพิ่ม ${user.username || user.email} เป็น${typeLabel}สำเร็จ`,
      });
    }

    // PUT - อัพเดท priority ของ approver
    if (req.method === "PUT") {
      const { id, priority } = req.body as {
        id: number;
        priority: number;
      };

      if (!id || priority === undefined) {
        return res.status(400).json({
          error: "กรุณาระบุ id และ priority",
        });
      }

      const updatedApprover = await db.ocr_approver.update({
        where: { id },
        data: { priority },
      });

      return res.status(200).json({
        success: true,
        data: updatedApprover,
      });
    }

    // DELETE - ลบ approver
    if (req.method === "DELETE") {
      const { id } = req.body as { id: number };

      if (!id) {
        return res.status(400).json({
          error: "กรุณาระบุ id",
        });
      }

      await db.ocr_approver.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        message: "ลบผู้อนุมัติสำเร็จ",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("OCR approver error:", error);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาด",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
