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

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const ipAddress = getClientIp(req);

    // Upsert active session (create or update)
    await db.active_session.upsert({
      where: { user_id: userId },
      update: {
        last_heartbeat: new Date(),
        ip_address: ipAddress,
        computer_name: computerName ?? null,
        user_name: userName ?? null,
      },
      create: {
        user_id: userId,
        user_name: userName ?? null,
        ip_address: ipAddress,
        computer_name: computerName ?? null,
        last_heartbeat: new Date(),
        session_start: new Date(),
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
}
