/**
 * W Series Router - WO, WR, WA, WC endpoints
 */
import { z } from "zod";
import { createTRPCRouter, createTableProcedure } from "~/server/api/trpc";

export const wSeriesRouter = createTRPCRouter({
  // =====================================================
  // WO - Work Order List
  // =====================================================
  getWOList: createTableProcedure('w_series_wo', 'read')
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        department: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, search, department, limit, offset } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter: wo_doc_num must exist
      conditions.push('wo_doc_num IS NOT NULL');

      if (dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          wo_doc_num::TEXT ILIKE $${paramIndex} OR
          req_name ILIKE $${paramIndex} OR
          item_name ILIKE $${paramIndex} OR
          wo_order_1 ILIKE $${paramIndex} OR
          pr_mac ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (department) {
        conditions.push(`dept_name ILIKE $${paramIndex}`);
        params.push(`%${department}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT
          wo_doc_num,
          wo_doc_entry,
          wo_series_name,
          doc_date,
          req_name,
          department,
          dept_name,
          pr_mac,
          item_name,
          wo_order_1,
          wo_respond_by,
          wo_u_date,
          wo_u_finish,
          wo_close_date,
          wo_approver,
          wr_doc_num,
          wr_series_name,
          wr_close_date,
          wa_doc_num,
          wa_series_name,
          wa_finish_date,
          wc_doc_num,
          wc_series_name,
          wc_close_date
        FROM wo_summary
        ${whereClause}
        ORDER BY doc_date DESC, wo_doc_num DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM wo_summary
        ${whereClause}
      `;
      const countResult = await ctx.db.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) as any[];
      const total = Number(countResult[0]?.total || 0);

      return {
        data: data.map(row => ({
          ...row,
          wo_doc_num: row.wo_doc_num ? Number(row.wo_doc_num) : null,
          wr_doc_num: row.wr_doc_num ? Number(row.wr_doc_num) : null,
          wa_doc_num: row.wa_doc_num ? Number(row.wa_doc_num) : null,
          wc_doc_num: row.wc_doc_num ? Number(row.wc_doc_num) : null,
        })),
        total,
        limit,
        offset,
      };
    }),

  // =====================================================
  // WR - Work Response List
  // =====================================================
  getWRList: createTableProcedure('w_series_wr', 'read')
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, search, limit, offset } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter: wr_doc_num must exist and wr_series_name starts with 'WR'
      conditions.push("wr_doc_num IS NOT NULL");
      conditions.push("wr_series_name LIKE 'WR%'");

      if (dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          wr_doc_num::TEXT ILIKE $${paramIndex} OR
          wo_doc_num::TEXT ILIKE $${paramIndex} OR
          req_name ILIKE $${paramIndex} OR
          item_name ILIKE $${paramIndex} OR
          pr_mac ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT
          wr_doc_num,
          wr_series_name,
          wr_close_date,
          wr_approver,
          wo_doc_num,
          wo_series_name,
          doc_date,
          req_name,
          dept_name,
          pr_mac,
          item_name,
          wo_order_1
        FROM wo_summary
        ${whereClause}
        ORDER BY wr_close_date DESC NULLS LAST, wr_doc_num DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM wo_summary
        ${whereClause}
      `;
      const countResult = await ctx.db.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) as any[];
      const total = Number(countResult[0]?.total || 0);

      return {
        data: data.map(row => ({
          ...row,
          wr_doc_num: row.wr_doc_num ? Number(row.wr_doc_num) : null,
          wo_doc_num: row.wo_doc_num ? Number(row.wo_doc_num) : null,
        })),
        total,
        limit,
        offset,
      };
    }),

  // =====================================================
  // WA - Work Action List
  // =====================================================
  getWAList: createTableProcedure('w_series_wa', 'read')
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, search, limit, offset } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter: wa_doc_num must exist and wa_series_name starts with 'WA'
      conditions.push("wa_doc_num IS NOT NULL");
      conditions.push("wa_series_name LIKE 'WA%'");

      if (dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          wa_doc_num::TEXT ILIKE $${paramIndex} OR
          wo_doc_num::TEXT ILIKE $${paramIndex} OR
          req_name ILIKE $${paramIndex} OR
          item_name ILIKE $${paramIndex} OR
          pr_mac ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT
          wa_doc_num,
          wa_series_name,
          wa_finish_date,
          wa_plan_to_work,
          wa_start_work,
          wa_close_date,
          wa_mc_stop,
          wa_mc_start,
          wo_doc_num,
          wo_series_name,
          doc_date,
          req_name,
          dept_name,
          pr_mac,
          item_name,
          wo_order_1
        FROM wo_summary
        ${whereClause}
        ORDER BY wa_start_work DESC NULLS LAST, wa_doc_num DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM wo_summary
        ${whereClause}
      `;
      const countResult = await ctx.db.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) as any[];
      const total = Number(countResult[0]?.total || 0);

      return {
        data: data.map(row => ({
          ...row,
          wa_doc_num: row.wa_doc_num ? Number(row.wa_doc_num) : null,
          wo_doc_num: row.wo_doc_num ? Number(row.wo_doc_num) : null,
        })),
        total,
        limit,
        offset,
      };
    }),

  // =====================================================
  // WC - Work Complete List
  // =====================================================
  getWCList: createTableProcedure('w_series_wc', 'read')
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, search, limit, offset } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter: wc_doc_num must exist and wc_series_name starts with 'WC'
      conditions.push("wc_doc_num IS NOT NULL");
      conditions.push("wc_series_name LIKE 'WC%'");

      if (dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(
          wc_doc_num::TEXT ILIKE $${paramIndex} OR
          wo_doc_num::TEXT ILIKE $${paramIndex} OR
          req_name ILIKE $${paramIndex} OR
          item_name ILIKE $${paramIndex} OR
          pr_mac ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT
          wc_doc_num,
          wc_series_name,
          wc_close_date,
          wc_reason_1,
          wc_work_commit_1,
          due_mc_stop,
          wo_doc_num,
          wo_series_name,
          doc_date,
          req_name,
          dept_name,
          pr_mac,
          item_name,
          wo_order_1
        FROM wo_summary
        ${whereClause}
        ORDER BY wc_close_date DESC NULLS LAST, wc_doc_num DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM wo_summary
        ${whereClause}
      `;
      const countResult = await ctx.db.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) as any[];
      const total = Number(countResult[0]?.total || 0);

      return {
        data: data.map(row => ({
          ...row,
          wc_doc_num: row.wc_doc_num ? Number(row.wc_doc_num) : null,
          wo_doc_num: row.wo_doc_num ? Number(row.wo_doc_num) : null,
          due_mc_stop: row.due_mc_stop ? Number(row.due_mc_stop) : null,
        })),
        total,
        limit,
        offset,
      };
    }),
});
