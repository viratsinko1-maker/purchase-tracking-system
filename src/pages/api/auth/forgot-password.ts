import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import crypto from "crypto";
import { emailService } from "~/lib/email-service";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body as { email: string };

    if (!email) {
      return res.status(400).json({ error: "กรุณากรอก Email" });
    }

    // Find user in user_production table
    const user = await db.user_production.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    // Always return success message (don't reveal if user exists)
    if (!user) {
      console.log('[FORGOT-PASSWORD] User not found:', email);
      return res.status(200).json({
        success: true,
        message: "หากอีเมลนี้มีอยู่ในระบบ จะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('[FORGOT-PASSWORD] User inactive:', email);
      return res.status(200).json({
        success: true,
        message: "หากอีเมลนี้มีอยู่ในระบบ จะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
      });
    }

    // Clean up old expired tokens
    await db.password_reset_token.deleteMany({
      where: {
        email: email.toLowerCase(),
        expires: { lt: new Date() },
      },
    });

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await db.password_reset_token.create({
      data: {
        email: email.toLowerCase(),
        token,
        expires,
      },
    });

    // Generate reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:2025';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail({
        to: email,
        userName: user.name || user.username || 'User',
        resetUrl,
      });

      console.log('[FORGOT-PASSWORD] Reset email sent to:', email);
    } catch (emailError) {
      console.error('[FORGOT-PASSWORD] Failed to send email:', emailError);
      // Delete the token if email failed
      await db.password_reset_token.delete({
        where: { token },
      });
      return res.status(500).json({
        error: "ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง",
      });
    }

    return res.status(200).json({
      success: true,
      message: "หากอีเมลนี้มีอยู่ในระบบ จะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
    });

  } catch (error) {
    console.error("[FORGOT-PASSWORD] Error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  }
}
