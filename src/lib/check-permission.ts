/**
 * Permission Checking Logic
 * Layered permission check: Admin Bypass > User Override > Role Permission > Default Deny
 */

import type { PrismaClient } from "@prisma/client";
import {
  type PermissionCheck,
  type PermissionResult,
  type PermissionAction,
  type TablePermissions,
  ADMIN_ROLES,
} from "./permissions";

// =====================================================
// MAIN PERMISSION CHECK FUNCTION
// =====================================================

/**
 * ตรวจสอบสิทธิ์ของผู้ใช้ต่อ table/page
 *
 * Layered Check Order:
 * 1. Admin Bypass - ถ้าเป็น Admin ได้สิทธิ์ทุกอย่าง
 * 2. User Override - ตรวจสอบ user_table_permission (เผื่ออนาคต)
 * 3. Role Permission - ตรวจสอบ role_permission
 * 4. Default Deny - ถ้าไม่มี permission ใดๆ = ไม่อนุญาต
 */
export async function checkTablePermission(
  db: PrismaClient,
  check: PermissionCheck
): Promise<PermissionResult> {
  const { tableName, action, userId, userRole } = check;

  // 1. Admin Bypass
  if (ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number])) {
    return { allowed: true, reason: 'admin_bypass' };
  }

  // 2. Check User Override (individual permission)
  try {
    // Try new format first: full action name
    const actionKey = `${tableName}.${action}`;
    let userOverride = await db.user_table_permission.findUnique({
      where: {
        userId_tableName: {
          userId,
          tableName: actionKey,
        },
      },
    });

    // Fallback: old format
    if (!userOverride) {
      userOverride = await db.user_table_permission.findUnique({
        where: {
          userId_tableName: {
            userId,
            tableName,
          },
        },
      });
    }

    if (userOverride) {
      // For action-based format, canRead is the "allowed" flag
      const allowed = userOverride.tableName === actionKey
        ? userOverride.canRead
        : getPermissionValue(userOverride, action);
      if (allowed !== null) {
        return {
          allowed,
          reason: 'user_override',
        };
      }
    }
  } catch {
    // Table might not exist yet, continue to role check
  }

  // 3. Check Role Permission
  try {
    const role = await db.system_role.findUnique({
      where: { code: userRole },
      include: { permissions: true },
    });

    if (role) {
      // New format: look for full action name (e.g., "pr_detail.read")
      const actionKey = `${tableName}.${action}`;
      let rolePermission = role.permissions.find(
        (p) => p.tableName === actionKey
      );

      // Fallback: old format - look for just tableName
      if (!rolePermission) {
        rolePermission = role.permissions.find(
          (p) => p.tableName === tableName
        );
      }

      if (rolePermission) {
        // For action-based format, canRead is the "allowed" flag
        // For old format, use getPermissionValue
        const allowed = rolePermission.tableName === actionKey
          ? rolePermission.canRead ?? false
          : getPermissionValue(rolePermission, action) ?? false;
        return {
          allowed,
          reason: 'role_permission',
        };
      }
    }
  } catch {
    // Table might not exist yet, fall through to default deny
  }

  // 4. Default Deny
  return { allowed: false, reason: 'denied' };
}

// =====================================================
// GET ALL PERMISSIONS FOR USER
// =====================================================

/**
 * ดึงสิทธิ์ทั้งหมดของผู้ใช้สำหรับแสดงใน UI
 * Returns: Record<tableName, TablePermissions>
 */
export async function getUserPermissions(
  db: PrismaClient,
  userId: string,
  userRole: string
): Promise<Record<string, TablePermissions>> {
  const permissions: Record<string, TablePermissions> = {};

  // Admin gets full access
  if (ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number])) {
    // Return full access for all tables
    // (will be filled by caller with all table names)
    return permissions;
  }

  try {
    // Get role permissions
    const role = await db.system_role.findUnique({
      where: { code: userRole },
      include: { permissions: true },
    });

    if (role) {
      for (const perm of role.permissions) {
        permissions[perm.tableName] = {
          canCreate: perm.canCreate,
          canRead: perm.canRead,
          canUpdate: perm.canUpdate,
          canDelete: perm.canDelete,
        };
      }
    }

    // Get user overrides
    const userOverrides = await db.user_table_permission.findMany({
      where: { userId },
    });

    for (const override of userOverrides) {
      const existing = permissions[override.tableName] || {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      };

      permissions[override.tableName] = {
        canCreate: override.canCreate ?? existing.canCreate,
        canRead: override.canRead ?? existing.canRead,
        canUpdate: override.canUpdate ?? existing.canUpdate,
        canDelete: override.canDelete ?? existing.canDelete,
      };
    }
  } catch {
    // Tables might not exist yet
  }

  return permissions;
}

// =====================================================
// GET PERMISSIONS FOR A ROLE
// =====================================================

/**
 * ดึงสิทธิ์ทั้งหมดของ Role
 */
export async function getRolePermissions(
  db: PrismaClient,
  roleCode: string
): Promise<Record<string, TablePermissions>> {
  const permissions: Record<string, TablePermissions> = {};

  try {
    const role = await db.system_role.findUnique({
      where: { code: roleCode },
      include: { permissions: true },
    });

    if (role) {
      for (const perm of role.permissions) {
        permissions[perm.tableName] = {
          canCreate: perm.canCreate,
          canRead: perm.canRead,
          canUpdate: perm.canUpdate,
          canDelete: perm.canDelete,
        };
      }
    }
  } catch {
    // Table might not exist yet
  }

  return permissions;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface PermissionRecord {
  canCreate: boolean | null;
  canRead: boolean | null;
  canUpdate: boolean | null;
  canDelete: boolean | null;
}

/**
 * ดึงค่า permission ตาม action
 *
 * Note: Extended actions (execute, search, sync, respond, clear)
 * ใช้ canRead เป็น flag ว่าอนุญาตให้ใช้ feature นี้หรือไม่
 * เพราะ database schema มีแค่ 4 columns (CRUD)
 */
function getPermissionValue(
  permission: PermissionRecord,
  action: PermissionAction
): boolean | null {
  switch (action) {
    case 'create':
      return permission.canCreate;
    case 'read':
      return permission.canRead;
    case 'update':
      return permission.canUpdate;
    case 'delete':
      return permission.canDelete;
    // Extended actions use canRead as "allowed" flag
    case 'execute':
    case 'search':
    case 'sync':
    case 'respond':
    case 'clear':
    case 'requester':
    case 'line_approver':
    case 'cost_center':
    case 'manager':
    case 'final':
    case 'refresh':
      return permission.canRead;
    default:
      return null;
  }
}

/**
 * ตรวจสอบสิทธิ์หลาย actions พร้อมกัน
 */
export async function checkMultiplePermissions(
  db: PrismaClient,
  userId: string,
  userRole: string,
  tableName: string,
  actions: PermissionAction[]
): Promise<Record<PermissionAction, boolean>> {
  const results: Record<PermissionAction, boolean> = {
    create: false,
    read: false,
    update: false,
    delete: false,
    execute: false,
    search: false,
    sync: false,
    respond: false,
    clear: false,
    requester: false,
    line_approver: false,
    cost_center: false,
    manager: false,
    final: false,
    refresh: false,
  };

  for (const action of actions) {
    const result = await checkTablePermission(db, {
      tableName,
      action,
      userId,
      userRole,
    });
    results[action] = result.allowed;
  }

  return results;
}

/**
 * ตรวจสอบสิทธิ์ทั้ง 4 actions ของ table
 */
export async function getTablePermissionsForUser(
  db: PrismaClient,
  userId: string,
  userRole: string,
  tableName: string
): Promise<TablePermissions> {
  const results = await checkMultiplePermissions(
    db,
    userId,
    userRole,
    tableName,
    ['create', 'read', 'update', 'delete']
  );

  return {
    canCreate: results.create,
    canRead: results.read,
    canUpdate: results.update,
    canDelete: results.delete,
  };
}
