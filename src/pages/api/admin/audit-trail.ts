import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

/**
 * Format timestamp to Thailand time
 * Database stores UTC time in timestamp without timezone column
 * We need to convert UTC to Bangkok (UTC+7)
 */
function formatBangkokTime(date: Date | null | undefined): string | null {
  if (!date) return null;

  // Add 7 hours to convert UTC to Bangkok time
  const bangkokTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));

  const day = String(bangkokTime.getUTCDate()).padStart(2, '0');
  const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0');
  const year = bangkokTime.getUTCFullYear() + 543; // Buddhist year
  const hours = String(bangkokTime.getUTCHours()).padStart(2, '0');
  const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(bangkokTime.getUTCSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Disable caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    if (req.method === "GET") {
      const { startDate, endDate } = req.query;

      let whereCondition = {};

      if (startDate && endDate) {
        const startDateObj = new Date(startDate as string);
        const endDateObj = new Date(endDate as string);

        whereCondition = {
          created_at: {
            gte: startDateObj,
            lte: endDateObj,
          },
        };
      }

      const rawActivities = await db.activity_trail.findMany({
        where: whereCondition,
        orderBy: {
          created_at: 'desc',
        },
        take: 1000,
      });

      // Debug log
      if (rawActivities.length > 0) {
        const first = rawActivities[0];
        if (first?.created_at) {
          console.log('[AUDIT] First record:');
          console.log('  - ISO:', first.created_at.toISOString());
          console.log('  - UTC hours:', first.created_at.getUTCHours());
          console.log('  - Bangkok formatted:', formatBangkokTime(first.created_at));
        }
      }

      const activities = rawActivities.map(activity => ({
        ...activity,
        created_at: activity.created_at?.toISOString() ?? null,
        created_at_epoch: activity.created_at?.getTime() ?? null,
        created_at_thai: formatBangkokTime(activity.created_at),
      }));

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

export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_audit', action: 'read' },
});
