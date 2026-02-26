/**
 * PR Sync Router - sync, refreshView, getSyncHistory, getSyncChanges
 */
import { z } from "zod";
import sql from "mssql";
import { createTRPCRouter, createTableProcedure } from "~/server/api/trpc";
import { sqlConfig } from "./config";

// 🔹 Auto-approve ขั้น 1 (REQUESTER) สำหรับ PR ที่ยังไม่มี pr_document_receipt
import { Prisma, type PrismaClient } from "@prisma/client";

async function autoApproveRequesterForNewPRs(
  db: PrismaClient,
  prDocNums: number[]
): Promise<{ created: number; skipped: number }> {
  if (prDocNums.length === 0) return { created: 0, skipped: 0 };

  // 1. หา PR ที่มี receipt อยู่แล้ว → skip
  const existingReceipts = await db.pr_document_receipt.findMany({
    where: { pr_doc_num: { in: prDocNums } },
    select: { pr_doc_num: true },
  });
  const existingSet = new Set(existingReceipts.map(r => r.pr_doc_num));
  const newPrNums = prDocNums.filter(n => !existingSet.has(n));

  if (newPrNums.length === 0) return { created: 0, skipped: prDocNums.length };

  // 2. ดึง pr_master เพื่อเอา req_name + create_date
  const prMasters = await db.pr_master.findMany({
    where: { doc_num: { in: newPrNums } },
    select: { doc_num: true, req_name: true, create_date: true, doc_date: true },
  });

  // 3. ดึง primary ocr_code2 สำหรับแต่ละ PR
  const ocrResults = await db.$queryRawUnsafe<{ pr_doc_num: number; ocr_code2: string }[]>(`
    SELECT DISTINCT ON (pr_doc_num) pr_doc_num, ocr_code2
    FROM (
      SELECT pr_doc_num, ocr_code2, COUNT(*) as cnt, MIN(line_num) as first_line
      FROM pr_lines
      WHERE pr_doc_num = ANY($1) AND ocr_code2 IS NOT NULL AND ocr_code2 != ''
      GROUP BY pr_doc_num, ocr_code2
      ORDER BY pr_doc_num, cnt DESC, first_line ASC
    ) sub
  `, newPrNums);

  const ocrMap = new Map(ocrResults.map(r => [r.pr_doc_num, r.ocr_code2]));

  // 4. Resolve approver lists — cache ตาม ocr_code2
  const uniqueOcrCodes = [...new Set(ocrResults.map(r => r.ocr_code2))];
  const approverCache = new Map<string, {
    lineApprovers: { userId: string; username: string; email?: string; priority: number }[];
    costCenterApprovers: { userId: string; username: string; email?: string; priority: number }[];
  }>();

  if (uniqueOcrCodes.length > 0) {
    const ocrCodeRecords = await db.ocr_code_and_name.findMany({
      where: { name: { in: uniqueOcrCodes } },
      select: { id: true, name: true },
    });

    const ocrCodeIds = ocrCodeRecords.map(o => o.id);

    if (ocrCodeIds.length > 0) {
      const allApprovers = await db.ocr_approver.findMany({
        where: { ocrCodeId: { in: ocrCodeIds } },
        orderBy: [{ approverType: 'asc' }, { priority: 'asc' }],
      });

      const userIds = [...new Set(allApprovers.map(a => a.userProductionId))];
      const users = await db.user_production.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, username: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      // Group approvers by ocrCodeId
      for (const ocrCode of ocrCodeRecords) {
        const lineApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];
        const costCenterApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];

        for (const approver of allApprovers.filter(a => a.ocrCodeId === ocrCode.id)) {
          const user = userMap.get(approver.userProductionId);
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

        approverCache.set(ocrCode.name, { lineApprovers, costCenterApprovers });
      }
    }
  }

  // 5. สร้าง pr_document_receipt + auto-approve requester
  let created = 0;
  for (const pr of prMasters) {
    try {
      const ocrCode2 = ocrMap.get(pr.doc_num) || null;
      const approvers = ocrCode2 ? approverCache.get(ocrCode2) : null;

      // ใช้ create_date, fallback เป็น doc_date
      const approvalDate = pr.create_date || pr.doc_date;
      if (!approvalDate) continue;

      const dateOnly = new Date(approvalDate);
      const reqName = pr.req_name || 'ไม่ระบุ';

      await db.pr_document_receipt.create({
        data: {
          pr_doc_num: pr.doc_num,
          receipt_date: dateOnly,
          receipt_datetime: dateOnly,
          received_by: reqName,
          received_by_user_id: null,
          ocr_code2: ocrCode2,
          line_approvers: approvers?.lineApprovers && approvers.lineApprovers.length > 0
            ? approvers.lineApprovers : Prisma.JsonNull,
          cost_center_approvers: approvers?.costCenterApprovers && approvers.costCenterApprovers.length > 0
            ? approvers.costCenterApprovers : Prisma.JsonNull,
          requester_approval_by: reqName,
          requester_approval_by_user_id: null,
          requester_approval_at: dateOnly,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      created++;
    } catch (err) {
      console.error(`[AUTO-APPROVE] Failed for PR ${pr.doc_num}:`, err);
    }
  }

  return { created, skipped: prDocNums.length - created };
}

export const prSyncRouter = createTRPCRouter({
  // 🔹 Sync ข้อมูลจาก SAP (Incremental Sync + PO Check + Full Sync ทุกวันอาทิตย์ 17:00)
  sync: createTableProcedure('pr_tracking', 'sync')
    .input(z.object({
      fullSync: z.boolean().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      let sqlPool: sql.ConnectionPool | null = null;
      const syncStartTime = new Date();

      try {
        // ✅ STEP 0: ตรวจสอบว่าวันนี้มี Full Sync แล้วหรือยัง
        const today = new Date().toISOString().split('T')[0];

        const fullSyncTodayResult = await ctx.db.$queryRawUnsafe(`
          SELECT sync_date, sync_type
          FROM sync_log
          WHERE status = 'success'
            AND sync_type = 'FULL'
            AND DATE(sync_date) = $1::DATE
          ORDER BY sync_date DESC
          LIMIT 1
        `, today) as any[];

        const hasFullSyncToday = fullSyncTodayResult.length > 0;

        const lastSyncResult = await ctx.db.$queryRawUnsafe(`
          SELECT sync_date
          FROM sync_log
          WHERE status = 'success'
          ORDER BY sync_date DESC
          LIMIT 1
        `) as any[];

        const lastSyncDate = lastSyncResult[0]?.sync_date;

        let isFullSync = false;
        let forceFullSyncWarning = false;

        if (input?.fullSync) {
          isFullSync = true;
          console.log(`[SYNC] 🔄 Manual Full Sync requested`);
        } else if (!hasFullSyncToday) {
          isFullSync = true;
          forceFullSyncWarning = true;
          console.log(`[SYNC] ⚠️  No Full Sync today - forcing FULL SYNC`);
        }

        const syncType = isFullSync ? 'FULL' : 'INCREMENTAL';

        console.log(`[SYNC] Starting ${syncType} sync...`);
        if (lastSyncDate) {
          console.log(`[SYNC] Last sync: ${lastSyncDate}`);
        }

        // ✅ STEP 1: เชื่อมต่อ SQL Server
        sqlPool = await sql.connect(sqlConfig);

        // ✅ STEP 1.5: ถ้าเป็น Full Sync ให้ล้างข้อมูลเก่าก่อน
        let documentReceiptBackup: any[] = [];
        let documentApprovalBackup: any[] = [];

        if (isFullSync) {
          console.log('[SYNC] Full Sync - backing up document receipt and approval data...');

          documentReceiptBackup = await ctx.db.$queryRawUnsafe(`
            SELECT * FROM pr_document_receipt
          `) as any[];

          documentApprovalBackup = await ctx.db.$queryRawUnsafe(`
            SELECT pr_doc_num, approval_status, reason, approved_by, approved_by_user_id, approved_at, created_at, updated_at
            FROM pr_document_approval
          `) as any[];

          console.log(`[SYNC] Backed up ${documentReceiptBackup.length} receipt records and ${documentApprovalBackup.length} approval records`);

          console.log('[SYNC] Full Sync - clearing tables first...');
          await ctx.db.$executeRaw`TRUNCATE TABLE pr_po_link CASCADE`;
          await ctx.db.$executeRaw`TRUNCATE TABLE pr_lines CASCADE`;
          await ctx.db.$executeRaw`TRUNCATE TABLE pr_master CASCADE`;
          console.log('[SYNC] Tables cleared successfully');
        }

        // ✅ STEP 2: สร้าง WHERE clause
        let whereClause = "T2.[BeginStr] = 'PR'";

        if (!isFullSync && lastSyncDate) {
          const lastSyncDateStr = new Date(lastSyncDate).toISOString().split('T')[0];
          whereClause += ` AND (
            CAST(T0.[CreateDate] AS DATE) >= '${lastSyncDateStr}' OR
            CAST(T0.[UpdateDate] AS DATE) >= '${lastSyncDateStr}' OR
            EXISTS (
              SELECT 1
              FROM POR1 T3_SUB
              INNER JOIN OPOR T4_SUB ON T3_SUB.[DocEntry] = T4_SUB.[DocEntry]
              WHERE T3_SUB.[BaseRef] = T0.[DocNum]
                AND CAST(T4_SUB.[DocDate] AS DATE) >= '${lastSyncDateStr}'
            )
          )`;
          console.log(`[SYNC] Fetching records where: CreateDate/UpdateDate >= ${lastSyncDateStr}`);
        } else {
          console.log(`[SYNC] Fetching all records (Full Sync)`);
        }

        // ✅ STEP 3: ดึงข้อมูลจาก SAP
        const result = await sqlPool.request().query(`
          SELECT
              T0.[DocNum] AS "เลขที่ PR",
              T0.[ReqName] AS "ชื่อผู้เปิด PR",
              T5.[Remarks] AS "ชื่อหน่วยงานผู้เปิด PR",
              T0.[DocDate] AS "วันที่เปิด PR",
              T0.[DocDueDate] AS "วันที่ครบกำหนด PR",
              T0.[DocStatus] AS "สถานะเอกสาร PR",
              T0.[UpdateDate] AS "วันที่อัปเดตล่าสุด",
              T0.[CreateDate] AS "วันที่สร้างเอกสาร",
              T0.[ReqDate] AS "วันที่ต้องการของ",
              T0.[U_U_PR_FOR] AS "ชื่องานที่ขอจัดซื้อ (U_U_PR_FOR)",
              T0.[U_U_PR_MAC] AS "รหัสเครื่องจักร (U_U_PR_MAC)",
              T0.[Comments] AS "หมายเหตุ PR",
              T1.[LineNum] AS "LineNum (PR)",
              T1.[ItemCode] AS "รหัสสินค้า (PR)",
              T1.[Dscription] AS "ชื่อสินค้า / รายการ (PR)",
              T1.[Quantity] AS "จำนวนที่ขอ (PR)",
              T1.[unitMsr] AS "หน่วยใน PR",
              T1.[LineStatus] AS "สถานะรายการ (PR)",
              T1.[DocDate] AS "วันที่รายการ (PR)",
              T1.[OcrCode],
              T1.[OcrCode2],
              T1.[OcrCode4],
              T1.[Project] AS "รหัสโครงการ (PR)",
              T1.[VendorNum] AS "รหัสผู้ขาย (PR)",
              T1.[SerialNum] AS "Serial Number (PR)",
              T2.[Series],
              T2.[BeginStr] AS "คำนำหน้าเอกสาร PR",
              T3.[BaseRef] AS "เลขที่ PR ที่อ้างอิงใน PO",
              T4.[DocNum] AS "เลขที่ PO",
              T4.[DocDate] AS "วันที่สร้าง PO",
              T4.[DocDueDate] AS "วันที่ครบกำหนด PO",
              T3.[Dscription] AS "รายละเอียดสินค้า (PO)",
              T3.[Quantity] AS "จำนวนใน PO",
              T3.[unitMsr] AS "หน่วยใน PO",
              T3.[LineStatus] AS "สถานะรายการ (PO)"
          FROM
              OPRQ T0
              INNER JOIN PRQ1 T1 ON T0.[DocEntry] = T1.[DocEntry]
              LEFT JOIN NNM1 T2 ON T0.[Series] = T2.[Series]
              LEFT JOIN POR1 T3 ON (T0.[DocNum] = T3.[BaseRef] AND T1.[LineNum] = T3.[BaseLine])
              LEFT JOIN OPOR T4 ON T3.[DocEntry] = T4.[DocEntry]
              LEFT JOIN OUDP T5 ON T0.[Department] = T5.[Code]
          WHERE ${whereClause}
          ORDER BY T0.[DocNum];
        `);

        const records = result.recordset;
        console.log(`[SYNC] Fetched ${records.length} records from SAP`);

        // ✅ STEP 4: แปลงข้อมูล
        const prMasterMap = new Map();
        const prLinesMap = new Map();
        const prPoLinksMap = new Map();
        const poInfoMap = new Map();

        records.forEach((record: any) => {
          const prDocNum = record['เลขที่ PR'];

          if (!prMasterMap.has(prDocNum)) {
            prMasterMap.set(prDocNum, {
              doc_num: prDocNum,
              req_name: record['ชื่อผู้เปิด PR'],
              department_name: record['ชื่อหน่วยงานผู้เปิด PR'],
              doc_date: record['วันที่เปิด PR'] ? new Date(record['วันที่เปิด PR']).toISOString().split('T')[0] : null,
              doc_due_date: record['วันที่ครบกำหนด PR'] ? new Date(record['วันที่ครบกำหนด PR']).toISOString().split('T')[0] : null,
              doc_status: record['สถานะเอกสาร PR'],
              update_date: record['วันที่อัปเดตล่าสุด'] ? new Date(record['วันที่อัปเดตล่าสุด']).toISOString() : null,
              create_date: record['วันที่สร้างเอกสาร'] ? new Date(record['วันที่สร้างเอกสาร']).toISOString() : null,
              req_date: record['วันที่ต้องการของ'] ? new Date(record['วันที่ต้องการของ']).toISOString().split('T')[0] : null,
              job_name: record['ชื่องานที่ขอจัดซื้อ (U_U_PR_FOR)'],
              machine_code: record['รหัสเครื่องจักร (U_U_PR_MAC)'],
              remarks: record['หมายเหตุ PR'],
              series: record['Series'],
              series_name: record['คำนำหน้าเอกสาร PR']
            });
          }

          const lineKey = `${prDocNum}-${record['LineNum (PR)']}`;
          if (!prLinesMap.has(lineKey)) {
            prLinesMap.set(lineKey, {
              pr_doc_num: prDocNum,
              line_num: record['LineNum (PR)'],
              item_code: record['รหัสสินค้า (PR)'],
              description: record['ชื่อสินค้า / รายการ (PR)'],
              quantity: record['จำนวนที่ขอ (PR)'],
              unit_msr: record['หน่วยใน PR'],
              line_status: record['สถานะรายการ (PR)'],
              line_date: record['วันที่รายการ (PR)'] ? new Date(record['วันที่รายการ (PR)']).toISOString().split('T')[0] : null,
              ocr_code: record['OcrCode'],
              ocr_code2: record['OcrCode2'],
              ocr_code4: record['OcrCode4'],
              project: record['รหัสโครงการ (PR)'],
              vendor_num: record['รหัสผู้ขาย (PR)'],
              serial_num: record['Serial Number (PR)']
            });
          }

          if (record['เลขที่ PO']) {
            const poKey = `${prDocNum}-${record['ชื่อสินค้า / รายการ (PR)']}-${record['เลขที่ PO']}`;
            if (!prPoLinksMap.has(poKey)) {
              prPoLinksMap.set(poKey, {
                pr_doc_num: prDocNum,
                pr_line_description: record['ชื่อสินค้า / รายการ (PR)'],
                po_doc_num: record['เลขที่ PO'],
                po_due_date: record['วันที่ครบกำหนด PO'] ? new Date(record['วันที่ครบกำหนด PO']).toISOString().split('T')[0] : null,
                po_line_description: record['รายละเอียดสินค้า (PO)'],
                po_quantity: record['จำนวนใน PO'],
                po_unit: record['หน่วยใน PO'],
                po_line_status: record['สถานะรายการ (PO)']
              });
            }

            const poDocNum = record['เลขที่ PO'];
            if (!poInfoMap.has(poDocNum)) {
              poInfoMap.set(poDocNum, {
                po_doc_num: poDocNum,
                po_doc_date: record['วันที่สร้าง PO'] ? new Date(record['วันที่สร้าง PO']).toISOString().split('T')[0] : null,
                po_due_date: record['วันที่ครบกำหนด PO'] ? new Date(record['วันที่ครบกำหนด PO']).toISOString().split('T')[0] : null,
              });
            }
          }
        });

        const jsonData = {
          pr_master: Array.from(prMasterMap.values()),
          pr_lines: Array.from(prLinesMap.values()),
          pr_po_links: Array.from(prPoLinksMap.values())
        };

        const poInfoList = Array.from(poInfoMap.values());
        console.log(`[SYNC] Processing ${jsonData.pr_master.length} PR masters, ${jsonData.pr_lines.length} lines, ${jsonData.pr_po_links.length} PO links`);

        // ✅ STEP 5: เรียก upsert_pr_data()
        const upsertResult = await ctx.db.$queryRawUnsafe(
          'SELECT * FROM upsert_pr_data($1::JSONB)',
          JSON.stringify(jsonData)
        ) as any[];

        // ✅ STEP 5.5: Sync ข้อมูล PO Info
        let poInfoUpdated = 0;
        for (const poInfo of poInfoList) {
          if (poInfo.po_doc_date) {
            await ctx.db.po_info.upsert({
              where: { po_doc_num: poInfo.po_doc_num },
              update: {
                po_doc_date: new Date(poInfo.po_doc_date),
                po_due_date: poInfo.po_due_date ? new Date(poInfo.po_due_date) : null,
                updated_at: new Date(),
              },
              create: {
                po_doc_num: poInfo.po_doc_num,
                po_doc_date: new Date(poInfo.po_doc_date),
                po_due_date: poInfo.po_due_date ? new Date(poInfo.po_due_date) : null,
              },
            });
            poInfoUpdated++;
          }
        }
        console.log(`[SYNC] Updated ${poInfoUpdated} PO info records`);

        // ✅ STEP 6: Refresh Materialized View
        await ctx.db.$queryRawUnsafe('SELECT quick_refresh_view()');

        // ✅ STEP 6.5: Restore ข้อมูล
        if (isFullSync && (documentReceiptBackup.length > 0 || documentApprovalBackup.length > 0)) {
          console.log('[SYNC] Restoring document receipt and approval data...');

          for (const receipt of documentReceiptBackup) {
            try {
              const prExists = await ctx.db.$queryRawUnsafe<Array<{ exists: boolean }>>(
                'SELECT EXISTS(SELECT 1 FROM pr_master WHERE doc_num = $1) as exists',
                receipt.pr_doc_num
              );

              if (prExists[0]?.exists) {
                await ctx.db.$queryRawUnsafe(`
                  INSERT INTO pr_document_receipt (
                    pr_doc_num, receipt_date, receipt_datetime, received_by, received_by_user_id,
                    ocr_code2, line_approvers, cost_center_approvers,
                    requester_approval_by, requester_approval_by_user_id, requester_approval_at,
                    line_approval_by, line_approval_by_user_id, line_approval_at,
                    cost_center_approval_by, cost_center_approval_by_user_id, cost_center_approval_at,
                    procurement_approval_by, procurement_approval_by_user_id, procurement_approval_at,
                    vpc_approval_by, vpc_approval_by_user_id, vpc_approval_at,
                    created_at, updated_at
                  )
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
                  ON CONFLICT (pr_doc_num) DO UPDATE SET
                    receipt_date = EXCLUDED.receipt_date,
                    receipt_datetime = EXCLUDED.receipt_datetime,
                    received_by = EXCLUDED.received_by,
                    received_by_user_id = EXCLUDED.received_by_user_id,
                    ocr_code2 = EXCLUDED.ocr_code2,
                    line_approvers = EXCLUDED.line_approvers,
                    cost_center_approvers = EXCLUDED.cost_center_approvers,
                    requester_approval_by = EXCLUDED.requester_approval_by,
                    requester_approval_by_user_id = EXCLUDED.requester_approval_by_user_id,
                    requester_approval_at = EXCLUDED.requester_approval_at,
                    line_approval_by = EXCLUDED.line_approval_by,
                    line_approval_by_user_id = EXCLUDED.line_approval_by_user_id,
                    line_approval_at = EXCLUDED.line_approval_at,
                    cost_center_approval_by = EXCLUDED.cost_center_approval_by,
                    cost_center_approval_by_user_id = EXCLUDED.cost_center_approval_by_user_id,
                    cost_center_approval_at = EXCLUDED.cost_center_approval_at,
                    procurement_approval_by = EXCLUDED.procurement_approval_by,
                    procurement_approval_by_user_id = EXCLUDED.procurement_approval_by_user_id,
                    procurement_approval_at = EXCLUDED.procurement_approval_at,
                    vpc_approval_by = EXCLUDED.vpc_approval_by,
                    vpc_approval_by_user_id = EXCLUDED.vpc_approval_by_user_id,
                    vpc_approval_at = EXCLUDED.vpc_approval_at,
                    updated_at = EXCLUDED.updated_at
                `,
                  receipt.pr_doc_num, receipt.receipt_date, receipt.receipt_datetime,
                  receipt.received_by, receipt.received_by_user_id,
                  receipt.ocr_code2,
                  receipt.line_approvers ? JSON.stringify(receipt.line_approvers) : null,
                  receipt.cost_center_approvers ? JSON.stringify(receipt.cost_center_approvers) : null,
                  receipt.requester_approval_by, receipt.requester_approval_by_user_id, receipt.requester_approval_at,
                  receipt.line_approval_by, receipt.line_approval_by_user_id, receipt.line_approval_at,
                  receipt.cost_center_approval_by, receipt.cost_center_approval_by_user_id, receipt.cost_center_approval_at,
                  receipt.procurement_approval_by, receipt.procurement_approval_by_user_id, receipt.procurement_approval_at,
                  receipt.vpc_approval_by, receipt.vpc_approval_by_user_id, receipt.vpc_approval_at,
                  receipt.created_at, receipt.updated_at
                );
              }
            } catch (error) {
              console.error(`[SYNC] Failed to restore receipt for PR ${receipt.pr_doc_num}:`, error);
            }
          }

          for (const approval of documentApprovalBackup) {
            try {
              const prExists = await ctx.db.$queryRawUnsafe<Array<{ exists: boolean }>>(
                'SELECT EXISTS(SELECT 1 FROM pr_master WHERE doc_num = $1) as exists',
                approval.pr_doc_num
              );

              if (prExists[0]?.exists) {
                await ctx.db.$queryRawUnsafe(`
                  INSERT INTO pr_document_approval (pr_doc_num, approval_status, reason, approved_by, approved_by_user_id, approved_at, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                  ON CONFLICT (pr_doc_num) DO UPDATE SET
                    approval_status = EXCLUDED.approval_status,
                    reason = EXCLUDED.reason,
                    approved_by = EXCLUDED.approved_by,
                    approved_by_user_id = EXCLUDED.approved_by_user_id,
                    approved_at = EXCLUDED.approved_at,
                    updated_at = EXCLUDED.updated_at
                `, approval.pr_doc_num, approval.approval_status, approval.reason, approval.approved_by, approval.approved_by_user_id, approval.approved_at, approval.created_at, approval.updated_at);
              }
            } catch (error) {
              console.error(`[SYNC] Failed to restore approval for PR ${approval.pr_doc_num}:`, error);
            }
          }

          console.log(`[SYNC] Restored ${documentReceiptBackup.length} receipt records and ${documentApprovalBackup.length} approval records`);
        }

        // ✅ STEP 6.6: Auto-approve ขั้น 1 (REQUESTER) สำหรับ PR ที่ยังไม่มี receipt
        if (jsonData.pr_master.length > 0) {
          const prDocNums = jsonData.pr_master.map((pr: { doc_num: number }) => pr.doc_num);
          console.log(`[SYNC] Auto-approving requester for ${prDocNums.length} PRs...`);
          const autoResult = await autoApproveRequesterForNewPRs(ctx.db, prDocNums);
          console.log(`[SYNC] Auto-approved: ${autoResult.created} new, ${autoResult.skipped} skipped`);
        }

        // ✅ STEP 7: บันทึก sync log
        const syncEndTime = new Date();
        const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);

        const syncLogResult = await ctx.db.$queryRawUnsafe<{ id: number }[]>(`
          INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, syncEndTime, 'success', records.length, durationSeconds, syncType, null);

        const syncLogId = syncLogResult[0]?.id;

        console.log(`[SYNC] ✅ ${syncType} sync completed in ${durationSeconds}s`);
        console.log(`[SYNC] Updated: ${upsertResult[0].pr_master_updated} PRs, ${upsertResult[0].pr_lines_updated} lines, ${upsertResult[0].po_links_updated} PO links`);

        // ✅ STEP 8: บันทึก change log (เฉพาะ Incremental Sync)
        if (syncLogId && syncType === 'INCREMENTAL' && jsonData.pr_master.length > 0) {
          console.log(`[SYNC] Recording ${jsonData.pr_master.length} changes to sync_change_log...`);

          for (const prMaster of jsonData.pr_master) {
            const prNo = prMaster.doc_num;

            const oldPRData = await ctx.db.$queryRawUnsafe<Array<{
              doc_status: string;
              req_name: string;
            }>>(`SELECT doc_status, req_name FROM pr_master WHERE doc_num = $1`, prNo);

            const oldStatus = oldPRData[0]?.doc_status;
            const newStatus = prMaster.doc_status;
            const reqName = prMaster.req_name;

            const poLinks = jsonData.pr_po_links.filter(link => link.pr_doc_num === prNo);
            const isNewPR = !oldStatus;
            const docDate = prMaster.doc_date ? new Date(prMaster.doc_date).toISOString().split('T')[0] : null;
            const updateDate = prMaster.update_date ? new Date(prMaster.update_date).toISOString().split('T')[0] : null;
            const isJustCreated = docDate && updateDate && docDate === updateDate;

            if (oldStatus && oldStatus !== newStatus) {
              const existingLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
                SELECT id FROM sync_change_log
                WHERE change_type = 'PR_STATUS_CHANGED' AND pr_no = $1 AND old_status = $2 AND new_status = $3
                LIMIT 1
              `, prNo, oldStatus, newStatus);

              if (existingLog.length === 0) {
                await ctx.db.$queryRawUnsafe(`
                  INSERT INTO sync_change_log (sync_log_id, change_type, pr_no, pr_description, old_status, new_status, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, syncLogId, 'PR_STATUS_CHANGED', prNo, reqName, oldStatus, newStatus, syncEndTime);
              }
            }

            if (isNewPR || isJustCreated) {
              const existingLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
                SELECT id FROM sync_change_log WHERE change_type = 'PR_NEW' AND pr_no = $1 LIMIT 1
              `, prNo);

              if (existingLog.length === 0) {
                await ctx.db.$queryRawUnsafe(`
                  INSERT INTO sync_change_log (sync_log_id, change_type, pr_no, pr_description, new_status, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, syncLogId, 'PR_NEW', prNo, reqName, newStatus, syncEndTime);
              }
            } else if (oldStatus === newStatus && !isJustCreated) {
              const existingLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
                SELECT id FROM sync_change_log WHERE change_type = 'PR_UPDATED' AND pr_no = $1 AND sync_log_id = $2 LIMIT 1
              `, prNo, syncLogId);

              if (existingLog.length === 0) {
                await ctx.db.$queryRawUnsafe(`
                  INSERT INTO sync_change_log (sync_log_id, change_type, pr_no, pr_description, new_status, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, syncLogId, 'PR_UPDATED', prNo, reqName, newStatus, syncEndTime);
              }
            }

            for (const poLink of poLinks) {
              const existingPOLog = await ctx.db.$queryRawUnsafe<Array<{ id: number }>>(`
                SELECT id FROM sync_change_log
                WHERE change_type = 'PO_LINKED' AND pr_no = $1 AND po_no = $2 AND po_description = $3
                LIMIT 1
              `, prNo, poLink.po_doc_num, poLink.po_line_description);

              if (existingPOLog.length === 0) {
                await ctx.db.$queryRawUnsafe(`
                  INSERT INTO sync_change_log (sync_log_id, change_type, pr_no, pr_description, po_no, po_description, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, syncLogId, 'PO_LINKED', prNo, reqName, poLink.po_doc_num, poLink.po_line_description, syncEndTime);
              }
            }
          }

          console.log(`[SYNC] ✅ Recorded changes to sync_change_log`);
        }

        let message = `[${syncType}] Synced ${upsertResult[0].pr_master_updated} PRs, ${upsertResult[0].pr_lines_updated} lines, ${upsertResult[0].po_links_updated} PO links in ${durationSeconds}s`;

        if (forceFullSyncWarning) {
          message = `⚠️ ยังไม่เคย Full Sync วันนี้ - ทำ Full Sync แทน\n${message}`;
        }

        return {
          success: true,
          sync_type: syncType,
          records_fetched: records.length,
          duration_seconds: durationSeconds,
          forced_full_sync: forceFullSyncWarning,
          ...upsertResult[0],
          message,
        };

      } catch (error) {
        const syncEndTime = new Date();
        const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        try {
          await ctx.db.$queryRawUnsafe(`
            INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, syncEndTime, 'error', 0, durationSeconds, 'UNKNOWN', errorMessage);
        } catch (logError) {
          console.error('Failed to log sync error:', logError);
        }

        console.error('[SYNC] ❌ Sync error:', error);
        throw new Error(`Sync failed: ${errorMessage}`);
      } finally {
        if (sqlPool) {
          await sqlPool.close();
        }
      }
    }),

  // 🔹 Refresh Materialized View
  refreshView: createTableProcedure('pr_tracking', 'sync').mutation(async ({ ctx }) => {
    const result = await ctx.db.$queryRawUnsafe('SELECT quick_refresh_view()') as any[];
    return {
      success: true,
      message: result[0]?.quick_refresh_view || 'Refreshed successfully',
    };
  }),

  // 🔹 ดึง Sync History
  getSyncHistory: createTableProcedure('admin_sync_pr', 'read')
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`sync_date >= $${paramIndex}`);
        params.push(new Date(dateFrom));
        paramIndex++;
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(`sync_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const syncSessions = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        sync_date: Date;
        sync_type: string;
        status: string;
        records_processed: number;
        duration_seconds: number;
      }>>(`
        SELECT id, sync_date, sync_type, status, records_processed, duration_seconds
        FROM sync_log
        ${whereClause}
        ORDER BY sync_date DESC
      `, ...params);

      const historyWithChanges = await Promise.all(
        syncSessions.map(async (session) => {
          const changes = await ctx.db.$queryRawUnsafe<Array<{
            id: number;
            change_type: string;
            pr_no: number;
            pr_description: string | null;
            po_no: number | null;
            po_description: string | null;
            old_status: string | null;
            new_status: string | null;
            created_at: Date;
          }>>(`
            SELECT id, change_type, pr_no, pr_description, po_no, po_description, old_status, new_status, created_at
            FROM sync_change_log
            WHERE sync_log_id = $1
            ORDER BY created_at DESC, pr_no ASC
          `, session.id);

          return {
            ...session,
            changes,
            change_count: changes.length,
          };
        })
      );

      return {
        sessions: historyWithChanges,
        total: historyWithChanges.length,
      };
    }),

  // 🔹 ดึง changes ของ sync session
  getSyncChanges: createTableProcedure('admin_sync_pr', 'read')
    .input(z.object({
      syncLogId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const changes = await ctx.db.$queryRawUnsafe<Array<{
        id: number;
        change_type: string;
        pr_no: number;
        pr_description: string | null;
        po_no: number | null;
        po_description: string | null;
        old_status: string | null;
        new_status: string | null;
        created_at: Date;
      }>>(`
        SELECT id, change_type, pr_no, pr_description, po_no, po_description, old_status, new_status, created_at
        FROM sync_change_log
        WHERE sync_log_id = $1
        ORDER BY created_at DESC, pr_no ASC
      `, input.syncLogId);

      return changes;
    }),

  // 🔹 ดึงรายการ PR ที่ยังไม่มี pr_document_receipt (สำหรับ Admin backfill)
  getUnreceiptedPRs: createTableProcedure('admin_sync_pr', 'sync')
    .query(async ({ ctx }) => {
      const prs = await ctx.db.$queryRawUnsafe<Array<{
        doc_num: number;
        req_name: string | null;
        create_date: Date | null;
        doc_date: Date | null;
        job_name: string | null;
      }>>(`
        SELECT m.doc_num, m.req_name, m.create_date, m.doc_date, m.job_name
        FROM pr_master m
        LEFT JOIN pr_document_receipt r ON m.doc_num = r.pr_doc_num
        WHERE r.pr_doc_num IS NULL
        ORDER BY m.doc_num DESC
      `);
      return prs;
    }),

  // 🔹 Backfill auto-approve ขั้น 1 สำหรับ PR ที่เลือก (Admin only)
  backfillRequesterApproval: createTableProcedure('admin_sync_pr', 'sync')
    .input(z.object({
      prDocNums: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await autoApproveRequesterForNewPRs(ctx.db, input.prDocNums);
      return result;
    }),
});
