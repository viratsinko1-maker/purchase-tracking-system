import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getClientIp } from "~/server/utils/getClientIp";

// Define activity action types
export const ActivityAction = z.enum([
  'LOGIN',
  'LOGOUT',
  'VIEW_PR',
  'TRACK_PR',
  'RESPONSE_PR',
  'VIEW_PO',
  'TRACK_DELIVERY',
  'SYNC_DATA',
]);

export type ActivityActionType = z.infer<typeof ActivityAction>;

export const activityTrailRouter = createTRPCRouter({
  /**
   * Log an activity to the activity trail
   */
  logActivity: publicProcedure
    .input(z.object({
      user_id: z.string().optional(),
      user_name: z.string().optional(),
      action: ActivityAction,
      description: z.string().optional(),
      pr_no: z.number().optional(),
      po_no: z.number().optional(),
      tracking_id: z.number().optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ipAddress = ctx.req ? getClientIp(ctx.req) : 'unknown';

      await ctx.db.activity_trail.create({
        data: {
          user_id: input.user_id ?? undefined,
          user_name: input.user_name ?? undefined,
          ip_address: ipAddress,
          action: input.action,
          description: input.description,
          pr_no: input.pr_no,
          po_no: input.po_no,
          tracking_id: input.tracking_id,
          metadata: input.metadata ?? undefined,
        },
      });

      return { success: true };
    }),

  /**
   * Get activity trail logs with filters
   */
  getActivities: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
      action: ActivityAction.optional(),
      prNo: z.number().optional(),
      poNo: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const whereClause: any = {};

      if (input.userId) whereClause.user_id = input.userId;
      if (input.action) whereClause.action = input.action;
      if (input.prNo) whereClause.pr_no = input.prNo;
      if (input.poNo) whereClause.po_no = input.poNo;

      const [activities, total] = await Promise.all([
        ctx.db.activity_trail.findMany({
          where: whereClause,
          orderBy: { created_at: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.activity_trail.count({ where: whereClause }),
      ]);

      return {
        activities,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),
});
