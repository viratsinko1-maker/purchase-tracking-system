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
  // แก้ไข: ใช้ po_lines.base_ref แทน pr_po_link เพื่อให้ตรงกับวิธีที่ PO popup ใช้
  getByPRNo: publicProcedure
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      // ดึงข้อมูล PR master
      const prMaster = await ctx.db.pr_master.findUnique({
        where: { doc_num: input.prNo },
      });

      if (!prMaster) {
        return null;
      }

      // ดึงข้อมูล PR lines
      const prLines = await ctx.db.pr_lines.findMany({
        where: { pr_doc_num: input.prNo },
        orderBy: { line_num: 'asc' },
      });

      // ดึง PO ที่เชื่อมกับ PR นี้ผ่าน po_lines.base_ref (วิธีเดียวกับ PO popup)
      const poLines = await ctx.db.$queryRawUnsafe(`
        SELECT
          pol.base_ref as pr_doc_num,
          pol.po_doc_num,
          pol.line_num as po_line_num,
          pol.item_code as po_item_code,
          pol.description as po_description,
          pol.quantity as po_quantity,
          pol.line_status as po_line_status,
          pom.doc_due_date as po_due_date,
          pom.doc_status as po_status
        FROM po_lines pol
        JOIN po_master pom ON pol.po_doc_num = pom.doc_num
        WHERE pol.base_ref = $1
        ORDER BY pol.po_doc_num, pol.line_num
      `, input.prNo) as any[];

      // ดึงข้อมูลโครงการจาก pr_project_link (เอาแค่ตัวแรก)
      const projectData = await ctx.db.pr_project_link.findFirst({
        where: { pr_doc_num: input.prNo },
        select: {
          prj_code: true,
          prj_name: true,
        },
        orderBy: { line_num: 'asc' }
      });

      // ดึง WO numbers ที่เชื่อมกับ PR นี้
      const woLinks = await ctx.db.pr_wo_link.findMany({
        where: { pr_doc_num: input.prNo },
        select: { wo_doc_num: true },
      });
      const woNumbers = woLinks.map(link => link.wo_doc_num);

      const prInfo = {
        doc_num: prMaster.doc_num,
        req_name: prMaster.req_name,
        department: prMaster.department_name,
        date: prMaster.doc_date,
        due_date: prMaster.doc_due_date,
        status: prMaster.doc_status,
        series: prMaster.series_name,
        update_date: prMaster.update_date,
        create_date: prMaster.create_date,
        req_date: prMaster.req_date,
        job_name: prMaster.job_name,
        remarks: prMaster.remarks,
        project_code: projectData?.prj_code || null,
        project_name: projectData?.prj_name || null,
        wo_numbers: woNumbers,
      };

      // สร้าง map ของ PR lines พร้อม PO list
      // ใช้ Set เก็บ PO ที่ถูก match แล้ว เพื่อไม่ให้แสดงซ้ำ
      const matchedPOKeys = new Set<string>();

      const linesWithPO = prLines.map((line, index) => {
        // 1. ลอง match ด้วย line_num ก่อน
        let matchingPOs = poLines.filter((po: any) =>
          po.po_line_num === line.line_num
        );

        // 2. ถ้าไม่มี match และเป็น line แรก -> เอา PO ที่ยังไม่ถูก match มาแสดง (fallback)
        if (matchingPOs.length === 0 && index === 0) {
          matchingPOs = poLines.filter((po: any) => {
            const key = `${po.po_doc_num}-${po.po_line_num}`;
            // เอาเฉพาะ PO ที่ line_num ไม่ตรงกับ PR line ใดเลย
            const hasMatchingPRLine = prLines.some(pl => pl.line_num === po.po_line_num);
            return !hasMatchingPRLine && !matchedPOKeys.has(key);
          });
        }

        // บันทึก PO ที่ถูก match แล้ว
        matchingPOs.forEach((po: any) => {
          matchedPOKeys.add(`${po.po_doc_num}-${po.po_line_num}`);
        });

        return {
          line_id: line.id,
          line_num: line.line_num,
          item_code: line.item_code,
          description: line.description,
          quantity: line.quantity,
          unit_msr: line.unit_msr,
          line_status: line.line_status,
          project: line.project,
          vendor: line.vendor_num,
          has_po: line.has_po,
          ocr_code2: line.ocr_code2,
          ocr_code4: line.ocr_code4,
          po_list: matchingPOs.map((po: any) => ({
            po_doc_num: po.po_doc_num,
            po_due_date: po.po_due_date,
            po_description: po.po_description,
            po_quantity: po.po_quantity ? Number(po.po_quantity) : null,
            po_unit: null,
            po_status: po.po_status,
          }))
        };
      });

      return {
        ...prInfo,
        lines: linesWithPO
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

  // 🔹 ค้นหาผู้เปิด PR สำหรับหน้า Receive Good (limit 5)
  searchRequesters: publicProcedure
    .input(z.object({
      search: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { search } = input;

      // ถ้าไม่มี search หรือน้อยกว่า 2 ตัว ไม่ต้อง query
      if (!search || search.length < 2) {
        return [];
      }

      const results = await ctx.db.$queryRawUnsafe<Array<{
        req_name: string;
        pr_count: number;
      }>>(`
        SELECT req_name, COUNT(*)::INTEGER as pr_count
        FROM pr_master
        WHERE req_name IS NOT NULL AND req_name ILIKE $1
        GROUP BY req_name
        ORDER BY pr_count DESC, req_name ASC
        LIMIT 5
      `, `%${search}%`);

      return results;
    }),

  // 🔹 ค้นหา PR สำหรับหน้า Receive Good (limit 5)
  searchPRForReceive: publicProcedure
    .input(z.object({
      search: z.string(),
      requester: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { search, requester } = input;

      // ถ้าไม่มี search หรือน้อยกว่า 1 ตัว ไม่ต้อง query
      if (!search || search.length < 1) {
        return [];
      }

      // Build query with optional requester filter
      if (requester) {
        const results = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          req_name: string | null;
          job_name: string | null;
          doc_date: Date | null;
        }>>(`
          SELECT doc_num, req_name, job_name, doc_date
          FROM pr_master
          WHERE doc_num::TEXT LIKE $1 AND req_name = $2
          ORDER BY doc_num DESC
          LIMIT 5
        `, `${search}%`, requester);
        return results;
      }

      const results = await ctx.db.$queryRawUnsafe<Array<{
        doc_num: number;
        req_name: string | null;
        job_name: string | null;
        doc_date: Date | null;
      }>>(`
        SELECT doc_num, req_name, job_name, doc_date
        FROM pr_master
        WHERE doc_num::TEXT LIKE $1
        ORDER BY doc_num DESC
        LIMIT 5
      `, `${search}%`);

      return results;
    }),

  // 🔹 ดึงรายละเอียด WO (จาก wo_summary)
  getWODetail: publicProcedure
    .input(z.object({ woNo: z.number() }))
    .query(async ({ ctx, input }) => {
      // ดึงทุก record ของ WO นี้ (อาจมีหลาย WA/WC)
      const records = await ctx.db.wo_summary.findMany({
        where: { wo_doc_num: input.woNo },
        orderBy: [
          { wa_doc_num: 'asc' },
          { wc_doc_num: 'asc' },
        ],
      });

      if (records.length === 0) {
        return null;
      }

      // ดึงข้อมูลหลักจาก record แรก (ข้อมูลเหล่านี้ซ้ำกันทุก record)
      const first = records[0]!;
      const header = {
        wo_doc_num: first.wo_doc_num,
        wo_doc_entry: first.wo_doc_entry,
        wo_series_name: first.wo_series_name,
        obj_type: first.obj_type,
        doc_date: first.doc_date,
        pr_for: first.pr_for,
        pr_mac: first.pr_mac,
        item_name: first.item_name,
        req_name: first.req_name,
        department: first.department,
        dept_name: first.dept_name,
        wo_order_1: first.wo_order_1,
        wo_respond_by: first.wo_respond_by,
        wo_respond_1: first.wo_respond_1,
        wo_respond_2: first.wo_respond_2,
        wo_respond_3: first.wo_respond_3,
        wo_note_order: first.wo_note_order,
        wo_u_date: first.wo_u_date,
        wo_u_finish: first.wo_u_finish,
        wo_close_date: first.wo_close_date,
        wr_series_name: first.wr_series_name,
        wr_doc_num: first.wr_doc_num,
        wr_close_date: first.wr_close_date,
        wr_approver: first.wr_approver,
        wo_approver: first.wo_approver,
      };

      // สร้างรายการ WA/WC (unique)
      // Filter เอาเฉพาะ WA ที่มี series_name ขึ้นต้นด้วย "WA" และ WC ที่มี series_name ขึ้นต้นด้วย "WC"
      const waRecordsMap = new Map();
      const wcRecordsMap = new Map();

      records.forEach(rec => {
        // WA Records - filter เฉพาะที่มี wa_series_name ขึ้นต้นด้วย "WA"
        if (rec.wa_doc_num && rec.wa_series_name?.startsWith('WA') && !waRecordsMap.has(rec.wa_doc_num)) {
          waRecordsMap.set(rec.wa_doc_num, {
            wa_series_name: rec.wa_series_name,
            wa_doc_num: rec.wa_doc_num,
            wa_finish_date: rec.wa_finish_date,
            wa_plan_to_work: rec.wa_plan_to_work,
            wa_start_work: rec.wa_start_work,
            wa_close_date: rec.wa_close_date,
            u_finish_date_2: rec.u_finish_date_2,
          });
        }

        // WC Records - filter เฉพาะที่มี wc_series_name ขึ้นต้นด้วย "WC"
        if (rec.wc_doc_num && rec.wc_series_name?.startsWith('WC') && !wcRecordsMap.has(rec.wc_doc_num)) {
          wcRecordsMap.set(rec.wc_doc_num, {
            wc_series_name: rec.wc_series_name,
            wc_doc_num: rec.wc_doc_num,
            wc_close_date: rec.wc_close_date,
            wa_mc_stop: rec.wa_mc_stop,
            wa_mc_start: rec.wa_mc_start,
            due_mc_stop: rec.due_mc_stop,
            wc_reason_1: rec.wc_reason_1,
            wc_work_commit_1: rec.wc_work_commit_1,
          });
        }
      });

      // ดึง Detail PO จาก wo_po_detail (ตารางใหม่ที่ sync ครบทุก PO lines)
      // กรอง PO ที่ถูก cancel ออก (po_canceled = 'Y') เพื่อให้ตรงกับ Crystal Report
      const poRecordsRaw = await ctx.db.wo_po_detail.findMany({
        where: {
          wo_doc_num: input.woNo,
          OR: [
            { po_canceled: null },
            { po_canceled: 'N' },
            { po_canceled: '' },
          ],
        },
        orderBy: [
          { po_doc_num: 'asc' },
          { po_line_num: 'asc' },
        ],
      });

      const poRecords = poRecordsRaw.map(po => ({
        po_doc_num: po.po_doc_num,
        line_num: po.po_line_num,
        item_code: po.item_code,
        description: po.description,
        quantity: po.quantity,
        unit: po.unit_msr,
        price: po.price,
        line_total: po.line_total,
        requester: po.requester,  // ผู้เปิด PR (Requester)
        request_date: po.po_doc_date,
        approve_date: po.po_doc_date,  // ใช้ po_doc_date เป็น วันที่อนุมัติ
        receive_date: po.grpo_doc_date,  // วันที่รับ GRPO
        grpo_doc_num: po.grpo_doc_num,   // เลขที่ GRPO
        po_canceled: po.po_canceled,     // สถานะยกเลิก
      }));

      // ดึง Detail GI (Goods Issue) จาก wo_gi_detail
      const giRecordsRaw = await ctx.db.wo_gi_detail.findMany({
        where: { wo_doc_num: input.woNo },
        orderBy: [
          { gi_doc_num: 'asc' },
        ],
      });

      const giRecords = giRecordsRaw.map(gi => {
        // คำนวณมูลค่า: ใช้ stock_value ก่อน, ถ้าไม่มีให้คำนวณจาก quantity * inm_price
        let lineTotal = gi.stock_value;
        if (!lineTotal && gi.quantity && gi.inm_price) {
          lineTotal = Number(gi.quantity) * Number(gi.inm_price);
        }
        return {
          doc_num: gi.gi_doc_num,
          item_code: gi.item_code,
          description: gi.description,
          quantity: gi.quantity,
          unit: gi.unit_msr,
          line_total: lineTotal,
          requester: gi.emp_name || gi.ocr_name2,  // ผู้เบิก = ชื่อพนักงาน (EmpName) หรือหน่วยงาน
          request_date: gi.wtq_doc_date,  // วันที่เบิก = วันที่ Transfer Request
          issue_date: gi.gi_doc_date,     // วันที่ Issue = วันที่ GI
        };
      });

      return {
        header,
        waRecords: Array.from(waRecordsMap.values()),
        wcRecords: Array.from(wcRecordsMap.values()),
        poRecords,
        giRecords,
        totalRecords: records.length,
      };
    }),

  // 🔹 ค้นหา PR จากชื่องาน สำหรับหน้า Receive Good (limit 5)
  searchPRByJobName: publicProcedure
    .input(z.object({
      search: z.string(),
      requester: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { search, requester } = input;

      // ถ้าไม่มี search หรือน้อยกว่า 2 ตัว ไม่ต้อง query
      if (!search || search.length < 2) {
        return [];
      }

      // Build query with optional requester filter
      if (requester) {
        const results = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          req_name: string | null;
          job_name: string | null;
          doc_date: Date | null;
        }>>(`
          SELECT doc_num, req_name, job_name, doc_date
          FROM pr_master
          WHERE job_name ILIKE $1 AND req_name = $2
          ORDER BY doc_num DESC
          LIMIT 5
        `, `%${search}%`, requester);
        return results;
      }

      const results = await ctx.db.$queryRawUnsafe<Array<{
        doc_num: number;
        req_name: string | null;
        job_name: string | null;
        doc_date: Date | null;
      }>>(`
        SELECT doc_num, req_name, job_name, doc_date
        FROM pr_master
        WHERE job_name ILIKE $1
        ORDER BY doc_num DESC
        LIMIT 5
      `, `%${search}%`);

      return results;
    }),
});
