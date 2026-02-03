import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import bcrypt from "bcrypt";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, newPassword } = req.body as {
      token: string;
      newPassword: string;
    };

    if (!token || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" });
    }

    // Find valid token
    const resetToken = await db.password_reset_token.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ error: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง" });
    }

    if (resetToken.used) {
      return res.status(400).json({ error: "ลิงก์นี้ถูกใช้งานแล้ว กรุณาขอลิงก์ใหม่" });
    }

    if (resetToken.expires < new Date()) {
      return res.status(400).json({ error: "ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่" });
    }

    // Find user in user_production
    const user = await db.user_production.findFirst({
      where: { email: resetToken.email },
    });

    if (!user) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and mark token as used (transaction)
    await db.$transaction([
      db.user_production.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      db.password_reset_token.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    console.log('[RESET-PASSWORD] Password reset successful for:', resetToken.email);

    return res.status(200).json({
      success: true,
      message: "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
    });

  } catch (error) {
    console.error("[RESET-PASSWORD] Error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  }
}
