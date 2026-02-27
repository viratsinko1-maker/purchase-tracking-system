import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { getClientIp } from "~/server/utils/getClientIp";
import { createAuditLog, AuditAction } from "~/server/api/utils/auditLog";
import { verifySsoToken } from "~/lib/sso";
import { findTmkUserByEmail } from "~/lib/tmk-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, computerName } = req.body as {
      token: string;
      computerName?: string;
    };

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // 1. Verify JWT token
    const payload = verifySsoToken(token);
    if (!payload) {
      return res.status(401).json({ error: "SSO token ไม่ถูกต้องหรือหมดอายุ" });
    }

    // 2. Verify user exists in TMK_PDPJ01 and is active
    const tmkUser = await findTmkUserByEmail(payload.sub);
    if (!tmkUser) {
      return res.status(401).json({ error: "ไม่พบผู้ใช้ในระบบ TMK" });
    }
    if (!tmkUser.isActive) {
      return res.status(403).json({ error: "บัญชีผู้ใช้ถูกปิดใช้งานใน TMK" });
    }

    // 3. Check user_production for PR-PO role mapping
    const userProd = await db.user_production.findFirst({
      where: {
        OR: [
          { email: tmkUser.email.toLowerCase() },
          { id: tmkUser.id },
        ],
      },
    });

    if (!userProd) {
      return res.status(403).json({
        error: "คุณยังไม่ได้รับสิทธิ์ใช้งานระบบ PR/PO กรุณาติดต่อผู้ดูแลระบบ",
      });
    }

    if (!userProd.isActive) {
      return res.status(403).json({
        error: "บัญชีผู้ใช้ของคุณถูกปิดใช้งานในระบบ PR/PO กรุณาติดต่อผู้ดูแลระบบ",
      });
    }

    // 4. Create session (same logic as login.ts)
    const ipAddress = getClientIp(req);

    const existingSession = await db.active_session.findUnique({
      where: { user_id: userProd.id },
    });

    if (existingSession) {
      // Handle re-login: save old session to history
      const sessionEnd = new Date();
      const sessionStart = existingSession.session_start;
      const durationSeconds = Math.floor(
        (sessionEnd.getTime() - sessionStart.getTime()) / 1000
      );
      const durationMinutes = durationSeconds / 60;

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
          logout_type: "relogin",
        },
      });

      await createAuditLog(db, {
        userId: existingSession.user_id,
        userName: existingSession.user_name ?? undefined,
        action: AuditAction.LOGOUT,
        tableName: "User",
        recordId: existingSession.user_id,
        description: `ออกจากระบบ (SSO ล็อคอินใหม่) - ใช้งาน ${Math.round(durationMinutes)} นาที`,
        ipAddress: existingSession.ip_address ?? undefined,
        computerName: existingSession.computer_name ?? undefined,
      });

      await db.active_session.update({
        where: { user_id: userProd.id },
        data: {
          last_heartbeat: new Date(),
          session_start: new Date(),
          ip_address: ipAddress,
          computer_name: computerName ?? null,
          user_name: userProd.name ?? userProd.username ?? null,
        },
      });
    } else {
      await db.active_session.create({
        data: {
          user_id: userProd.id,
          user_name: userProd.name ?? userProd.username ?? null,
          ip_address: ipAddress,
          computer_name: computerName ?? null,
          last_heartbeat: new Date(),
          session_start: new Date(),
        },
      });
    }

    // 5. Audit log
    createAuditLog(db, {
      userId: userProd.id,
      userName: userProd.name ?? userProd.username ?? undefined,
      action: AuditAction.LOGIN,
      tableName: "User",
      recordId: userProd.id,
      description: "ล็อคอินเข้าระบบ (SSO)",
      metadata: {
        ssoEmail: payload.sub,
        source: "sso",
      },
      ipAddress,
      computerName: computerName ?? undefined,
    }).catch(console.error);

    // 6. Return user data (same shape as login.ts)
    return res.status(200).json({
      success: true,
      user: {
        id: userProd.id,
        userId: userProd.email,
        username: userProd.username,
        name: userProd.name,
        role: userProd.role,
        isActive: userProd.isActive,
        source: "sso" as const,
      },
    });

  } catch (error) {
    console.error("SSO error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ SSO" });
  }
}
