import { z } from "zod";
import sql from "mssql";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

// SQL Server configuration
const sqlConfig = {
  server: '10.1.1.199',
  database: 'TMK_PRD',
  user: 'powerquery_hq',
  password: '@Tmk963*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

export const prpoRouter = createTRPCRouter({
  // ดึงข้อมูล PR-PO ทั้งหมด
  getAll: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        series: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, series, dateFrom, dateTo } = input;

      const whereConditions = [];
      if (search) {
        whereConditions.push({
          OR: [
            { prNo: { equals: parseInt(search) || 0 } },
            { poNo: { equals: parseInt(search) || 0 } },
            { prRequester: { contains: search, mode: 'insensitive' as const } },
            { prDepartment: { contains: search, mode: 'insensitive' as const } },
            { prJobName: { contains: search, mode: 'insensitive' as const } },
          ],
        });
      }
      if (status) {
        whereConditions.push({ prStatus: status });
      }
      if (series) {
        whereConditions.push({
          seriesName: { startsWith: series, mode: 'insensitive' as const },
        });
      }
      if (dateFrom) {
        whereConditions.push({
          prDate: { gte: new Date(dateFrom) },
        });
      }
      if (dateTo) {
        // เพิ่ม 1 วันเพื่อให้ครอบคลุมถึงสิ้นวัน
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        whereConditions.push({
          prDate: { lt: endDate },
        });
      }

      const [data, total] = await Promise.all([
        ctx.db.purchaseRequestPO.findMany({
          where: whereConditions.length > 0 ? { AND: whereConditions } : {},
          orderBy: { prDate: 'asc' }, // เรียงจากเก่าไปใหม่
        }),
        ctx.db.purchaseRequestPO.count({
          where: whereConditions.length > 0 ? { AND: whereConditions } : {},
        }),
      ]);

      return {
        data,
        total,
      };
    }),

  // ดึง PR เฉพาะตัว
  getByPRNo: publicProcedure
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.purchaseRequestPO.findMany({
        where: { prNo: input.prNo },
        orderBy: { poLineNum: 'asc' },
      });
    }),

  // สถิติต่างๆ
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [totalRecords, statuses, recentSync] = await Promise.all([
      ctx.db.purchaseRequestPO.count(),
      ctx.db.purchaseRequestPO.groupBy({
        by: ['prStatus'],
        _count: true,
      }),
      ctx.db.purchaseRequestPO.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    // นับ PR ที่ไม่มี PO
    const prWithoutPO = await ctx.db.purchaseRequestPO.count({
      where: { poNo: null },
    });

    return {
      totalRecords,
      prWithoutPO,
      statuses: statuses.map((s) => ({
        status: s.prStatus,
        count: s._count,
      })),
      lastSync: recentSync?.updatedAt ?? null,
    };
  }),

  // Sync ข้อมูลจาก SQL Server
  sync: publicProcedure.mutation(async ({ ctx }) => {
    let sqlPool: sql.ConnectionPool | null = null;

    try {
      // ตรวจสอบว่าวันนี้ sync แล้วหรือยัง (โดยดูจาก updatedAt ของข้อมูลล่าสุด)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // เริ่มต้นวัน

      const latestRecord = await ctx.db.purchaseRequestPO.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      const hasSyncToday = latestRecord &&
        latestRecord.updatedAt >= today;

      let forceFullSyncWarning = false;

      if (!hasSyncToday) {
        // ถ้าวันนี้ยังไม่เคย sync → แจ้งเตือนว่าจะช้ากว่าปกติ
        forceFullSyncWarning = true;
        console.log(`[SYNC] ⚠️  No sync today yet - performing Full Sync (may be slower than usual)`);
      }

      // เชื่อมต่อ SQL Server
      sqlPool = await sql.connect(sqlConfig);

      // ดึงข้อมูลจาก SQL Server
      const result = await sqlPool.request().query(`
        SELECT
            T0.DocEntry AS "PR_DocEntry",
            T0.DocNum AS "PR_No",
            T0.DocDate AS "PR_Date",
            T0.DocDueDate AS "PR_DueDate",
            T5.SeriesName AS "SeriesName",
            T0.ReqName AS "PR_Requester",
            T4.Remarks AS "PR_Department",
            T0.U_U_PR_FOR AS "PR_JobName",
            T0.Comments AS "PR_Remarks",
            T0.DocStatus AS "PR_Status",
            T3.DocNum AS "PO_No",
            T1.Dscription AS "PO_Description",
            T1.Quantity AS "PO_Quantity",
            T1.unitMsr AS "PO_Unit",
            T1.LineNum AS "PO_LineNum"
        FROM
            OPRQ T0
            LEFT JOIN POR1 T1 ON T1.BaseRef = T0.DocNum
            LEFT JOIN OPOR T3 ON T3.DocEntry = T1.DocEntry
            LEFT JOIN OUDP T4 ON T0.Department = T4.Code
            LEFT JOIN NNM1 T5 ON T0.Series = T5.Series
        ORDER BY
            T0.DocDate ASC
      `);

      const records = result.recordset;

      // ลบข้อมูลเก่า
      await ctx.db.purchaseRequestPO.deleteMany({});

      // นำข้อมูลเข้า PostgreSQL
      const insertPromises = records.map((record: any) =>
        ctx.db.purchaseRequestPO.create({
          data: {
            prDocEntry: record.PR_DocEntry,
            prNo: record.PR_No,
            prDate: new Date(record.PR_Date),
            prDueDate: new Date(record.PR_DueDate),
            seriesName: record.SeriesName,
            prRequester: record.PR_Requester,
            prDepartment: record.PR_Department,
            prJobName: record.PR_JobName,
            prRemarks: record.PR_Remarks,
            prStatus: record.PR_Status,
            poNo: record.PO_No,
            poDescription: record.PO_Description,
            poQuantity: record.PO_Quantity,
            poUnit: record.PO_Unit,
            poLineNum: record.PO_LineNum,
          },
        })
      );

      await Promise.all(insertPromises);

      // สร้าง message พร้อม warning ถ้าเป็น first sync ของวัน
      let message = `Successfully synced ${records.length} records`;

      if (forceFullSyncWarning) {
        message = `⚠️ ยังไม่เคย Sync วันนี้ - ทำ Full Sync (ช้ากว่าปกติ)\n${message}`;
      }

      return {
        success: true,
        recordsImported: records.length,
        forced_full_sync: forceFullSyncWarning,
        message,
      };
    } catch (error) {
      console.error('Sync error:', error);
      throw new Error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (sqlPool) {
        await sqlPool.close();
      }
    }
  }),
});
