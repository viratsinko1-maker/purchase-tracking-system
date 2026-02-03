/**
 * API: Admin Permission Management
 * CRUD สำหรับจัดการสิทธิ์ของ Role
 *
 * GET /api/admin/permissions - ดึง permissions ทั้งหมด
 * GET /api/admin/permissions?roleId=xxx - ดึง permissions ของ role
 * POST /api/admin/permissions - บันทึก/อัพเดท permissions
 * DELETE /api/admin/permissions?roleId=xxx&tableName=xxx - ลบ permission
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { withAdminOnly } from "~/server/api/middleware/withPermission";
import { PROTECTED_TABLES } from "~/lib/permissions";

interface RolePermission {
  id: number;
  roleId: number;
  tableName: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

interface RoleWithPermissions {
  id: number;
  name: string;
  code: string;
  priority: number;
  permissions: RolePermission[];
}

interface TableMetadataItem {
  tableName: string;
  friendlyName: string;
  category: string;
  description?: string;
}

interface GetResponse {
  roles: RoleWithPermissions[];
  tables: TableMetadataItem[];
}

interface SuccessResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

interface ErrorResponse {
  error: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | SuccessResponse | ErrorResponse>
) {
  const { method } = req;

  switch (method) {
    case "GET":
      return handleGet(req, res);
    case "POST":
      return handlePost(req, res);
    case "DELETE":
      return handleDelete(req, res);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

/**
 * GET: ดึง permissions ทั้งหมดหรือของ role เดียว
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | ErrorResponse>
) {
  const { roleId } = req.query;

  try {
    // Get all roles with their permissions
    const roles = await db.system_role.findMany({
      where: {
        isActive: true,
        ...(roleId ? { id: parseInt(roleId as string) } : {}),
      },
      include: {
        permissions: true,
      },
      orderBy: { priority: "asc" },
    });

    // Get table metadata
    const tables: TableMetadataItem[] = Object.entries(PROTECTED_TABLES).map(
      ([tableName, meta]) => ({
        tableName,
        friendlyName: meta.friendlyName,
        category: meta.category,
        description: meta.description,
      })
    );

    // Also try to get from database if exists
    try {
      const dbTables = await db.table_metadata.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      });

      if (dbTables.length > 0) {
        // Merge with static tables, preferring database values
        const dbTableMap = new Map(dbTables.map((t) => [t.tableName, t]));
        tables.forEach((t, i) => {
          const dbTable = dbTableMap.get(t.tableName);
          if (dbTable) {
            tables[i] = {
              tableName: dbTable.tableName,
              friendlyName: dbTable.friendlyName,
              category: dbTable.category,
              description: dbTable.description ?? undefined,
            };
          }
        });
      }
    } catch {
      // table_metadata table might not exist yet
    }

    return res.status(200).json({
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        code: role.code,
        priority: role.priority,
        permissions: role.permissions.map((p) => ({
          id: p.id,
          roleId: p.roleId,
          tableName: p.tableName,
          canCreate: p.canCreate,
          canRead: p.canRead,
          canUpdate: p.canUpdate,
          canDelete: p.canDelete,
        })),
      })),
      tables,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST: บันทึก/อัพเดท permissions
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  const { roleId, permissions, userName } = req.body as {
    roleId: number;
    permissions: Array<{
      tableName: string;
      canCreate: boolean;
      canRead: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }>;
    userName?: string;
  };

  if (!roleId || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({
      error: "Missing required fields: roleId, permissions",
    });
  }

  try {
    // Verify role exists
    const role = await db.system_role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Use transaction to update all permissions
    await db.$transaction(async (tx) => {
      for (const perm of permissions) {
        await tx.role_permission.upsert({
          where: {
            roleId_tableName: {
              roleId,
              tableName: perm.tableName,
            },
          },
          update: {
            canCreate: perm.canCreate,
            canRead: perm.canRead,
            canUpdate: perm.canUpdate,
            canDelete: perm.canDelete,
            updatedAt: new Date(),
          },
          create: {
            roleId,
            tableName: perm.tableName,
            canCreate: perm.canCreate,
            canRead: perm.canRead,
            canUpdate: perm.canUpdate,
            canDelete: perm.canDelete,
            updatedAt: new Date(),
          },
        });
      }
    });

    // Log activity
    try {
      const userId = req.headers["x-user-id"] as string;

      await db.activity_trail.create({
        data: {
          user_id: userId || "system",
          user_name: userName || "System", // userName มาจาก body
          action: "UPDATE",
          table_name: "role_permission",
          record_id: roleId.toString(),
          description: `Updated permissions for role: ${role.name}`,
          new_values: permissions,
        },
      });
    } catch {
      // Activity trail logging is optional
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${permissions.length} permissions for role: ${role.name}`,
    });
  } catch (error) {
    console.error("Error saving permissions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE: ลบ permission
 */
async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  const { roleId, tableName } = req.query;

  if (!roleId || !tableName) {
    return res.status(400).json({
      error: "Missing required parameters: roleId, tableName",
    });
  }

  try {
    await db.role_permission.delete({
      where: {
        roleId_tableName: {
          roleId: parseInt(roleId as string),
          tableName: tableName as string,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting permission:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withAdminOnly(handler);
