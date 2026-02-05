import { prpoRouter } from "~/server/api/routers/prpo";
import { prRouter } from "~/server/api/routers/pr";
import { poRouter } from "~/server/api/routers/po";
import { woRouter } from "~/server/api/routers/wo";
import { testRouter } from "~/server/api/routers/test";
import { syncRouter } from "~/server/api/routers/sync";
import { activityTrailRouter } from "~/server/api/routers/activityTrail";
import { wSeriesRouter } from "~/server/api/routers/w-series";
import { kpiRouter } from "~/server/api/routers/kpi";
import { notificationRouter } from "~/server/api/routers/notification";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  prpo: prpoRouter,  // Schema เก่า (deprecated - จะลบในอนาคต)
  pr: prRouter,      // Schema ใหม่ v2.0
  po: poRouter,      // PO Tracking v1.0
  wo: woRouter,      // WO Sync v1.0
  test: testRouter,  // Test utilities
  sync: syncRouter,  // Auto-Sync Status & Control
  activityTrail: activityTrailRouter,  // Activity Trail Logging
  wSeries: wSeriesRouter,  // W Series (WO, WR, WA, WC)
  kpi: kpiRouter,    // KPI Tracking (Approval & Receive Confirm)
  notification: notificationRouter,  // User Notifications (TopBar)
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
