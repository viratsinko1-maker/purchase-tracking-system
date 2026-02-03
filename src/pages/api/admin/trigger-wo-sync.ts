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
    const { runFullAutoSync } = await import("~/server/auto-sync-scheduler");

    // Run the full auto sync (includes WO sync)
    const result = await runFullAutoSync();

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "WO Sync completed successfully",
        duration: result.duration,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || "Sync failed",
      });
    }
  } catch (error) {
    console.error("Trigger WO sync error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "ไม่สามารถ Sync ได้"
    });
  }
}

// Apply permission middleware - protect manual WO sync trigger
export default withMethodPermissions(handler, {
  POST: { tableName: 'admin_sync', action: 'execute' },
});
