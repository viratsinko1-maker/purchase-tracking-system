import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import bcrypt from "bcrypt";
import pg from "pg";
import { createAuditLog, AuditAction, getIpFromRequest } from "~/server/api/utils/auditLog";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

const { Client } = pg;

// Default password for new users (will be hashed)
const DEFAULT_PASSWORD = "1234";
const SALT_ROUNDS = 10;

// TMK_PDPJ01 database connection
function getTmkClient() {
  return new Client({
    host: "192.168.1.3",
    port: 5432,
    database: "TMK_PDPJ01",
    user: "sa",
    password: "@12345",
  });
}

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

    // POST - Sync users from TMK_PDPJ01
    if (req.method === "POST") {
      const { action, userId: adminUserId, userName: adminUserName } = req.body as {
        action?: string;
        userId?: string;
        userName?: string;
      };

      if (action === "sync") {
        const tmkClient = getTmkClient();

        try {
          await tmkClient.connect();

          // Get all active users from TMK_PDPJ01 (only those with verified email)
          const result = await tmkClient.query(`
            SELECT id, name, email, password, "isActive"
            FROM "User"
            WHERE email IS NOT NULL
              AND email != ''
              AND "isActive" = true
          `);

          const tmkUsers = result.rows as Array<{
            id: string;
            name: string;
            email: string;
            password: string | null;
            isActive: boolean;
          }>;

          await tmkClient.end();

          // Get all emails from TMK for comparison
          const tmkEmails = new Set(tmkUsers.map((u) => u.email.toLowerCase()));

          // Hash default password once
          const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

          let inserted = 0;
          let updated = 0;
          let deactivated = 0;

          // Upsert users from TMK_PDPJ01
          for (const tmkUser of tmkUsers) {
            const email = tmkUser.email.toLowerCase();

            // Check if user already exists
            const existingUser = await db.user_production.findUnique({
              where: { email },
            });

            if (existingUser) {
              // Update existing user (name/username + password from TMK)
              await db.user_production.update({
                where: { email },
                data: {
                  username: tmkUser.name,
                  name: tmkUser.name,
                  sourceId: tmkUser.id,
                  isActive: true, // Re-activate if was deactivated
                  lastSyncAt: new Date(),
                  ...(tmkUser.password ? { password: tmkUser.password } : {}),
                },
              });
              updated++;
            } else {
              // Create new user with password from TMK (fallback to default "1234")
              await db.user_production.create({
                data: {
                  id: tmkUser.id, // Use TMK user ID as primary key
                  email: email,
                  userId: email, // Use email as userId for login
                  username: tmkUser.name,
                  name: tmkUser.name,
                  password: tmkUser.password ?? hashedPassword,
                  role: "PR", // Default role
                  isActive: true,
                  sourceId: tmkUser.id,
                  lastSyncAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              inserted++;
            }
          }

          // Deactivate users that no longer exist in TMK_PDPJ01
          const allLocalUsers = await db.user_production.findMany({
            where: { isActive: true, sourceId: { not: null } },
          });

          for (const localUser of allLocalUsers) {
            if (!tmkEmails.has(localUser.email.toLowerCase())) {
              await db.user_production.update({
                where: { id: localUser.id },
                data: { isActive: false },
              });
              deactivated++;
            }
          }

          // Audit log: SYNC_DATA for user sync
          createAuditLog(db, {
            userId: adminUserId,
            userName: adminUserName,
            action: "SYNC_DATA",
            tableName: "user_production",
            description: `Sync ผู้ใช้จาก TMK: เพิ่มใหม่ ${inserted}, อัพเดต ${updated}, ปิดใช้งาน ${deactivated}`,
            metadata: {
              inserted,
              updated,
              deactivated,
              totalFromTMK: tmkUsers.length,
            },
            ipAddress: getIpFromRequest(req),
          }).catch(console.error);

          return res.status(200).json({
            success: true,
            message: `Sync สำเร็จ: เพิ่มใหม่ ${inserted}, อัพเดต ${updated}, ปิดใช้งาน ${deactivated}`,
            stats: { inserted, updated, deactivated },
          });

        } catch (dbError) {
          console.error("TMK_PDPJ01 connection error:", dbError);
          return res.status(500).json({
            error: "ไม่สามารถเชื่อมต่อ TMK_PDPJ01 ได้",
            details: dbError instanceof Error ? dbError.message : "Unknown error"
          });
        }
      }

      return res.status(400).json({ error: "Invalid action" });
    }

    // PUT - Update user
    if (req.method === "PUT") {
      const { id, username, name, password, role, isActive, telegramChatId, linkedReqName } = req.body as {
        id: string;
        username?: string;
        name?: string;
        password?: string;
        role?: string;
        isActive?: boolean;
        telegramChatId?: string;
        linkedReqName?: string;
      };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      // Build update data
      const updateData: {
        username?: string;
        name?: string;
        password?: string;
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

      // Hash password if provided
      if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
      }

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
          passwordChanged: !!(password && password.trim() !== ""),
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
  POST: { tableName: 'admin_users', action: 'sync' },  // Sync action
  PUT: { tableName: 'admin_users', action: 'update' },
  DELETE: { tableName: 'admin_users', action: 'delete' },
});
