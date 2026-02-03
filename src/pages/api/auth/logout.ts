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
    const { userId, userName, computerName, reason } = req.body as {
      userId?: string;
      userName?: string;
      computerName?: string;
      reason?: 'manual' | 'auto_logout_idle';
    };

    // Log LOGOUT activity if user info provided
    if (userId) {
      const ipAddress = getClientIp(req);

      // Get active session to calculate duration
      const activeSession = await db.active_session.findUnique({
        where: { user_id: userId },
      });

      let durationMinutes = 0;
      if (activeSession) {
        const sessionEnd = new Date();
        const sessionStart = activeSession.session_start;
        const durationSeconds = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
        durationMinutes = Math.round(durationSeconds / 60);

        // Log session history for usage analytics
        await db.session_history.create({
          data: {
            user_id: userId,
            user_name: userName ?? activeSession.user_name,
            ip_address: ipAddress ?? activeSession.ip_address,
            computer_name: computerName ?? activeSession.computer_name,
            session_start: sessionStart,
            session_end: sessionEnd,
            duration_seconds: durationSeconds,
            duration_minutes: durationSeconds / 60,
            logout_type: reason === 'auto_logout_idle' ? 'timeout' : 'manual',
          },
        }).catch(console.error);
      }

      // Log audit trail
      const logoutDescription = reason === 'auto_logout_idle'
        ? `ออกจากระบบ (หมดเวลา) - ใช้งาน ${durationMinutes} นาที`
        : `ออกจากระบบ - ใช้งาน ${durationMinutes} นาที`;

      createAuditLog(db, {
        userId,
        userName: userName ?? undefined,
        action: AuditAction.LOGOUT,
        tableName: "User",
        recordId: userId,
        description: logoutDescription,
        ipAddress,
        computerName: computerName ?? undefined,
      }).catch(console.error);

      // Delete active session
      db.active_session.delete({
        where: { user_id: userId },
      }).catch(() => {
        // Ignore if session doesn't exist
      });

      console.log('[LOGOUT API] ✅ Activity logged for user:', userId, 'IP:', ipAddress, 'Duration:', durationMinutes, 'min');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการออกจากระบบ" });
  }
}
