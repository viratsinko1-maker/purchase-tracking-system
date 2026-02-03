import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { randomUUID } from "crypto";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

async function handler(
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
          id: randomUUID(),
          userId: userId || null,
          username: username,
          name: name || username,
          password: password,
          role: role || "PR",
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      // Audit log: CREATE user
      createAuditLog(db, {
        action: AuditAction.CREATE,
        tableName: "user",
        recordId: newUser.id,
        newValues: {
          userId: newUser.userId,
          username: newUser.username,
          name: newUser.name,
          role: newUser.role,
          isActive: newUser.isActive,
        },
        description: `สร้างผู้ใช้ใหม่: ${newUser.username}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

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

      // Get old values for audit log
      const oldUser = await db.user.findUnique({ where: { id } });

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

      // Audit log: UPDATE user
      createAuditLog(db, {
        action: AuditAction.UPDATE,
        tableName: "user",
        recordId: id,
        oldValues: oldUser ? {
          userId: oldUser.userId,
          username: oldUser.username,
          name: oldUser.name,
          role: oldUser.role,
          isActive: oldUser.isActive,
        } : undefined,
        newValues: {
          userId: updatedUser.userId,
          username: updatedUser.username,
          name: updatedUser.name,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          passwordChanged: !!password,
        },
        description: `แก้ไขผู้ใช้: ${updatedUser.username}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({ user: updatedUser });
    }

    // DELETE - Delete user
    if (req.method === "DELETE") {
      const { id } = req.body as { id: string };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      // Get user data before delete for audit log
      const userToDelete = await db.user.findUnique({ where: { id } });

      await db.user.delete({
        where: { id },
      });

      // Audit log: DELETE user
      createAuditLog(db, {
        action: AuditAction.DELETE,
        tableName: "user",
        recordId: id,
        oldValues: userToDelete ? {
          userId: userToDelete.userId,
          username: userToDelete.username,
          name: userToDelete.name,
          role: userToDelete.role,
          isActive: userToDelete.isActive,
        } : undefined,
        description: `ลบผู้ใช้: ${userToDelete?.username || id}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({ message: "ลบผู้ใช้สำเร็จ" });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("User management error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
}

// Apply permission middleware - protect admin user management
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_users', action: 'read' },
  POST: { tableName: 'admin_users', action: 'create' },
  PUT: { tableName: 'admin_users', action: 'update' },
  DELETE: { tableName: 'admin_users', action: 'delete' },
});
