import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, oldPassword, newPassword, source } = req.body as {
      userId: string;
      oldPassword: string;
      newPassword: string;
      source?: "local" | "production" | "sso";
    };

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // Block password change for TMK/SSO users — ต้องเปลี่ยนผ่านระบบ TMK
    if (source === "production" || source === "sso") {
      return res.status(400).json({
        error: "กรุณาเปลี่ยนรหัสผ่านผ่านระบบ TMK",
      });
    }

    // Check if new password is the same as old
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: "รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม" });
    }

    // Find user in User table (local)
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }

    // Verify old password (plain text for local users)
    if (user.password !== oldPassword) {
      return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }

    // Update password (plain text for local users)
    await db.user.update({
      where: { id: userId },
      data: { password: newPassword },
    });

    // Audit log: Password change for local user
    createAuditLog(db, {
      userId: userId,
      userName: user.name ?? user.username ?? undefined,
      action: AuditAction.UPDATE,
      tableName: "user",
      recordId: userId,
      description: `เปลี่ยนรหัสผ่าน: ${user.name || user.username}`,
      metadata: { passwordChanged: true, source: "local" },
      ipAddress: getIpFromRequest(req),
    }).catch(console.error);

    return res.status(200).json({
      success: true,
      message: "เปลี่ยนรหัสผ่านสำเร็จ"
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" });
  }
}
