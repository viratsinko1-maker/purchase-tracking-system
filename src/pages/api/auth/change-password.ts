import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, oldPassword, newPassword } = req.body as {
      userId: string;
      oldPassword: string;
      newPassword: string;
    };

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // Find user
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }

    // Verify old password
    if (user.password !== oldPassword) {
      return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }

    // Check if new password is the same as old
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: "รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม" });
    }

    // Update password
    await db.user.update({
      where: { id: userId },
      data: { password: newPassword },
    });

    return res.status(200).json({
      success: true,
      message: "เปลี่ยนรหัสผ่านสำเร็จ"
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" });
  }
}
