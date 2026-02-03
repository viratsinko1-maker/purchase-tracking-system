/**
 * API: Get User Permissions
 * ดึงสิทธิ์ทั้งหมดของ user สำหรับแสดงใน UI
 *
 * GET /api/permissions/user?userId=xxx
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { getUserPermissions } from "~/lib/check-permission";
import { isAdminRole, PROTECTED_TABLES, type TablePermissions } from "~/lib/permissions";

type SuccessResponse = Record<string, TablePermissions>;

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

  const { userId } = req.query;
  const userRole = req.headers["x-user-role"] as string | undefined;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  const role = userRole || "PR";

  try {
    // Admin gets full permissions on all tables
    if (isAdminRole(role)) {
      const allPermissions: Record<string, TablePermissions> = {};
      Object.keys(PROTECTED_TABLES).forEach((table) => {
        allPermissions[table] = {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        };
      });
      return res.status(200).json(allPermissions);
    }

    // Get user's permissions from database
    const permissions = await getUserPermissions(db, userId, role);

    // Fill in missing tables with default deny
    const allPermissions: Record<string, TablePermissions> = {};
    Object.keys(PROTECTED_TABLES).forEach((table) => {
      allPermissions[table] = permissions[table] || {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      };
    });

    return res.status(200).json(allPermissions);
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
