import type { NextApiRequest, NextApiResponse } from "next";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Import the sync function dynamically to avoid circular deps
    const { runManualAttachmentSync } = await import("~/server/attachment-sync-scheduler");

    // Run the attachment sync
    const result = await runManualAttachmentSync();

    return res.status(200).json({
      success: true,
      message: "Attachment Sync completed successfully",
      duration: result?.duration,
      prResult: result?.prResult,
      poResult: result?.poResult,
      projectResult: result?.projectResult,
    });
  } catch (error) {
    console.error("Trigger attachment sync error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "ไม่สามารถ Sync ได้"
    });
  }
}

// Apply permission middleware - protect manual attachment sync trigger
export default withMethodPermissions(handler, {
  POST: { tableName: 'admin_sync', action: 'execute' },
});
