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
    // Get PR Attachments stats
    const prAttachmentsCount = await db.pr_attachments.count();
    const prAttachmentsLastSync = await db.pr_attachments.findFirst({
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    });

    // Get PO Attachments stats
    const poAttachmentsCount = await db.po_attachments.count();
    const poAttachmentsLastSync = await db.po_attachments.findFirst({
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    });

    // Get PR Project Link stats
    const prProjectLinkCount = await db.pr_project_link.count();
    const prProjectLinkLastSync = await db.pr_project_link.findFirst({
      orderBy: { updated_at: "desc" },
      select: { updated_at: true },
    });

    return res.status(200).json({
      prAttachments: {
        count: prAttachmentsCount,
        lastSync: prAttachmentsLastSync?.created_at?.toISOString() || null,
      },
      poAttachments: {
        count: poAttachmentsCount,
        lastSync: poAttachmentsLastSync?.created_at?.toISOString() || null,
      },
      prProjectLink: {
        count: prProjectLinkCount,
        lastSync: prProjectLinkLastSync?.updated_at?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Attachment sync stats error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลได้" });
  }
}

// Apply permission middleware - protect attachment sync stats
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_sync_attach', action: 'read' },
});
