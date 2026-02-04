import { type NextApiRequest, type NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { db } from "~/server/db";
import { getClientIp } from "~/server/utils/getClientIp";

/**
 * API สำหรับลงทะเบียนผู้ใช้งานใหม่
 *
 * - Default role = "PR"
 * - Default isActive = false (ต้องรอ Admin เปิดใช้งาน)
 * - Admin จะต้องมาแก้ userId และสิทธิ์ทีหลัง
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, name, password } = req.body as {
      username: string;
      name: string;
      password: string;
    };

    // Validate input
    if (!username || !name || !password) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // Check if username already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username: username },
          { userId: username },
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Username นี้มีในระบบแล้ว กรุณาใช้ Username อื่น" });
    }

    // Create new user with default settings
    const newUser = await db.user.create({
      data: {
        id: randomUUID(),
        userId: null, // Admin จะต้องมาตั้งทีหลัง
        username: username,
        name: name,
        password: password,
        role: "PR", // Default role
        isActive: false, // Default inactive - รอ Admin อนุมัติ
      },
    });

    // Log REGISTER activity
    try {
      const ipAddress = getClientIp(req);

      await db.activity_trail.create({
        data: {
          user_id: newUser.id,
          user_name: newUser.name ?? newUser.username ?? undefined,
          ip_address: ipAddress,
          action: 'REGISTER',
          description: 'ลงทะเบียนเข้าใช้งานระบบ (รอการอนุมัติ)',
          metadata: {
            username: newUser.username,
            role: newUser.role,
            isActive: newUser.isActive,
          },
          created_at: new Date(),
        },
      });
      console.log('[REGISTER API] ✅ New user registered:', newUser.username, 'IP:', ipAddress);
    } catch (error) {
      console.error('[REGISTER API] ❌ Failed to log activity:', error);
      // Don't fail the registration if activity logging fails
    }

    return res.status(201).json({
      success: true,
      message: "ลงทะเบียนสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติการใช้งาน",
    });

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการลงทะเบียน" });
  }
}
