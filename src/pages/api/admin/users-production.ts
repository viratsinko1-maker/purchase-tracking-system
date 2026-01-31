import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import bcrypt from "bcrypt";
import pg from "pg";

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

export default async function handler(
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
      const { action } = req.body as { action?: string };

      if (action === "sync") {
        const tmkClient = getTmkClient();

        try {
          await tmkClient.connect();

          // Get all active users from TMK_PDPJ01 (only those with verified email)
          const result = await tmkClient.query(`
            SELECT id, name, email, "isActive"
            FROM "User"
            WHERE email IS NOT NULL
              AND email != ''
              AND "isActive" = true
          `);

          const tmkUsers = result.rows as Array<{
            id: string;
            name: string;
            email: string;
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
              // Update existing user (only name/username, keep password/role)
              await db.user_production.update({
                where: { email },
                data: {
                  username: tmkUser.name,
                  name: tmkUser.name,
                  sourceId: tmkUser.id,
                  isActive: true, // Re-activate if was deactivated
                  lastSyncAt: new Date(),
                },
              });
              updated++;
            } else {
              // Create new user with default password and role
              await db.user_production.create({
                data: {
                  id: tmkUser.id, // Use TMK user ID as primary key
                  email: email,
                  userId: email, // Use email as userId for login
                  username: tmkUser.name,
                  name: tmkUser.name,
                  password: hashedPassword,
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
            where: { isActive: true },
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
      const { id, username, name, password, role, isActive, telegramChatId } = req.body as {
        id: string;
        username?: string;
        name?: string;
        password?: string;
        role?: string;
        isActive?: boolean;
        telegramChatId?: string;
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
      } = {};

      if (username !== undefined) updateData.username = username;
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId || null;

      // Hash password if provided
      if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
      }

      const updatedUser = await db.user_production.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json({ user: updatedUser });
    }

    // DELETE - Delete user (admin only, permanent delete)
    if (req.method === "DELETE") {
      const { id } = req.body as { id: string };

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ User ID" });
      }

      await db.user_production.delete({
        where: { id },
      });

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
