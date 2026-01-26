import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { getClientIp } from "~/server/utils/getClientIp";
import bcrypt from "bcrypt";

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

    // If not found in User table, try User_production table (bcrypt hashed password)
    if (!user) {
      // Find user by email or userId in User_production
      const userProduction = await db.user_production.findFirst({
        where: {
          OR: [
            { email: username.toLowerCase() },
            { userId: username.toLowerCase() },
          ],
        },
      });

      if (userProduction && userProduction.password) {
        // Compare bcrypt hashed password
        const isPasswordValid = await bcrypt.compare(password, userProduction.password);

        if (isPasswordValid) {
          // Map User_production to user format
          user = {
            id: userProduction.id,
            userId: userProduction.email, // Use email as userId
            username: userProduction.username,
            name: userProduction.name,
            password: userProduction.password,
            role: userProduction.role,
            isActive: userProduction.isActive,
            email: userProduction.email,
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
          description: userSource === "production" ? 'ล็อคอินเข้าระบบ (Production)' : 'ล็อคอินเข้าระบบ',
          metadata: {
            userId: user.userId,
            username: user.username,
            source: userSource,
          },
          created_at: thailandTime,
        },
      });
      console.log('[LOGIN API] ✅ Activity logged for user:', user.id, 'IP:', ipAddress, 'Computer:', computerName || 'unknown', 'Source:', userSource);
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
        source: userSource,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
}
