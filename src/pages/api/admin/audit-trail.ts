import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method === "GET") {
      const { startDate, endDate } = req.query;

      // Build query conditions
      const whereCondition = startDate && endDate
        ? {
            created_at: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string),
            },
          }
        : {};

      const activities = await db.activity_trail.findMany({
        where: whereCondition,
        orderBy: {
          created_at: 'desc',
        },
        take: 1000,
      });

      return res.status(200).json({
        success: true,
        activities,
        count: activities.length,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Audit trail API error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Apply permission middleware - protect admin audit trail
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_audit', action: 'read' },
});
