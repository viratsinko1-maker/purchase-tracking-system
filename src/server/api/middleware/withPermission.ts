/**
 * API Permission Middleware
 * ใช้สำหรับ protect Next.js API routes
 */

import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { db } from "~/server/db";
import { checkTablePermission } from "~/lib/check-permission";
import { isAdminRole, type PermissionAction } from "~/lib/permissions";

// =====================================================
// TYPES
// =====================================================

interface User {
  id: string;
  role: string;
}

interface WithPermissionOptions {
  tableName: string;
  action: PermissionAction;
}

interface ApiError {
  error: string;
  reason?: string;
}

// =====================================================
// USER EXTRACTION
// =====================================================

/**
 * ดึงข้อมูล user จาก request headers หรือ cookies
 * ในอนาคตอาจปรับเป็น JWT หรือ session
 */
async function getUserFromRequest(req: NextApiRequest): Promise<User | null> {
  // Try to get from custom headers (for API calls from frontend)
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;

  if (userId && userRole) {
    return { id: userId, role: userRole };
  }

  // Try to get from cookies (session-based auth)
  const userCookie = req.cookies['user'];
  if (userCookie) {
    try {
      const parsed = JSON.parse(userCookie) as { id?: string; role?: string };
      if (parsed.id && parsed.role) {
        return { id: parsed.id, role: parsed.role };
      }
    } catch {
      // Invalid cookie format
    }
  }

  // Try to get from body (for POST requests that include user info)
  if (req.body && typeof req.body === 'object') {
    const body = req.body as { userId?: string; userRole?: string };
    if (body.userId && body.userRole) {
      return { id: body.userId, role: body.userRole };
    }
  }

  return null;
}

// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

/**
 * Middleware สำหรับตรวจสอบสิทธิ์ก่อนเข้าถึง API
 *
 * Usage:
 * ```typescript
 * export default withTablePermission(handler, { tableName: 'admin_users', action: 'read' });
 * ```
 */
export function withTablePermission(
  handler: NextApiHandler,
  options: WithPermissionOptions
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse<unknown | ApiError>) => {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        reason: 'No user credentials provided',
      });
    }

    // Admin bypass
    if (isAdminRole(user.role)) {
      return handler(req, res);
    }

    // Check permission
    const result = await checkTablePermission(db, {
      tableName: options.tableName,
      action: options.action,
      userId: user.id,
      userRole: user.role,
    });

    if (!result.allowed) {
      return res.status(403).json({
        error: 'Permission denied',
        reason: result.reason,
      });
    }

    // Proceed with handler
    return handler(req, res);
  };
}

/**
 * Middleware สำหรับตรวจสอบว่าเป็น Admin เท่านั้น
 */
export function withAdminOnly(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse<unknown | ApiError>) => {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        reason: 'No user credentials provided',
      });
    }

    if (!isAdminRole(user.role)) {
      return res.status(403).json({
        error: 'Admin access required',
        reason: 'Only Admin role can access this resource',
      });
    }

    return handler(req, res);
  };
}

/**
 * Middleware สำหรับตรวจสอบว่า login แล้ว (ไม่ check permission)
 */
export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse<unknown | ApiError>) => {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        reason: 'No user credentials provided',
      });
    }

    return handler(req, res);
  };
}

// =====================================================
// CONVENIENCE SHORTCUTS
// =====================================================

/**
 * Shortcut สำหรับ read permission
 */
export function withReadPermission(tableName: string): (handler: NextApiHandler) => NextApiHandler {
  return (handler) => withTablePermission(handler, { tableName, action: 'read' });
}

/**
 * Shortcut สำหรับ create permission
 */
export function withCreatePermission(tableName: string): (handler: NextApiHandler) => NextApiHandler {
  return (handler) => withTablePermission(handler, { tableName, action: 'create' });
}

/**
 * Shortcut สำหรับ update permission
 */
export function withUpdatePermission(tableName: string): (handler: NextApiHandler) => NextApiHandler {
  return (handler) => withTablePermission(handler, { tableName, action: 'update' });
}

/**
 * Shortcut สำหรับ delete permission
 */
export function withDeletePermission(tableName: string): (handler: NextApiHandler) => NextApiHandler {
  return (handler) => withTablePermission(handler, { tableName, action: 'delete' });
}

// =====================================================
// COMBINED PERMISSION CHECK BY HTTP METHOD
// =====================================================

interface MethodPermissions {
  GET?: { tableName: string; action: PermissionAction };
  POST?: { tableName: string; action: PermissionAction };
  PUT?: { tableName: string; action: PermissionAction };
  PATCH?: { tableName: string; action: PermissionAction };
  DELETE?: { tableName: string; action: PermissionAction };
}

/**
 * Middleware ที่ตรวจสอบ permission ตาม HTTP method
 *
 * Usage:
 * ```typescript
 * export default withMethodPermissions(handler, {
 *   GET: { tableName: 'admin_users', action: 'read' },
 *   POST: { tableName: 'admin_users', action: 'create' },
 *   PUT: { tableName: 'admin_users', action: 'update' },
 *   DELETE: { tableName: 'admin_users', action: 'delete' },
 * });
 * ```
 */
export function withMethodPermissions(
  handler: NextApiHandler,
  permissions: MethodPermissions
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse<unknown | ApiError>) => {
    const method = req.method as keyof MethodPermissions;
    const permission = permissions[method];

    // If no permission defined for this method, allow through
    if (!permission) {
      return handler(req, res);
    }

    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        reason: 'No user credentials provided',
      });
    }

    // Admin bypass
    if (isAdminRole(user.role)) {
      return handler(req, res);
    }

    // Check permission
    const result = await checkTablePermission(db, {
      tableName: permission.tableName,
      action: permission.action,
      userId: user.id,
      userRole: user.role,
    });

    if (!result.allowed) {
      return res.status(403).json({
        error: 'Permission denied',
        reason: result.reason,
      });
    }

    return handler(req, res);
  };
}
