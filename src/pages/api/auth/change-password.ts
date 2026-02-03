import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import bcrypt from "bcrypt";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";

const SALT_ROUNDS = 10;

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
      source?: "local" | "production";
    };

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // Check if new password is the same as old
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: "รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม" });
    }

    // Try User_production first if source is production
    if (source === "production") {
      const userProduction = await db.user_production.findUnique({
        where: { id: userId },
      });

      if (userProduction) {
        // Verify old password (bcrypt)
        if (!userProduction.password) {
          return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
        }

        const isOldPasswordValid = await bcrypt.compare(oldPassword, userProduction.password);
        if (!isOldPasswordValid) {
          return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
        }

        // Hash new password and update
        const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.user_production.update({
          where: { id: userId },
          data: { password: hashedNewPassword },
        });

        // Audit log: Password change for production user
        createAuditLog(db, {
          userId: userId,
          userName: userProduction.name ?? userProduction.username ?? undefined,
          action: AuditAction.UPDATE,
          tableName: "user_production",
          recordId: userId,
          description: `เปลี่ยนรหัสผ่าน (Production): ${userProduction.name || userProduction.email}`,
          metadata: { passwordChanged: true, source: "production" },
          ipAddress: getIpFromRequest(req),
        }).catch(console.error);

        return res.status(200).json({
          success: true,
          message: "เปลี่ยนรหัสผ่านสำเร็จ"
        });
      }
    }

    // Find user in User table (local)
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      // If not found in User, also try User_production as fallback
      const userProduction = await db.user_production.findUnique({
        where: { id: userId },
      });

      if (userProduction) {
        // Verify old password (bcrypt)
        if (!userProduction.password) {
          return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
        }

        const isOldPasswordValid = await bcrypt.compare(oldPassword, userProduction.password);
        if (!isOldPasswordValid) {
          return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
        }

        // Hash new password and update
        const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.user_production.update({
          where: { id: userId },
          data: { password: hashedNewPassword },
        });

        // Audit log: Password change for production user (fallback)
        createAuditLog(db, {
          userId: userId,
          userName: userProduction.name ?? userProduction.username ?? undefined,
          action: AuditAction.UPDATE,
          tableName: "user_production",
          recordId: userId,
          description: `เปลี่ยนรหัสผ่าน (Production): ${userProduction.name || userProduction.email}`,
          metadata: { passwordChanged: true, source: "production" },
          ipAddress: getIpFromRequest(req),
        }).catch(console.error);

        return res.status(200).json({
          success: true,
          message: "เปลี่ยนรหัสผ่านสำเร็จ"
        });
      }

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
