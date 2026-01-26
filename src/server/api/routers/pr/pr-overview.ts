/**
 * PR Overview Router - getAllSummary, getByPRNo, getStats, getPRAttachments, getAllQA
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const prOverviewRouter = createTRPCRouter({
  // 🔹 ดึงสรุป PR ทั้งหมดจาก Materialized View
  getAllSummary: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        series: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        onlyPending: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, series, dateFrom, dateTo, onlyPending } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        if (search.startsWith('EXACT:')) {
          const exactValue = search.replace('EXACT:', '');
          conditions.push(`s.doc_num = $${paramIndex}::INTEGER`);
          params.push(exactValue);
          paramIndex++;
        } else if (search.startsWith('PRNUMS:')) {
          const prNumsStr = search.replace('PRNUMS:', '');
          const prNums = prNumsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          if (prNums.length > 0) {
            conditions.push(`s.doc_num = ANY($${paramIndex}::int[])`);
            params.push(prNums);
            paramIndex++;
          }
        } else {
          conditions.push(`(
            s.doc_num::TEXT ILIKE $${paramIndex} OR
            s.req_name ILIKE $${paramIndex} OR
            s.department_name ILIKE $${paramIndex} OR
            s.job_name ILIKE $${paramIndex}
          )`);
          params.push(`%${search}%`);
          paramIndex++;
        }
      }

      if (status) {
        conditions.push(`s.doc_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (series) {
        conditions.push(`s.series_name ILIKE $${paramIndex}`);
        params.push(`${series}%`);
        paramIndex++;
      }

      if (dateFrom) {
        conditions.push(`s.create_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`s.create_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      if (onlyPending) {
        conditions.push(`s.is_complete = FALSE AND s.doc_status = 'O'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT
          s.doc_num, s.req_name, s.department_name, s.doc_date, s.doc_due_date,
          s.doc_status, s.series_name, s.update_date, s.create_date, s.job_name, s.remarks, s.total_lines, s.lines_with_po,
          s.pending_lines, s.is_complete, s.po_numbers, s.total_po_quantity,
          r.receipt_date, r.receipt_datetime, r.received_by, r.received_by_user_id,
          r.ocr_code2 as receipt_ocr_code2, r.line_approvers, r.cost_center_approvers,
          r.requester_approval_by, r.requester_approval_at,
          r.line_approval_by, r.line_approval_at,
          r.cost_center_approval_by, r.cost_center_approval_at,
          r.procurement_approval_by, r.procurement_approval_at,
          r.vpc_approval_by, r.vpc_approval_at,
          a.approval_status, a.reason as approval_reason, a.approved_by, a.approved_at,
          (
            SELECT ocr_code2 FROM (
              SELECT ocr_code2, COUNT(*) as cnt, MIN(line_num) as first_line
              FROM pr_lines
              WHERE pr_doc_num = s.doc_num AND ocr_code2 IS NOT NULL AND ocr_code2 != ''
              GROUP BY ocr_code2
              ORDER BY cnt DESC, first_line ASC
              LIMIT 1
            ) sub
          ) AS primary_ocr_code2
        FROM mv_pr_summary s
        LEFT JOIN pr_document_receipt r ON s.doc_num = r.pr_doc_num
        LEFT JOIN pr_document_approval a ON s.doc_num = a.pr_doc_num
        ${whereClause}
        ORDER BY s.create_date DESC, s.doc_num DESC
      `;

      const data = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

      const convertedData = data.map(row => ({
        ...row,
        total_lines: row.total_lines ? Number(row.total_lines) : 0,
        lines_with_po: row.lines_with_po ? Number(row.lines_with_po) : 0,
        pending_lines: row.pending_lines ? Number(row.pending_lines) : 0,
        total_po_quantity: row.total_po_quantity ? Number(row.total_po_quantity) : null,
      }));

      return {
        data: convertedData,
        total: convertedData.length,
      };
    }),

  // 🔹 ดึงรายละเอียด PR เฉพาะใบ
  getByPRNo: publicProcedure
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.$queryRawUnsafe(`
        SELECT
          v.pr_doc_num, v.pr_req_name, v.pr_department, v.pr_date, v.pr_due_date,
          v.pr_status, v.pr_series, v.pr_update_date, v.pr_create_date, v.pr_req_date, v.pr_job_name, v.pr_remarks,
          v.pr_line_id, v.pr_line_num, v.pr_item_code, v.pr_description, v.pr_quantity,
          v.pr_line_status, v.pr_project, v.pr_vendor, v.has_po,
          v.po_doc_num, v.po_due_date, v.po_description, v.po_quantity, v.po_unit, v.po_status,
          l.ocr_code2, l.ocr_code4, l.unit_msr
        FROM vw_pr_detail v
        LEFT JOIN pr_lines l ON v.pr_line_id = l.id
        WHERE v.pr_doc_num = $1
        ORDER BY v.pr_line_num ASC
      `, input.prNo) as any[];

      if (data.length === 0) {
        return null;
      }

      const prInfo = {
        doc_num: data[0].pr_doc_num,
        req_name: data[0].pr_req_name,
        department: data[0].pr_department,
        date: data[0].pr_date,
        due_date: data[0].pr_due_date,
        status: data[0].pr_status,
        series: data[0].pr_series,
        update_date: data[0].pr_update_date,
        create_date: data[0].pr_create_date,
        req_date: data[0].pr_req_date,
        job_name: data[0].pr_job_name,
        remarks: data[0].pr_remarks,
      };

      const linesMap = new Map();
      data.forEach(row => {
        if (row.pr_line_id) {
          if (!linesMap.has(row.pr_line_id)) {
            linesMap.set(row.pr_line_id, {
              line_id: row.pr_line_id,
              line_num: row.pr_line_num,
              item_code: row.pr_item_code,
              description: row.pr_description,
              quantity: row.pr_quantity,
              unit_msr: row.unit_msr,
              line_status: row.pr_line_status,
              project: row.pr_project,
              vendor: row.pr_vendor,
              has_po: row.has_po,
              ocr_code2: row.ocr_code2,
              ocr_code4: row.ocr_code4, // เครื่องจักร
              po_list: []
            });
          }

          if (row.po_doc_num) {
            linesMap.get(row.pr_line_id).po_list.push({
              po_doc_num: row.po_doc_num,
              po_due_date: row.po_due_date,
              po_description: row.po_description,
              po_quantity: row.po_quantity,
              po_unit: row.po_unit,
              po_status: row.po_status,
            });
          }
        }
      });

      return {
        ...prInfo,
        lines: Array.from(linesMap.values())
      };
    }),

  // 🔹 ดึงสถิติต่างๆ
  getStats: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        series: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        onlyPending: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, series, dateFrom, dateTo, onlyPending } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        conditions.push(`(
          doc_num::TEXT ILIKE $${paramIndex} OR
          req_name ILIKE $${paramIndex} OR
          department_name ILIKE $${paramIndex} OR
          job_name ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        conditions.push(`doc_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (series) {
        conditions.push(`series_name ILIKE $${paramIndex}`);
        params.push(`${series}%`);
        paramIndex++;
      }

      if (dateFrom) {
        conditions.push(`create_date >= $${paramIndex}::DATE`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`create_date <= $${paramIndex}::DATE`);
        params.push(dateTo);
        paramIndex++;
      }

      if (onlyPending) {
        conditions.push(`is_complete = FALSE AND doc_status = 'O'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const stats = await ctx.db.$queryRawUnsafe(`
        SELECT
          COUNT(*) as total_pr,
          COUNT(*) FILTER (WHERE doc_status = 'O') as open_pr,
          COUNT(*) FILTER (WHERE doc_status = 'C') as closed_pr,
          COUNT(*) FILTER (WHERE is_complete = FALSE AND doc_status = 'O') as pending_pr,
          SUM(total_lines) as total_lines,
          SUM(lines_with_po) as lines_with_po,
          SUM(pending_lines) as pending_lines
        FROM mv_pr_summary
        ${whereClause}
      `, ...params) as any[];

      const lastSync = await ctx.db.$queryRawUnsafe(`
        SELECT sync_date, status, records_processed, duration_seconds
        FROM sync_log
        ORDER BY sync_date DESC
        LIMIT 1
      `) as any[];

      return {
        total_pr: Number(stats[0]?.total_pr || 0),
        open_pr: Number(stats[0]?.open_pr || 0),
        closed_pr: Number(stats[0]?.closed_pr || 0),
        pending_pr: Number(stats[0]?.pending_pr || 0),
        total_lines: Number(stats[0]?.total_lines || 0),
        lines_with_po: Number(stats[0]?.lines_with_po || 0),
        pending_lines: Number(stats[0]?.pending_lines || 0),
        last_sync: lastSync[0] || null,
      };
    }),

  // 🔹 ดึงไฟล์แนบของ PR
  getPRAttachments: publicProcedure
    .input(z.object({
      prNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const attachments = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        pr_doc_num: number;
        attachment_entry: number;
        file_name: string;
        src_path: string | null;
        trgt_path: string | null;
        file_ext: string | null;
        created_at: Date;
        uploaded_date: Date | null;
      }>>(`
        SELECT id, pr_doc_num, attachment_entry, file_name, src_path, trgt_path, file_ext, created_at, uploaded_date
        FROM pr_attachments
        WHERE pr_doc_num = $1
        ORDER BY created_at DESC
      `, input.prNo);

      return attachments;
    }),

  // 🔹 ดึงข้อมูล PO Info
  getPOInfo: publicProcedure
    .input(z.object({
      poNo: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const poInfo = await ctx.db.po_info.findUnique({
        where: { po_doc_num: input.poNo },
      });
      return poInfo;
    }),

  // 🔹 ดึงข้อมูล PO Info หลายตัว
  getPOInfoBatch: publicProcedure
    .input(z.object({
      poNumbers: z.array(z.number()),
    }))
    .query(async ({ ctx, input }) => {
      const poInfoList = await ctx.db.po_info.findMany({
        where: {
          po_doc_num: { in: input.poNumbers },
        },
      });

      const poInfoMap = new Map();
      poInfoList.forEach(info => {
        poInfoMap.set(info.po_doc_num, info);
      });

      return poInfoMap;
    }),
});
