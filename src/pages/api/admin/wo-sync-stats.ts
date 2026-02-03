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
    // Get WO Summary stats
    const woSummaryCount = await db.wo_summary.count();
    const woSummaryLastSync = await db.wo_summary.findFirst({
      orderBy: { last_sync_date: "desc" },
      select: { last_sync_date: true },
    });

    // Get WO GI Detail stats
    const woGIDetailCount = await db.wo_gi_detail.count();
    const woGIDetailLastSync = await db.wo_gi_detail.findFirst({
      orderBy: { last_sync_date: "desc" },
      select: { last_sync_date: true },
    });

    // Get WO PO Detail stats
    const woPODetailCount = await db.wo_po_detail.count();
    const woPODetailLastSync = await db.wo_po_detail.findFirst({
      orderBy: { last_sync_date: "desc" },
      select: { last_sync_date: true },
    });

    // Get PR-WO Link stats
    const prWOLinkCount = await db.pr_wo_link.count();
    const prWOLinkLastSync = await db.pr_wo_link.findFirst({
      orderBy: { last_sync_date: "desc" },
      select: { last_sync_date: true },
    });

    return res.status(200).json({
      woSummary: {
        count: woSummaryCount,
        lastSync: woSummaryLastSync?.last_sync_date?.toISOString() || null,
      },
      woGIDetail: {
        count: woGIDetailCount,
        lastSync: woGIDetailLastSync?.last_sync_date?.toISOString() || null,
      },
      woPODetail: {
        count: woPODetailCount,
        lastSync: woPODetailLastSync?.last_sync_date?.toISOString() || null,
      },
      prWOLink: {
        count: prWOLinkCount,
        lastSync: prWOLinkLastSync?.last_sync_date?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("WO sync stats error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลได้" });
  }
}

// Apply permission middleware - protect WO sync stats
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_sync_wo', action: 'read' },
});
