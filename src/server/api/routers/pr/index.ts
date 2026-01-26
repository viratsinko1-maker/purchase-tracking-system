/**
 * PR Router - Main entry point
 * Merges all PR sub-routers into a single router
 */
import { createTRPCRouter } from "~/server/api/trpc";

// Import sub-routers
import { prOverviewRouter } from "./pr-overview";
import { prSyncRouter } from "./pr-sync";
import { prTrackingRouter } from "./pr-tracking";
import { prReceiptRouter } from "./pr-receipt";
import { prApprovalRouter } from "./pr-approval";
import { prReportsRouter } from "./pr-reports";

// Merge all sub-routers
export const prRouter = createTRPCRouter({
  // PR Overview (getAllSummary, getByPRNo, getStats, getPRAttachments, getPOInfo, getPOInfoBatch)
  ...prOverviewRouter._def.procedures,

  // PR Sync (sync, refreshView, getSyncHistory, getSyncChanges)
  ...prSyncRouter._def.procedures,

  // PR Tracking (createTracking, getTrackingHistory, getLatestTrackings, responses, getAllQA)
  ...prTrackingRouter._def.procedures,

  // PR Receipt (getDocumentReceipt, getApproversPreview, saveDocumentReceipt, getAllReceivedPRs)
  ...prReceiptRouter._def.procedures,

  // PR Approval (approveIndividual, clearApproval, getMyPendingApprovals, etc.)
  ...prApprovalRouter._def.procedures,

  // PR Reports (getDelayedPRsGrouped, triggerDelayedNotification)
  ...prReportsRouter._def.procedures,
});
