import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";
import { fetchAllTmkUsers } from "~/lib/tmk-auth";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // GET - List all users from User_production
    if (req.method === "GET") {
      const users = await db.user_production.findMany({
        select: {
          id: true,
          email: true,
          userId: true,
          username: true,
          name: true,
          password: true,
          role: true,
          isActive: true,
          sourceId: true,
          telegramChatId: true,
          linked_req_name: true,
          lastSyncAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          username: "asc",
        },
      });

      return res.status(200).json({ users });
    }

    // POST - Role management actions
    if (req.method === "POST") {
      const { action, userId: adminUserId, userName: adminUserName } = req.body as {
        action?: string;
        userId?: string;
        userName?: string;
      };

      // Fetch TMK users for role assignment dropdown
      if (action === "fetch-tmk-users") {
        try {
          const tmkUsers = await fetchAllTmkUsers();

          // Get existing user_production emails to mark who already has a role
          const existingEmails = new Set(
            (await db.user_production.findMany({
              select: { email: true },
            })).map((u) => u.email.toLowerCase())
          );

          return res.status(200).json({
            tmkUsers: tmkUsers.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              hasRole: existingEmails.has(u.email.toLowerCase()),
            })),
          });
        } catch (dbError) {
          console.error("TMK_PDPJ01 connection error:", dbError);
          return res.status(500).json({
            error: "ไม่สามารถเชื่อมต่อ TMK_PDPJ01 ได้",
            details: dbError instanceof Error ? dbError.message : "Unknown error",
          });
        }
      }

      // Assign PR-PO role to a TMK user
      if (action === "assign-role") {
        const { tmkUserId, tmkEmail, tmkName, role: assignedRole } = req.body as {
          tmkUserId: string;
          tmkEmail: string;
          tmkName: string;
          role: string;
        };

        if (!tmkUserId || !tmkEmail || !assignedRole) {
          return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
        }

        const email = tmkEmail.toLowerCase();
        const existing = await db.user_production.findUnique({ where: { email } });

        if (existing) {
          // Update role if already exists
          await db.user_production.update({
            where: { email },
            data: { role: assignedRole, isActive: true, name: tmkName, username: tmkName },
          });
        } else {
          await db.user_production.create({
            data: {
              id: tmkUserId,
              email,
              userId: email,
              username: tmkName,
              name: tmkName,
              password: null, // No password needed — auth goes through TMK
              role: assignedRole,
              isActive: true,
              sourceId: tmkUserId,
              updatedAt: new Date(),
            },
          });
        }

        // Audit log
        createAuditLog(db, {
          userId: adminUserId,
          userName: adminUserName,
          action: AuditAction.CREATE,
          tableName: "user_production",
          recordId: tmkUserId,
          description: `กำหนดสิทธิ์ TMK user: ${tmkName} (${email}) → role: ${assignedRole}`,
          metadata: { tmkUserId, tmkEmail: email, role: assignedRole },
          ipAddress: getIpFromRequest(req),
        }).catch(console.error);

        return res.status(200).json({
          success: true,
          message: `กำหนดสิทธิ์ ${tmkName} เป็น ${assignedRole} สำเร็จ`,
        });
      }

      return res.status(400).json({ error: "Invalid action" });
    }

    // PUT - Update user
    if (req.method === "PUT") {
      const { id, username, name, role, isActive, telegramChatId, linkedReqName } = req.body as {
        id: string;
        username?: string;
        name?: string;
        role?: string;
        isActive?: boolean;
        telegramChatId?: string;
        linkedReqName?: string;
      };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      // Build update data (password removed — auth goes through TMK directly)
      const updateData: {
        username?: string;
        name?: string;
        role?: string;
        isActive?: boolean;
        telegramChatId?: string | null;
        linked_req_name?: string | null;
      } = {};

      if (username !== undefined) updateData.username = username;
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId || null;
      if (linkedReqName !== undefined) updateData.linked_req_name = linkedReqName || null;

      // Get old values for audit log
      const oldUser = await db.user_production.findUnique({ where: { id } });

      const updatedUser = await db.user_production.update({
        where: { id },
        data: updateData,
      });

      // Audit log: UPDATE user_production
      createAuditLog(db, {
        action: AuditAction.UPDATE,
        tableName: "user_production",
        recordId: id,
        oldValues: oldUser ? {
          username: oldUser.username,
          name: oldUser.name,
          role: oldUser.role,
          isActive: oldUser.isActive,
          telegramChatId: oldUser.telegramChatId,
          linked_req_name: oldUser.linked_req_name,
        } : undefined,
        newValues: {
          username: updatedUser.username,
          name: updatedUser.name,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          telegramChatId: updatedUser.telegramChatId,
          linked_req_name: updatedUser.linked_req_name,
        },
        description: `แก้ไขผู้ใช้ Production: ${updatedUser.name || updatedUser.email}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({ user: updatedUser });
    }

    // DELETE - Delete user (admin only, permanent delete)
    if (req.method === "DELETE") {
      const { id } = req.body as { id: string };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      // Get user data before delete for audit log
      const userToDelete = await db.user_production.findUnique({ where: { id } });

      await db.user_production.delete({
        where: { id },
      });

      // Audit log: DELETE user_production
      createAuditLog(db, {
        action: AuditAction.DELETE,
        tableName: "user_production",
        recordId: id,
        oldValues: userToDelete ? {
          email: userToDelete.email,
          username: userToDelete.username,
          name: userToDelete.name,
          role: userToDelete.role,
          isActive: userToDelete.isActive,
        } : undefined,
        description: `ลบผู้ใช้ Production: ${userToDelete?.name || userToDelete?.email || id}`,
        ipAddress: getIpFromRequest(req),
      }).catch(console.error);

      return res.status(200).json({ message: "ลบผู้ใช้สำเร็จ" });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("User production management error:", error);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาด",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Apply permission middleware - protect admin user production management
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_users', action: 'read' },
  POST: { tableName: 'admin_users', action: 'create' },  // Assign role / Fetch TMK users
  PUT: { tableName: 'admin_users', action: 'update' },
  DELETE: { tableName: 'admin_users', action: 'delete' },
});
