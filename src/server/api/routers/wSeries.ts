import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

/**
 * W Series Router สำหรับ W Series Tracking System
 * - แสดงข้อมูล WO, WR, WA, WC พร้อม PO และ PR
 * - รองรับ pagination (100 records ต่อหน้า)
 * - รองรับการ filter (เฉพาะแถวที่มีทั้ง PO และ PR)
 */
export const wSeriesRouter = createTRPCRouter({

  /**
   * ดึงข้อมูล W Series แบบ pagination
   * - page: หน้าปัจจุบัน (เริ่มจาก 1)
   * - pageSize: จำนวน records ต่อหน้า (default: 100)
   * - onlyWithPOPR: แสดงเฉพาะแถวที่มีทั้ง PO และ PR (default: false)
   */
  getAll: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(100),
        onlyWithPOPR: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, onlyWithPOPR } = input;
      const skip = (page - 1) * pageSize;

      // สร้าง WHERE condition
      const whereCondition = onlyWithPOPR
        ? {
            AND: [
              { po_doc_num: { not: null } },
              { pr_no: { not: null } },
            ],
          }
        : {};

      // นับจำนวนทั้งหมด
      const totalCount = await ctx.db.w_series_tracking.count({
        where: whereCondition,
      });

      // ดึงข้อมูลแบบ pagination
      const data = await ctx.db.w_series_tracking.findMany({
        where: whereCondition,
        orderBy: {
          wo_doc_num: 'desc', // เรียงจากล่าสุดขึ้นบน
        },
        skip,
        take: pageSize,
      });

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        success: true,
        data,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }),

  /**
   * ดึงข้อมูล W Series รายการเดียว (by WO number)
   */
  getByWO: publicProcedure
    .input(
      z.object({
        woDocNum: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.w_series_tracking.findFirst({
        where: {
          wo_doc_num: input.woDocNum,
        },
      });

      return {
        success: true,
        data,
      };
    }),

  /**
   * ค้นหา W Series (by WO, PO, PR number)
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, page, pageSize } = input;
      const skip = (page - 1) * pageSize;

      // ค้นหาใน WO, PO, PR
      const whereCondition = {
        OR: [
          { wo_doc_num: isNaN(Number(query)) ? undefined : Number(query) },
          { po_doc_num: isNaN(Number(query)) ? undefined : Number(query) },
          { pr_no: { contains: query } },
          { wr_doc_num: isNaN(Number(query)) ? undefined : Number(query) },
          { wa_doc_num: isNaN(Number(query)) ? undefined : Number(query) },
          { wc_doc_num: isNaN(Number(query)) ? undefined : Number(query) },
        ].filter(condition => condition !== undefined),
      };

      const totalCount = await ctx.db.w_series_tracking.count({
        where: whereCondition,
      });

      const data = await ctx.db.w_series_tracking.findMany({
        where: whereCondition,
        orderBy: {
          wo_doc_num: 'desc',
        },
        skip,
        take: pageSize,
      });

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        success: true,
        data,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }),

  /**
   * ดึงข้อมูล sync log ล่าสุด
   */
  getLastSyncLog: publicProcedure
    .query(async ({ ctx }) => {
      const log = await ctx.db.w_series_sync_log.findFirst({
        orderBy: {
          sync_date: 'desc',
        },
      });

      return {
        success: true,
        data: log,
      };
    }),
});
