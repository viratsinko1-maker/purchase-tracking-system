/**
 * PR Reports Router - getDelayedPRsGrouped, triggerDelayedNotification
 */
import { createTRPCRouter, createTableProcedure } from "~/server/api/trpc";

export const prReportsRouter = createTRPCRouter({
  // Get delayed PRs grouped by delay days (for Telegram notification)
  getDelayedPRsGrouped: createTableProcedure('pr_tracking', 'read')
    .query(async ({ ctx }) => {
      const data = await ctx.db.$queryRawUnsafe(`
        SELECT
          s.doc_num,
          s.job_name,
          s.req_name,
          s.create_date,
          s.doc_status,
          r.receipt_date
        FROM mv_pr_summary s
        LEFT JOIN pr_document_receipt r ON s.doc_num = r.pr_doc_num
        WHERE s.doc_status = 'O'
        ORDER BY s.doc_num
      `) as any[];

      const today = new Date();
      const grouped: Record<number, any[]> = {};

      data.forEach((pr: any) => {
        let baseDate: Date;

        if (pr.receipt_date) {
          baseDate = new Date(pr.receipt_date);
        } else {
          baseDate = new Date(pr.create_date);
        }

        const diffTime = today.getTime() - baseDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const delayDays = diffDays > 10 ? diffDays - 10 : 0;

        if (delayDays >= 1) {
          let groupKey: number | null = null;

          if (delayDays === 1) {
            groupKey = 1;
          } else if (delayDays >= 7 && delayDays % 7 === 0) {
            groupKey = delayDays;
          }

          if (groupKey !== null) {
            if (!grouped[groupKey]) {
              grouped[groupKey] = [];
            }

            grouped[groupKey]!.push({
              doc_num: pr.doc_num,
              job_name: pr.job_name,
              req_name: pr.req_name,
              delay_days: delayDays,
            });
          }
        }
      });

      const result = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b)
        .map((key) => ({
          delay_milestone: key,
          prs: grouped[key]!,
        }));

      return result;
    }),

  // Manual trigger for delayed PR notification
  triggerDelayedNotification: createTableProcedure('admin_sync', 'execute')
    .mutation(async ({ ctx }) => {
      try {
        const { notifyDelayedPRs } = await import('~/server/services/telegram');

        const data = await ctx.db.$queryRawUnsafe<any[]>(`
          WITH delayed_prs AS (
            SELECT
              s.doc_num,
              s.job_name,
              s.req_name,
              s.create_date,
              r.receipt_date,
              CASE
                WHEN r.receipt_date IS NOT NULL
                THEN CAST(CURRENT_DATE - CAST(r.receipt_date AS DATE) AS INTEGER)
                ELSE CAST(CURRENT_DATE - CAST(s.create_date AS DATE) AS INTEGER)
              END AS delay_days
            FROM mv_pr_summary s
            LEFT JOIN pr_document_receipt r ON s.doc_num = r.pr_doc_num
            WHERE s.doc_status = 'O'
          )
          SELECT doc_num, job_name, req_name, delay_days
          FROM delayed_prs
          WHERE delay_days > 10
          ORDER BY delay_days DESC, doc_num DESC
        `);

        const grouped: Record<number, any[]> = {};

        data.forEach((pr) => {
          const delayDays = pr.delay_days - 10;
          let groupKey: number | null = null;

          if (delayDays === 1) {
            groupKey = 1;
          } else if (delayDays >= 7 && delayDays % 7 === 0) {
            groupKey = delayDays;
          }

          if (groupKey !== null) {
            if (!grouped[groupKey]) {
              grouped[groupKey] = [];
            }
            grouped[groupKey]!.push(pr);
          }
        });

        const delayedPRs = Object.keys(grouped)
          .map(Number)
          .sort((a, b) => a - b)
          .map((key) => ({
            delay_milestone: key,
            prs: grouped[key]!,
          }));

        if (!delayedPRs || delayedPRs.length === 0) {
          return { success: true, message: 'No delayed PRs to notify', count: 0 };
        }

        await notifyDelayedPRs(delayedPRs);

        return {
          success: true,
          message: 'Notification sent successfully',
          count: delayedPRs.length,
          groups: delayedPRs.map((g) => ({
            milestone: g.delay_milestone,
            count: g.prs.length,
          })),
        };
      } catch (error) {
        console.error('[Manual Trigger] Error:', error);
        throw new Error('Failed to send notification');
      }
    }),
});
