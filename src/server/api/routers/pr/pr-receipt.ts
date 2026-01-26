/**
 * PR Receipt Router - getDocumentReceipt, getApproversPreview, saveDocumentReceipt
 */
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const prReceiptRouter = createTRPCRouter({
  // 🔹 ดึงข้อมูลการรับเอกสาร PR
  getDocumentReceipt: publicProcedure
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const receipt = await ctx.db.pr_document_receipt.findUnique({
        where: { pr_doc_num: input.prNo },
      });
      return receipt;
    }),

  // 🔹 ดึง preview ผู้อนุมัติ
  getApproversPreview: publicProcedure
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const ocrCode2Result = await ctx.db.$queryRawUnsafe(`
        SELECT ocr_code2 FROM (
          SELECT ocr_code2, COUNT(*) as cnt, MIN(line_num) as first_line
          FROM pr_lines
          WHERE pr_doc_num = $1 AND ocr_code2 IS NOT NULL AND ocr_code2 != ''
          GROUP BY ocr_code2
          ORDER BY cnt DESC, first_line ASC
          LIMIT 1
        ) sub
      `, input.prNo) as { ocr_code2: string }[];

      const primaryOcrCode2 = ocrCode2Result.length > 0 ? ocrCode2Result[0]!.ocr_code2 : null;

      if (!primaryOcrCode2) {
        return {
          ocrCode2: null,
          ocrCodeName: null,
          lineApprovers: [],
          costCenterApprovers: [],
        };
      }

      const ocrCode = await ctx.db.oCR_codeandName.findFirst({
        where: { name: primaryOcrCode2 },
      });

      if (!ocrCode) {
        return {
          ocrCode2: primaryOcrCode2,
          ocrCodeName: null,
          lineApprovers: [],
          costCenterApprovers: [],
        };
      }

      const approvers = await ctx.db.ocr_approver.findMany({
        where: { ocrCodeId: ocrCode.id },
        orderBy: [{ approverType: 'asc' }, { priority: 'asc' }],
      });

      const userIds = approvers.map(a => a.userProductionId);
      const users = await ctx.db.user_production.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, username: true, name: true },
      });

      const lineApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];
      const costCenterApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];

      for (const approver of approvers) {
        const user = users.find(u => u.id === approver.userProductionId);
        const approverData = {
          userId: approver.userProductionId,
          username: user?.username || user?.name || user?.email || 'Unknown',
          email: user?.email || undefined,
          priority: approver.priority,
        };

        if (approver.approverType === 'line') {
          lineApprovers.push(approverData);
        } else if (approver.approverType === 'cost_center') {
          costCenterApprovers.push(approverData);
        }
      }

      return {
        ocrCode2: primaryOcrCode2,
        ocrCodeName: ocrCode.remarks || ocrCode.name,
        lineApprovers,
        costCenterApprovers,
      };
    }),

  // 🔹 บันทึกหรือแก้ไขการรับเอกสาร PR
  saveDocumentReceipt: publicProcedure
    .input(z.object({
      prNo: z.number(),
      receiptDate: z.string(),
      receivedBy: z.string(),
      receivedByUserId: z.string().optional(),
      prCreateDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const receiptDate = new Date(input.receiptDate);
      const createDate = new Date(input.prCreateDate);

      if (receiptDate < createDate) {
        throw new Error('วันที่รับเอกสารต้องไม่ต่ำกว่าวันที่คีย์ข้อมูล (System Date)');
      }

      const now = new Date();
      const thaiDateTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

      // ดึง primary_ocr_code2
      const ocrCode2Result = await ctx.db.$queryRawUnsafe(`
        SELECT ocr_code2 FROM (
          SELECT ocr_code2, COUNT(*) as cnt, MIN(line_num) as first_line
          FROM pr_lines
          WHERE pr_doc_num = $1 AND ocr_code2 IS NOT NULL AND ocr_code2 != ''
          GROUP BY ocr_code2
          ORDER BY cnt DESC, first_line ASC
          LIMIT 1
        ) sub
      `, input.prNo) as { ocr_code2: string }[];

      const primaryOcrCode2 = ocrCode2Result.length > 0 ? ocrCode2Result[0]!.ocr_code2 : null;

      // ดึงผู้อนุมัติ
      let lineApprovers: any[] = [];
      let costCenterApprovers: any[] = [];

      if (primaryOcrCode2) {
        const ocrCode = await ctx.db.oCR_codeandName.findFirst({
          where: { name: primaryOcrCode2 },
        });

        if (ocrCode) {
          const approvers = await ctx.db.ocr_approver.findMany({
            where: { ocrCodeId: ocrCode.id },
            orderBy: [{ approverType: 'asc' }, { priority: 'asc' }],
          });

          const userIds = approvers.map(a => a.userProductionId);
          const users = await ctx.db.user_production.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, username: true, name: true },
          });

          for (const approver of approvers) {
            const user = users.find(u => u.id === approver.userProductionId);
            const approverData = {
              userId: approver.userProductionId,
              username: user?.username || user?.name || user?.email || 'Unknown',
              email: user?.email,
              priority: approver.priority,
            };

            if (approver.approverType === 'line') {
              lineApprovers.push(approverData);
            } else if (approver.approverType === 'cost_center') {
              costCenterApprovers.push(approverData);
            }
          }
        }
      }

      const existing = await ctx.db.pr_document_receipt.findUnique({
        where: { pr_doc_num: input.prNo },
      });

      if (existing) {
        const editCount = await ctx.db.pr_document_receipt_history.count({
          where: { pr_doc_num: input.prNo, action: 'EDIT' },
        });

        await ctx.db.pr_document_receipt_history.create({
          data: {
            pr_doc_num: input.prNo,
            action: 'EDIT',
            edit_count: editCount + 1,
            old_receipt_date: existing.receipt_date,
            new_receipt_date: receiptDate,
            received_by: input.receivedBy,
            received_by_user_id: input.receivedByUserId || null,
            created_at: now,
          },
        });

        const updated = await ctx.db.pr_document_receipt.update({
          where: { pr_doc_num: input.prNo },
          data: {
            receipt_date: receiptDate,
            receipt_datetime: thaiDateTime,
            received_by: input.receivedBy,
            received_by_user_id: input.receivedByUserId || null,
            ocr_code2: primaryOcrCode2,
            line_approvers: lineApprovers.length > 0 ? lineApprovers : Prisma.JsonNull,
            cost_center_approvers: costCenterApprovers.length > 0 ? costCenterApprovers : Prisma.JsonNull,
            updated_at: now,
          },
        });

        return {
          success: true,
          action: 'updated',
          data: updated,
          approvers: { line: lineApprovers, costCenter: costCenterApprovers },
        };
      } else {
        await ctx.db.pr_document_receipt_history.create({
          data: {
            pr_doc_num: input.prNo,
            action: 'NEW',
            edit_count: 0,
            old_receipt_date: null,
            new_receipt_date: receiptDate,
            received_by: input.receivedBy,
            received_by_user_id: input.receivedByUserId || null,
            created_at: now,
          },
        });

        const created = await ctx.db.pr_document_receipt.create({
          data: {
            pr_doc_num: input.prNo,
            receipt_date: receiptDate,
            receipt_datetime: thaiDateTime,
            received_by: input.receivedBy,
            received_by_user_id: input.receivedByUserId || null,
            ocr_code2: primaryOcrCode2,
            line_approvers: lineApprovers.length > 0 ? lineApprovers : Prisma.JsonNull,
            cost_center_approvers: costCenterApprovers.length > 0 ? costCenterApprovers : Prisma.JsonNull,
            created_at: now,
            updated_at: now,
          },
        });

        return {
          success: true,
          action: 'created',
          data: created,
          approvers: { line: lineApprovers, costCenter: costCenterApprovers },
        };
      }
    }),

  // Get all received PRs
  getAllReceivedPRs: publicProcedure
    .query(async ({ ctx }) => {
      const data = await ctx.db.$queryRawUnsafe(`
        SELECT
          s.doc_num, s.req_name, s.job_name, s.create_date,
          r.receipt_date, r.received_by, r.received_by_user_id,
          a.approval_status, a.approved_by, a.approved_at, a.reason as approval_reason
        FROM mv_pr_summary s
        INNER JOIN pr_document_receipt r ON s.doc_num = r.pr_doc_num
        LEFT JOIN pr_document_approval a ON s.doc_num = a.pr_doc_num
        WHERE r.receipt_date IS NOT NULL
        ORDER BY r.receipt_date DESC, s.doc_num DESC
      `) as any[];

      return data;
    }),
});
