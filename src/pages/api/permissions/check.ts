/**
 * API: Check Permission
 * ตรวจสอบสิทธิ์ของ user ต่อ table/page
 *
 * GET /api/permissions/check?table=xxx&action=read&userId=xxx
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { checkTablePermission, getTablePermissionsForUser } from "~/lib/check-permission";
import { isAdminRole, type PermissionAction } from "~/lib/permissions";

interface SuccessResponse {
  allowed?: boolean;
  canCreate?: boolean;
  canRead?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  reason?: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { table, action, userId } = req.query;
  const userRole = req.headers["x-user-role"] as string | undefined;

  if (!table || typeof table !== "string") {
    return res.status(400).json({ error: "Missing table parameter" });
  }

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  const role = userRole || "PR"; // Default to PR if no role provided

  // Admin bypass - return all permissions
  if (isAdminRole(role)) {
    if (action && typeof action === "string") {
      return res.status(200).json({
        allowed: true,
        reason: "admin_bypass",
      });
    }
    return res.status(200).json({
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    });
  }

  try {
    // If specific action is requested, check that action
    if (action && typeof action === "string") {
      const result = await checkTablePermission(db, {
        tableName: table,
        action: action as PermissionAction,
        userId,
        userRole: role,
      });

      return res.status(200).json({
        allowed: result.allowed,
        reason: result.reason,
      });
    }

    // Otherwise, return all permissions for the table
    const permissions = await getTablePermissionsForUser(db, userId, role, table);

    return res.status(200).json({
      canCreate: permissions.canCreate,
      canRead: permissions.canRead,
      canUpdate: permissions.canUpdate,
      canDelete: permissions.canDelete,
    });
  } catch (error) {
    console.error("Error checking permission:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
