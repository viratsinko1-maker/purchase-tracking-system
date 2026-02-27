import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { getClientIp } from "~/server/utils/getClientIp";
import { createAuditLog, AuditAction } from "~/server/api/utils/auditLog";
import { authenticateWithTmk } from "~/lib/tmk-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, password, computerName } = req.body as {
      username: string;
      password: string;
      computerName?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ error: "กรุณากรอก Username และ Password" });
    }

    // First, try to find user in User table (plain text password)
    let user = await db.user.findFirst({
      where: {
        OR: [
          { userId: username },
          { username: username },
        ],
        password: password,
      },
    });

    let userSource: "local" | "production" = "local";

    // If not found in User table, try TMK_PDPJ01 direct authentication
    if (!user) {
      const tmkUser = await authenticateWithTmk(username, password);

      if (tmkUser) {
        // Look up role mapping in user_production
        const userProd = await db.user_production.findFirst({
          where: {
            OR: [
              { email: tmkUser.email.toLowerCase() },
              { id: tmkUser.id },
            ],
          },
        });

        if (userProd && userProd.isActive) {
          user = {
            id: userProd.id,
            userId: userProd.email,
            username: userProd.username,
            name: tmkUser.name, // Use fresh name from TMK
            password: tmkUser.password,
            role: userProd.role, // Use PR-PO role
            isActive: userProd.isActive,
            email: userProd.email,
            emailVerified: null,
            image: null,
          };
          userSource = "production";
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: "Username หรือ Password ไม่ถูกต้อง" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: "บัญชีผู้ใช้ของคุณถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
    }

    // Log LOGIN activity using audit log helper (fire-and-forget)
    const ipAddress = getClientIp(req);
    createAuditLog(db, {
      userId: user.id,
      userName: user.name ?? user.username ?? undefined,
      action: AuditAction.LOGIN,
      tableName: "User",
      recordId: user.id,
      description: userSource === "production" ? 'ล็อคอินเข้าระบบ (Production)' : 'ล็อคอินเข้าระบบ',
      metadata: {
        userId: user.userId,
        username: user.username,
        source: userSource,
      },
      ipAddress,
      computerName: computerName ?? undefined,
    }).catch(console.error);
    console.log('[LOGIN API] ✅ Activity logged for user:', user.id, 'IP:', ipAddress, 'Computer:', computerName || 'unknown', 'Source:', userSource);

    // Create active session for heartbeat tracking
    // First, check if there's an existing session (user re-logging in before timeout)
    const existingSession = await db.active_session.findUnique({
      where: { user_id: user.id },
    });

    if (existingSession) {
      // Log LOGOUT for the old session before creating new one
      const sessionEnd = new Date();
      const sessionStart = existingSession.session_start;
      const durationSeconds = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      const durationMinutes = durationSeconds / 60;

      // Save to session history
      await db.session_history.create({
        data: {
          user_id: existingSession.user_id,
          user_name: existingSession.user_name,
          ip_address: existingSession.ip_address,
          computer_name: existingSession.computer_name,
          session_start: sessionStart,
          session_end: sessionEnd,
          duration_seconds: durationSeconds,
          duration_minutes: durationMinutes,
          logout_type: 'relogin', // User logged in again before session expired
        },
      });

      // Log LOGOUT for old session
      await createAuditLog(db, {
        userId: existingSession.user_id,
        userName: existingSession.user_name ?? undefined,
        action: AuditAction.LOGOUT,
        tableName: "User",
        recordId: existingSession.user_id,
        description: `ออกจากระบบ (ล็อคอินใหม่) - ใช้งาน ${Math.round(durationMinutes)} นาที`,
        ipAddress: existingSession.ip_address ?? undefined,
        computerName: existingSession.computer_name ?? undefined,
      });

      console.log('[LOGIN API] Logged out previous session for user:', existingSession.user_id);

      // Update existing session with new data
      await db.active_session.update({
        where: { user_id: user.id },
        data: {
          last_heartbeat: new Date(),
          session_start: new Date(),
          ip_address: ipAddress,
          computer_name: computerName ?? null,
          user_name: user.name ?? user.username ?? null,
        },
      });
    } else {
      // No existing session, create new one
      await db.active_session.create({
        data: {
          user_id: user.id,
          user_name: user.name ?? user.username ?? null,
          ip_address: ipAddress,
          computer_name: computerName ?? null,
          last_heartbeat: new Date(),
          session_start: new Date(),
        },
      });
    }

    // Return user data (in a real app, you'd create a session/token here)
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        userId: user.userId,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        source: userSource,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
}
