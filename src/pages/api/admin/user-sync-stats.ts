import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get total users count
    const totalUsers = await db.user_production.count();

    // Get active users count
    const activeUsers = await db.user_production.count({
      where: { isActive: true },
    });

    // Get inactive users count
    const inactiveUsers = await db.user_production.count({
      where: { isActive: false },
    });

    // Get last sync time
    const lastSyncUser = await db.user_production.findFirst({
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    });

    // Get role distribution
    const roleGroups = await db.user_production.groupBy({
      by: ["role"],
      _count: {
        role: true,
      },
      orderBy: {
        _count: {
          role: "desc",
        },
      },
    });

    const roleDistribution = roleGroups.map((group) => ({
      role: group.role,
      count: group._count.role,
    }));

    // Get recently synced users (last 20)
    const recentSyncedUsers = await db.user_production.findMany({
      orderBy: { lastSyncAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastSyncAt: true,
      },
    });

    return res.status(200).json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      lastSyncAt: lastSyncUser?.lastSyncAt?.toISOString() || null,
      roleDistribution,
      recentSyncedUsers: recentSyncedUsers.map((user) => ({
        ...user,
        lastSyncAt: user.lastSyncAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("User sync stats error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลได้" });
  }
}

// Apply permission middleware - protect user sync stats
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_sync_user', action: 'read' },
});
