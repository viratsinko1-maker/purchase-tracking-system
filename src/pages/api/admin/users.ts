import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // GET - List all users
    if (req.method === "GET") {
      const users = await db.user.findMany({
        select: {
          id: true,
          userId: true,
          username: true,
          name: true,
          password: true,
          email: true,
          role: true,
          isActive: true,
        },
        orderBy: {
          username: "asc",
        },
      });

      return res.status(200).json({ users });
    }

    // POST - Create new user
    if (req.method === "POST") {
      const { userId, username, name, password, role, isActive } = req.body as {
        userId?: string;
        username?: string;
        name?: string;
        password: string;
        role?: string;
        isActive?: boolean;
      };

      if (!username || !password) {
        return res.status(400).json({ error: "กรุณากรอก Username และ Password" });
      }

      // Check if username or userId already exists
      const existingUser = await db.user.findFirst({
        where: {
          OR: [
            { username: username },
            { userId: userId || undefined },
          ],
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: "Username หรือ User ID นี้มีอยู่แล้ว" });
      }

      const newUser = await db.user.create({
        data: {
          userId: userId || null,
          username: username,
          name: name || username,
          password: password,
          role: role || "PR",
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      return res.status(201).json({ user: newUser });
    }

    // PUT - Update user
    if (req.method === "PUT") {
      const { id, userId, username, name, password, role, isActive } = req.body as {
        id: string;
        userId?: string;
        username?: string;
        name?: string;
        password?: string;
        role?: string;
        isActive?: boolean;
      };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      // Check if username or userId conflicts with another user
      if (username || userId) {
        const existingUser = await db.user.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  { username: username || undefined },
                  { userId: userId || undefined },
                ],
              },
            ],
          },
        });

        if (existingUser) {
          return res.status(400).json({ error: "Username หรือ User ID นี้มีผู้ใช้งานแล้ว" });
        }
      }

      const updatedUser = await db.user.update({
        where: { id },
        data: {
          userId: userId,
          username: username,
          name: name,
          ...(password && { password }), // Only update password if provided
          ...(role !== undefined && { role }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return res.status(200).json({ user: updatedUser });
    }

    // DELETE - Delete user
    if (req.method === "DELETE") {
      const { id } = req.body as { id: string };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      await db.user.delete({
        where: { id },
      });

      return res.status(200).json({ message: "ลบผู้ใช้สำเร็จ" });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("User management error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
}
