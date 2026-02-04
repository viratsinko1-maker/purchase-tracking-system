/**
 * WO Router สำหรับ Work Order Sync
 * ใช้ tRPC procedures แทน REST API เพื่อให้มี authentication context
 */

import {
  createTRPCRouter,
  createTableProcedure,
} from "~/server/api/trpc";

/**
 * WO Router
 */
export const woRouter = createTRPCRouter({
  /**
   * Get WO Sync Statistics
   */
  getSyncStats: createTableProcedure('admin_sync_wo', 'read')
    .query(async ({ ctx }) => {
      // Get WO Summary stats
      const woSummaryCount = await ctx.db.wo_summary.count();
      const woSummaryLastSync = await ctx.db.wo_summary.findFirst({
        orderBy: { last_sync_date: "desc" },
        select: { last_sync_date: true },
      });

      // Get WO GI Detail stats
      const woGIDetailCount = await ctx.db.wo_gi_detail.count();
      const woGIDetailLastSync = await ctx.db.wo_gi_detail.findFirst({
        orderBy: { last_sync_date: "desc" },
        select: { last_sync_date: true },
      });

      // Get WO PO Detail stats
      const woPODetailCount = await ctx.db.wo_po_detail.count();
      const woPODetailLastSync = await ctx.db.wo_po_detail.findFirst({
        orderBy: { last_sync_date: "desc" },
        select: { last_sync_date: true },
      });

      // Get PR-WO Link stats
      const prWOLinkCount = await ctx.db.pr_wo_link.count();
      const prWOLinkLastSync = await ctx.db.pr_wo_link.findFirst({
        orderBy: { last_sync_date: "desc" },
        select: { last_sync_date: true },
      });

      return {
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
      };
    }),

  /**
   * Trigger WO Sync (runs full auto sync which includes WO)
   */
  sync: createTableProcedure('admin_sync', 'execute')
    .mutation(async () => {
      try {
        // Import dynamically to avoid circular deps
        const { runFullAutoSync } = await import("~/server/auto-sync-scheduler");

        // Run the full auto sync (includes WO sync)
        const result = await runFullAutoSync();

        if (result.success) {
          return {
            success: true,
            message: "WO Sync completed successfully",
            duration: result.duration,
          };
        } else {
          return {
            success: false,
            error: result.error || "Sync failed",
          };
        }
      } catch (error) {
        console.error("Trigger WO sync error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "ไม่สามารถ Sync ได้",
        };
      }
    }),
});
