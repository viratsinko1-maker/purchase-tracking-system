import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { getClientIp } from "~/server/utils/getClientIp";

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

    // Find user by userId or username
    const user = await db.user.findFirst({
      where: {
        OR: [
          { userId: username },
          { username: username },
        ],
        password: password,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Username หรือ Password ไม่ถูกต้อง" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: "บัญชีผู้ใช้ของคุณถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
    }

    // Log LOGIN activity
    try {
      const ipAddress = getClientIp(req);

      // Get current time in Thailand timezone (UTC+7)
      const now = new Date();
      const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));

      await db.activity_trail.create({
        data: {
          user_id: user.id,
          user_name: user.name ?? user.username ?? undefined,
          ip_address: ipAddress,
          computer_name: computerName ?? undefined,
          action: 'LOGIN',
          description: 'ล็อคอินเข้าระบบ',
          metadata: {
            userId: user.userId,
            username: user.username,
          },
          created_at: thailandTime,
        },
      });
      console.log('[LOGIN API] ✅ Activity logged for user:', user.id, 'IP:', ipAddress, 'Computer:', computerName || 'unknown');
    } catch (error) {
      console.error('[LOGIN API] ❌ Failed to log activity:', error);
      // Don't fail the login if activity logging fails
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
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
}
