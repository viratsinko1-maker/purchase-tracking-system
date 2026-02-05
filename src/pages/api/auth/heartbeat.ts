import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { getClientIp } from "~/server/utils/getClientIp";
import { createAuditLog, AuditAction } from "~/server/api/utils/auditLog";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, userName, computerName } = req.body as {
      userId?: string;
      userName?: string;
      computerName?: string;
    };

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const ipAddress = getClientIp(req);

    // Check if session already exists
    const existingSession = await db.active_session.findUnique({
      where: { user_id: userId },
    });

    if (existingSession) {
      // Session exists - just update heartbeat
      await db.active_session.update({
        where: { user_id: userId },
        data: {
          last_heartbeat: new Date(),
          ip_address: ipAddress,
          computer_name: computerName ?? null,
          user_name: userName ?? null,
        },
      });
    } else {
      // No session exists - create new and log LOGIN (session resumed)
      await db.active_session.create({
        data: {
          user_id: userId,
          user_name: userName ?? null,
          ip_address: ipAddress,
          computer_name: computerName ?? null,
          last_heartbeat: new Date(),
          session_start: new Date(),
        },
      });

      // Log LOGIN for session resume (after timeout cleanup)
      createAuditLog(db, {
        userId: userId,
        userName: userName ?? undefined,
        action: AuditAction.LOGIN,
        tableName: "User",
        recordId: userId,
        description: 'กลับเข้าระบบ (Session Resume)',
        ipAddress,
        computerName: computerName ?? undefined,
      }).catch(console.error);

      console.log('[HEARTBEAT] Session resumed for user:', userId, '- LOGIN logged');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
}
