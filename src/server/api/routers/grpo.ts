import { z } from "zod";
import sql from "mssql";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { sqlConfig } from "~/server/api/routers/pr/config";

export const grpoRouter = createTRPCRouter({
  // Sync ข้อมูล GRPO จาก SAP → PostgreSQL
  sync: publicProcedure.mutation(async ({ ctx }) => {
    let sqlPool: sql.ConnectionPool | null = null;
    const syncStartTime = new Date();

    try {
      console.log(`[GRPO SYNC] Starting sync...`);

      sqlPool = await sql.connect(sqlConfig);

      const result = await sqlPool.request().query(`
        SELECT
          T0.DocEntry,
          T1.LineNum,
          T0.DocDate,
          T6.U_NAME AS UserName,
          ISNULL(T4.BeginStr, '') + ' ' + CAST(T0.DocNum AS NVARCHAR(11)) AS GrpoDocNum,
          T0.CardCode,
          T0.CardName,
          T3.DocNum AS PoDocNum,
          T5.LineNum AS PoLineNum,
          T5.BaseRef AS PrBaseRef,
          T1.ItemCode,
          T1.Dscription,
          T1.Quantity,
          T1.unitMsr,
          T1.PriceBefDi,
          T1.LineTotal,
          T1.OcrCode,
          T1.OcrCode2,
          T1.OcrCode4,
          T1.FreeTxt
        FROM OPDN T0
        INNER JOIN PDN1 T1 ON T0.DocEntry = T1.DocEntry
        LEFT OUTER JOIN NNM1 T4 ON T0.Series = T4.Series
        LEFT OUTER JOIN POR1 T5 ON T1.BaseEntry = T5.DocEntry
            AND T1.BaseLine = T5.LineNum
            AND T1.BaseType = 22
        LEFT OUTER JOIN OPOR T3 ON T5.DocEntry = T3.DocEntry
        LEFT OUTER JOIN OPRQ T2 ON T5.BaseEntry = T2.DocEntry AND T5.BaseType = 147
        LEFT OUTER JOIN OUSR T6 ON T0.UserSign = T6.USERID
        WHERE T4.SeriesName LIKE 'GR%'
        ORDER BY T0.DocDate DESC
      `);

      const sapData = result.recordset;
      console.log(`[GRPO SYNC] Fetched ${sapData.length} records from SAP`);

      // TRUNCATE แล้ว batch INSERT (เร็วกว่า upsert ทีละ row)
      await ctx.db.$executeRawUnsafe('TRUNCATE TABLE gr_po_pr RESTART IDENTITY');

      const BATCH_SIZE = 500;
      let upsertCount = 0;

      for (let i = 0; i < sapData.length; i += BATCH_SIZE) {
        const batch = sapData.slice(i, i + BATCH_SIZE);
        const values: string[] = [];
        const params: any[] = [];

        batch.forEach((row: any, idx: number) => {
          const offset = idx * 20;
          values.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10},$${offset+11},$${offset+12},$${offset+13},$${offset+14},$${offset+15},$${offset+16},$${offset+17},$${offset+18},$${offset+19},$${offset+20},NOW(),NOW())`);
          params.push(
            row.DocEntry, row.LineNum, row.DocDate, row.UserName, row.GrpoDocNum,
            row.CardCode, row.CardName, row.PoDocNum ?? null, row.PoLineNum ?? null, row.PrBaseRef ?? null,
            row.ItemCode, row.Dscription, row.Quantity, row.unitMsr,
            row.PriceBefDi, row.LineTotal,
            row.OcrCode, row.OcrCode2, row.OcrCode4, row.FreeTxt
          );
        });

        await ctx.db.$executeRawUnsafe(`
          INSERT INTO gr_po_pr (
            doc_entry, line_num, doc_date, user_name, grpo_doc_num,
            card_code, card_name, po_doc_num, po_line_num, pr_base_ref,
            item_code, description, quantity, unit_msr,
            price_before_disc, line_total,
            ocr_code, ocr_code2, ocr_code4, free_txt,
            last_sync_date, updated_at
          ) VALUES ${values.join(',')}
        `, ...params);

        upsertCount += batch.length;
        console.log(`[GRPO SYNC] Batch inserted ${upsertCount} / ${sapData.length}`);
      }

      const durationSeconds = (new Date().getTime() - syncStartTime.getTime()) / 1000;
      console.log(`[GRPO SYNC] Completed: ${upsertCount} records in ${durationSeconds.toFixed(2)}s`);

      return {
        success: true,
        message: 'GRPO sync completed',
        records: upsertCount,
        duration_seconds: durationSeconds,
      };

    } catch (error: any) {
      console.error('[GRPO SYNC] Error:', error);
      throw new Error(`GRPO sync failed: ${error.message}`);
    } finally {
      if (sqlPool) {
        await sqlPool.close();
      }
    }
  }),

  // ดึงข้อมูล GRPO grouped by grpo_doc_num
  getAllGrouped: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.dateFrom) {
        conditions.push(`doc_date >= $${paramIndex}::date`);
        params.push(input.dateFrom);
        paramIndex++;
      }
      if (input.dateTo) {
        conditions.push(`doc_date <= $${paramIndex}::date`);
        params.push(input.dateTo);
        paramIndex++;
      }
      if (input.search) {
        conditions.push(`(
          grpo_doc_num ILIKE $${paramIndex}
          OR card_name ILIKE $${paramIndex}
          OR item_code ILIKE $${paramIndex}
          OR description ILIKE $${paramIndex}
          OR pr_base_ref ILIKE $${paramIndex}
          OR CAST(po_doc_num AS TEXT) ILIKE $${paramIndex}
        )`);
        params.push(`%${input.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await ctx.db.$queryRawUnsafe<any[]>(
        `SELECT * FROM gr_po_pr ${whereClause} ORDER BY doc_date DESC, grpo_doc_num, line_num`,
        ...params
      );

      // Group by grpo_doc_num
      const grouped = new Map<string, {
        grpo_doc_num: string;
        doc_date: Date | null;
        user_name: string | null;
        card_code: string | null;
        card_name: string | null;
        item_count: number;
        total_amount: number;
        po_numbers: number[];
        pr_numbers: string[];
        items: any[];
      }>();

      for (const row of rows) {
        const key = row.grpo_doc_num ?? `unknown-${row.id}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            grpo_doc_num: key,
            doc_date: row.doc_date,
            user_name: row.user_name,
            card_code: row.card_code,
            card_name: row.card_name,
            item_count: 0,
            total_amount: 0,
            po_numbers: [],
            pr_numbers: [],
            items: [],
          });
        }
        const group = grouped.get(key)!;
        group.item_count++;
        group.total_amount += Number(row.line_total ?? 0);
        if (row.po_doc_num && !group.po_numbers.includes(row.po_doc_num)) {
          group.po_numbers.push(row.po_doc_num);
        }
        if (row.pr_base_ref && !group.pr_numbers.includes(row.pr_base_ref)) {
          group.pr_numbers.push(row.pr_base_ref);
        }
        group.items.push(row);
      }

      return Array.from(grouped.values());
    }),

  // ดึง GRPO group เดียวจาก grpo_doc_num
  getByDocNum: publicProcedure
    .input(z.object({ docNum: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.$queryRawUnsafe<any[]>(
        `SELECT * FROM gr_po_pr WHERE grpo_doc_num = $1 ORDER BY line_num`,
        input.docNum
      );

      if (rows.length === 0) return null;

      const first = rows[0];
      const po_numbers: number[] = [];
      const pr_numbers: string[] = [];
      let total_amount = 0;

      for (const row of rows) {
        total_amount += Number(row.line_total ?? 0);
        if (row.po_doc_num && !po_numbers.includes(row.po_doc_num)) {
          po_numbers.push(row.po_doc_num);
        }
        if (row.pr_base_ref && !pr_numbers.includes(row.pr_base_ref)) {
          pr_numbers.push(row.pr_base_ref);
        }
      }

      return {
        grpo_doc_num: first.grpo_doc_num as string,
        doc_date: first.doc_date,
        user_name: first.user_name,
        card_code: first.card_code,
        card_name: first.card_name,
        item_count: rows.length,
        total_amount,
        po_numbers,
        pr_numbers,
        items: rows,
      };
    }),
});
