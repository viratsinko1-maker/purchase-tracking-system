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
    const { userId, userName, computerName } = req.body as {
      userId?: string;
      userName?: string;
      computerName?: string;
    };

    // Log LOGOUT activity if user info provided
    if (userId) {
      try {
        const ipAddress = getClientIp(req);

        // Get current time in Thailand timezone (UTC+7)
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));

        await db.activity_trail.create({
          data: {
            user_id: userId,
            user_name: userName ?? undefined,
            ip_address: ipAddress,
            computer_name: computerName ?? undefined,
            action: 'LOGOUT',
            description: 'ออกจากระบบ',
            created_at: thailandTime,
          },
        });
        console.log('[LOGOUT API] ✅ Activity logged for user:', userId, 'IP:', ipAddress, 'Computer:', computerName || 'unknown');
      } catch (error) {
        console.error('[LOGOUT API] ❌ Failed to log activity:', error);
        // Don't fail logout if activity logging fails
      }
    }

    // In the future, you'd destroy the session here
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการออกจากระบบ" });
  }
}
