/**
 * PR Approval Router - approveIndividual, clearApproval, getMyPendingApprovals, etc.
 */
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, createTableProcedure, authenticatedProcedure } from "~/server/api/trpc";
import { sendCustomNotification } from "~/server/services/telegram";
import { createAuditLog, AuditAction, getIpFromContext } from "~/server/api/utils/auditLog";
import { checkTablePermission } from "~/lib/check-permission";
import type { PermissionAction } from "~/lib/permissions";
import { updateKpiApprovalSummary } from "~/server/kpi-approval-aggregator";

// Mapping approval type to permission action
const APPROVAL_PERMISSION_MAP: Record<string, { tableName: string; action: PermissionAction }> = {
  requester: { tableName: 'pr_approve', action: 'requester' },
  line: { tableName: 'pr_approve', action: 'line_approver' },
  cost_center: { tableName: 'pr_approve', action: 'cost_center' },
  procurement: { tableName: 'pr_approve', action: 'manager' },
  vpc: { tableName: 'pr_approve', action: 'final' },
};

export const prApprovalRouter = createTRPCRouter({
  // 🔹 อนุมัติโดยผู้ขอซื้อ, ผู้อนุมัติตามสายงาน, Cost Center, งานจัดซื้อพัสดุ หรือ VP-C
  // Note: Uses authenticatedProcedure - internal logic handles role/workflow checks
  approveIndividual: authenticatedProcedure
    .input(z.object({
      prNo: z.number(),
      approvalType: z.enum(['requester', 'line', 'cost_center', 'procurement', 'vpc']),
      approverName: z.string(),
      approverUserId: z.string().optional(),
      approverRole: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let receipt = await ctx.db.pr_document_receipt.findUnique({
        where: { pr_doc_num: input.prNo },
      });

      // Auto-create receipt if needed
      if (!receipt) {
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

        let lineApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];
        let costCenterApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];

        if (primaryOcrCode2) {
          const ocrCode = await ctx.db.ocr_code_and_name.findFirst({
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
                email: user?.email || undefined,
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

        // 🔐 ตรวจสอบ Permission + OCR Approver List
        const permissionConfig = APPROVAL_PERMISSION_MAP[input.approvalType];
        if (!permissionConfig) {
          throw new Error('Invalid approval type');
        }

        // เช็ค permission ก่อน
        const permissionResult = await checkTablePermission(ctx.db, {
          tableName: permissionConfig.tableName,
          action: permissionConfig.action,
          userId: input.approverUserId || '',
          userRole: input.approverRole || '',
        });

        if (!permissionResult.allowed) {
          throw new Error(`คุณไม่มีสิทธิ์อนุมัติ${
            input.approvalType === 'requester' ? ' (ผู้ขอซื้อ)' :
            input.approvalType === 'line' ? 'ตามสายงาน (ขั้น 2)' :
            input.approvalType === 'cost_center' ? 'ตาม Cost Center (ขั้น 3)' :
            input.approvalType === 'procurement' ? ' (งานจัดซื้อพัสดุ - ขั้น 4)' :
            ' (VP-C - ขั้น 5)'
          }`);
        }

        // สำหรับ line และ cost_center ต้องเช็ค ocr_approver list ด้วย
        if (input.approvalType === 'line' || input.approvalType === 'cost_center') {
          const approverList = input.approvalType === 'line' ? lineApprovers : costCenterApprovers;
          const isInApproverList = approverList.some(
            approver => approver.username === input.approverName || approver.userId === input.approverUserId
          );
          if (!isInApproverList) {
            throw new Error(`คุณไม่ได้อยู่ในรายชื่อผู้อนุมัติ${input.approvalType === 'line' ? 'ตามสายงาน' : 'ตาม Cost Center'}ของ PR นี้`);
          }
        }

        const now = new Date();
        const thaiDateTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

        receipt = await ctx.db.pr_document_receipt.create({
          data: {
            pr_doc_num: input.prNo,
            receipt_date: now,
            receipt_datetime: thaiDateTime,
            received_by: input.approverName,
            received_by_user_id: input.approverUserId,
            ocr_code2: primaryOcrCode2,
            line_approvers: lineApprovers.length > 0 ? lineApprovers : Prisma.JsonNull,
            cost_center_approvers: costCenterApprovers.length > 0 ? costCenterApprovers : Prisma.JsonNull,
            created_at: now,
            updated_at: now,
          },
        });
      }

      // 🔐 Check authorization for existing receipt (Permission + OCR Approver List)
      const permissionConfig = APPROVAL_PERMISSION_MAP[input.approvalType];
      if (!permissionConfig) {
        throw new Error('Invalid approval type');
      }

      // เช็ค permission ก่อน
      const permissionResult = await checkTablePermission(ctx.db, {
        tableName: permissionConfig.tableName,
        action: permissionConfig.action,
        userId: input.approverUserId || '',
        userRole: input.approverRole || '',
      });

      if (!permissionResult.allowed) {
        throw new Error(`คุณไม่มีสิทธิ์อนุมัติ${
          input.approvalType === 'requester' ? ' (ผู้ขอซื้อ)' :
          input.approvalType === 'line' ? 'ตามสายงาน (ขั้น 2)' :
          input.approvalType === 'cost_center' ? 'ตาม Cost Center (ขั้น 3)' :
          input.approvalType === 'procurement' ? ' (งานจัดซื้อพัสดุ - ขั้น 4)' :
          ' (VP-C - ขั้น 5)'
        }`);
      }

      // สำหรับ line และ cost_center ต้องเช็คจาก ocr_approver table ตรงๆ (live data)
      if (input.approvalType === 'line' || input.approvalType === 'cost_center') {
        let isInApproverList = false;

        if (receipt.ocr_code2) {
          const ocrCode = await ctx.db.ocr_code_and_name.findFirst({
            where: { name: receipt.ocr_code2 },
          });

          if (ocrCode) {
            const liveApprovers = await ctx.db.ocr_approver.findMany({
              where: { ocrCodeId: ocrCode.id, approverType: input.approvalType === 'line' ? 'line' : 'cost_center' },
            });

            isInApproverList = liveApprovers.some(
              approver => approver.userProductionId === input.approverUserId
            );

            // ถ้าเจอ ให้ fallback เช็ค username ด้วย
            if (!isInApproverList) {
              const approverUserIds = liveApprovers.map(a => a.userProductionId);
              const approverUsers = await ctx.db.user_production.findMany({
                where: { id: { in: approverUserIds } },
                select: { id: true, username: true, name: true },
              });
              isInApproverList = approverUsers.some(
                u => u.username === input.approverName || u.name === input.approverName
              );
            }
          }
        }

        if (!isInApproverList) {
          throw new Error(`คุณไม่ได้อยู่ในรายชื่อผู้อนุมัติ${input.approvalType === 'line' ? 'ตามสายงาน' : 'ตาม Cost Center'}ของ PR นี้`);
        }
      }

      // Sequential approval validation
      const approvalOrder = ['requester', 'line', 'cost_center', 'procurement', 'vpc'] as const;
      const approvalNames: Record<string, string> = {
        requester: 'ผู้ขอซื้อ',
        line: 'ผู้อนุมัติตามสายงาน',
        cost_center: 'ผู้อนุมัติตาม Cost Center',
        procurement: 'งานจัดซื้อพัสดุ',
        vpc: 'VP-C',
      };

      const currentIndex = approvalOrder.indexOf(input.approvalType);

      for (let i = 0; i < currentIndex; i++) {
        const prevType = approvalOrder[i]!;
        const prevApprovalField = `${prevType}_approval_at` as keyof typeof receipt;
        if (!receipt[prevApprovalField]) {
          throw new Error(`ต้อง approve ${approvalNames[prevType]} ก่อน`);
        }
      }

      // Check if already approved
      const approvalFieldMap = {
        requester: receipt.requester_approval_at,
        line: receipt.line_approval_at,
        cost_center: receipt.cost_center_approval_at,
        procurement: receipt.procurement_approval_at,
        vpc: receipt.vpc_approval_at,
      };

      if (approvalFieldMap[input.approvalType]) {
        throw new Error(`อนุมัติ${input.approvalType === 'requester' ? ' (ผู้ขอซื้อ)' : ''} ไปแล้ว`);
      }

      const now = new Date();
      const bangkokDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const dateOnly = new Date(Date.UTC(bangkokDate.getFullYear(), bangkokDate.getMonth(), bangkokDate.getDate()));

      const updateDataMap: Record<string, Record<string, unknown>> = {
        requester: {
          requester_approval_by: input.approverName,
          requester_approval_by_user_id: input.approverUserId || null,
          requester_approval_at: dateOnly,
          updated_at: now,
        },
        line: {
          line_approval_by: input.approverName,
          line_approval_by_user_id: input.approverUserId || null,
          line_approval_at: dateOnly,
          updated_at: now,
        },
        cost_center: {
          cost_center_approval_by: input.approverName,
          cost_center_approval_by_user_id: input.approverUserId || null,
          cost_center_approval_at: dateOnly,
          updated_at: now,
        },
        procurement: {
          procurement_approval_by: input.approverName,
          procurement_approval_by_user_id: input.approverUserId || null,
          procurement_approval_at: dateOnly,
          updated_at: now,
        },
        vpc: {
          vpc_approval_by: input.approverName,
          vpc_approval_by_user_id: input.approverUserId || null,
          vpc_approval_at: dateOnly,
          updated_at: now,
        },
      };

      const updated = await ctx.db.pr_document_receipt.update({
        where: { pr_doc_num: input.prNo },
        data: updateDataMap[input.approvalType]!,
      });

      // 🔹 KPI Tracking: บันทึก approval KPI metric
      try {
        // Determine previous stage timestamp
        const previousStageMap: Record<string, keyof typeof receipt | null> = {
          requester: null, // ไม่มี stage ก่อนหน้า
          line: 'requester_approval_at',
          cost_center: 'line_approval_at',
          procurement: 'cost_center_approval_at',
          vpc: 'procurement_approval_at',
        };

        const previousStageField = previousStageMap[input.approvalType];
        const previousStageAt = previousStageField ? receipt[previousStageField] as Date | null : null;

        // Calculate duration in days from previous stage or from receipt_date for requester
        let durationDays = 0;
        let effectivePreviousAt: Date | null = null;

        if (input.approvalType === 'requester') {
          // For requester: duration from receipt_date
          effectivePreviousAt = receipt.receipt_date ? new Date(receipt.receipt_date) : null;
        } else {
          effectivePreviousAt = previousStageAt;
        }

        if (effectivePreviousAt) {
          const prevDate = new Date(effectivePreviousAt);
          const prevDateOnly = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
          durationDays = Math.floor((dateOnly.getTime() - prevDateOnly.getTime()) / (1000 * 60 * 60 * 24));
          if (durationDays < 0) durationDays = 0;
        }

        // Get SLA config for this stage
        const slaConfig = await ctx.db.kpi_sla_config.findFirst({
          where: {
            kpi_type: 'approval',
            is_active: true,
            OR: [
              { stage: input.approvalType },
              { stage: null }, // Default for all stages
            ],
          },
          orderBy: { stage: 'desc' }, // Specific stage takes priority over null
        });

        const slaTargetDays = slaConfig?.target_days ?? null;
        const isOnTime = slaTargetDays !== null
          ? durationDays <= slaTargetDays
          : null;

        // Insert KPI metric
        await ctx.db.approval_kpi_metric.create({
          data: {
            pr_doc_num: input.prNo,
            approval_stage: input.approvalType,
            user_id: input.approverUserId || 'unknown',
            user_name: input.approverName,
            previous_stage_at: effectivePreviousAt,
            approved_at: dateOnly,
            duration_days: durationDays,
            sla_target_days: slaTargetDays,
            is_on_time: isOnTime,
            ocr_code2: receipt.ocr_code2,
          },
        });

        // Update pre-aggregated summary tables
        updateKpiApprovalSummary({
          userId: input.approverUserId || 'unknown',
          userName: input.approverName,
          approvalStage: input.approvalType,
          approvedAt: dateOnly,
          durationDays: durationDays,
          isOnTime: isOnTime,
        }).catch(console.error);
      } catch (kpiError) {
        // Log error but don't fail the approval
        console.error('[KPI] Failed to record approval KPI metric:', kpiError);
      }

      // Audit log: PR Approval
      createAuditLog(ctx.db, {
        userId: input.approverUserId,
        userName: input.approverName,
        action: "APPROVE_PR",
        tableName: "pr_document_receipt",
        recordId: String(input.prNo),
        prNo: input.prNo,
        newValues: {
          approvalType: input.approvalType,
          approvedBy: input.approverName,
          approvedAt: dateOnly,
        },
        description: `อนุมัติ PR #${input.prNo} (${approvalNames[input.approvalType]})`,
        metadata: {
          approverRole: input.approverRole,
        },
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      return {
        success: true,
        approvalType: input.approvalType,
        approvalAt: dateOnly,
        approvedBy: input.approverName,
        data: updated,
      };
    }),

  // 🔹 ล้างการอนุมัติ (Admin only)
  clearIndividualApproval: createTableProcedure('pr_approve', 'clear')
    .input(z.object({
      prNo: z.number(),
      approvalType: z.enum(['requester', 'line', 'cost_center', 'procurement', 'vpc']),
      clearedByRole: z.string(),
      clearedByUserId: z.string().optional(),
      clearedByName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.clearedByRole !== 'Admin') {
        throw new Error('เฉพาะ Admin เท่านั้นที่สามารถล้างการอนุมัติได้');
      }

      const receipt = await ctx.db.pr_document_receipt.findUnique({
        where: { pr_doc_num: input.prNo },
      });

      if (!receipt) {
        throw new Error('ไม่พบข้อมูลการรับเอกสาร');
      }

      const now = new Date();

      const clearDataMap: Record<string, Record<string, unknown>> = {
        requester: {
          requester_approval_by: null,
          requester_approval_by_user_id: null,
          requester_approval_at: null,
        },
        line: {
          line_approval_by: null,
          line_approval_by_user_id: null,
          line_approval_at: null,
        },
        cost_center: {
          cost_center_approval_by: null,
          cost_center_approval_by_user_id: null,
          cost_center_approval_at: null,
        },
        procurement: {
          procurement_approval_by: null,
          procurement_approval_by_user_id: null,
          procurement_approval_at: null,
        },
        vpc: {
          vpc_approval_by: null,
          vpc_approval_by_user_id: null,
          vpc_approval_at: null,
        },
      };

      // Cascade clear: ลบขั้นที่เลือก + ขั้นหลังๆ ทั้งหมด
      const approvalOrder = ['requester', 'line', 'cost_center', 'procurement', 'vpc'] as const;
      const targetIndex = approvalOrder.indexOf(input.approvalType);

      let combinedClearData: Record<string, unknown> = { updated_at: now };

      for (let i = targetIndex; i < approvalOrder.length; i++) {
        const stage = approvalOrder[i]!;
        const stageData = clearDataMap[stage]!;
        combinedClearData = { ...combinedClearData, ...stageData };
      }

      // Refresh approver snapshot จาก ocr_approver ปัจจุบัน
      if (receipt.ocr_code2) {
        const ocrCode = await ctx.db.ocr_code_and_name.findFirst({
          where: { name: receipt.ocr_code2 },
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

          const newLineApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];
          const newCostCenterApprovers: { userId: string; username: string; email?: string; priority: number }[] = [];

          for (const approver of approvers) {
            const user = users.find(u => u.id === approver.userProductionId);
            const approverData = {
              userId: approver.userProductionId,
              username: user?.username || user?.name || user?.email || 'Unknown',
              email: user?.email || undefined,
              priority: approver.priority,
            };

            if (approver.approverType === 'line') {
              newLineApprovers.push(approverData);
            } else if (approver.approverType === 'cost_center') {
              newCostCenterApprovers.push(approverData);
            }
          }

          combinedClearData.line_approvers = newLineApprovers.length > 0 ? newLineApprovers : Prisma.JsonNull;
          combinedClearData.cost_center_approvers = newCostCenterApprovers.length > 0 ? newCostCenterApprovers : Prisma.JsonNull;
        }
      }

      const updated = await ctx.db.pr_document_receipt.update({
        where: { pr_doc_num: input.prNo },
        data: combinedClearData,
      });

      const approvalTypeLabelMap: Record<string, string> = {
        requester: '(ผู้ขอซื้อ)',
        line: 'ตามสายงาน',
        cost_center: 'ตาม Cost Center',
        procurement: '(งานจัดซื้อพัสดุ)',
        vpc: '(VP-C)',
      };

      // สร้าง message บอกว่าลบขั้นไหนบ้าง
      const clearedStages = approvalOrder.slice(targetIndex);
      const clearedStageNames = clearedStages.map(s => approvalTypeLabelMap[s]).join(', ');

      // Audit log: Clear PR Approval
      createAuditLog(ctx.db, {
        userId: input.clearedByUserId,
        userName: input.clearedByName,
        action: "CLEAR_APPROVAL",
        tableName: "pr_document_receipt",
        recordId: String(input.prNo),
        prNo: input.prNo,
        oldValues: {
          clearedStages: clearedStages,
        },
        description: clearedStages.length > 1
          ? `ล้างการอนุมัติ PR #${input.prNo} แบบต่อเนื่อง: ${clearedStageNames}`
          : `ล้างการอนุมัติ PR #${input.prNo} ${approvalTypeLabelMap[input.approvalType]}`,
        metadata: {
          clearedByRole: input.clearedByRole,
        },
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      return {
        success: true,
        approvalType: input.approvalType,
        clearedStages: clearedStages,
        message: clearedStages.length > 1
          ? `ล้างการอนุมัติแบบต่อเนื่อง: ${clearedStageNames}`
          : `ล้างการอนุมัติ${approvalTypeLabelMap[input.approvalType]}แล้ว`,
        data: updated,
      };
    }),

  // 🔹 นับจำนวน PR ที่รอการอนุมัติของฉัน
  getMyPendingApprovalsCount: createTableProcedure('pr_approval', 'read')
    .input(z.object({
      userId: z.string(),
      userName: z.string().optional(),
      userRole: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // เช็ค permissions ของ user ก่อน
      const permissionChecks = await Promise.all([
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'line_approver', userId: input.userId, userRole: input.userRole || '' }),
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'cost_center', userId: input.userId, userRole: input.userRole || '' }),
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'manager', userId: input.userId, userRole: input.userRole || '' }),
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'final', userId: input.userId, userRole: input.userRole || '' }),
      ]);

      const hasLinePermission = permissionChecks[0]!.allowed;
      const hasCostCenterPermission = permissionChecks[1]!.allowed;
      const hasManagerPermission = permissionChecks[2]!.allowed;
      const hasFinalPermission = permissionChecks[3]!.allowed;

      // ดึง ocr_approver ของ user ปัจจุบัน (live data) เพื่อสร้าง lookup set
      const myOcrApprovers = await ctx.db.ocr_approver.findMany({
        where: { userProductionId: input.userId },
        select: { ocrCodeId: true, approverType: true },
      });

      const myLineOcrCodeIds = new Set(myOcrApprovers.filter(a => a.approverType === 'line').map(a => a.ocrCodeId));
      const myCcOcrCodeIds = new Set(myOcrApprovers.filter(a => a.approverType === 'cost_center').map(a => a.ocrCodeId));

      // Map ocr_code2 name → ocrCodeId
      const allOcrCodeIds = new Set([...myLineOcrCodeIds, ...myCcOcrCodeIds]);
      const ocrCodes = allOcrCodeIds.size > 0
        ? await ctx.db.ocr_code_and_name.findMany({
            where: { id: { in: [...allOcrCodeIds] } },
            select: { id: true, name: true },
          })
        : [];
      const ocrIdToName = new Map(ocrCodes.map(o => [o.id, o.name]));
      const myLineOcrNames = new Set([...myLineOcrCodeIds].map(id => ocrIdToName.get(id)).filter(Boolean));
      const myCcOcrNames = new Set([...myCcOcrCodeIds].map(id => ocrIdToName.get(id)).filter(Boolean));

      const allReceipts = await ctx.db.pr_document_receipt.findMany({
        select: {
          pr_doc_num: true,
          ocr_code2: true,
          requester_approval_at: true,
          line_approval_at: true,
          cost_center_approval_at: true,
          procurement_approval_at: true,
          vpc_approval_at: true,
        },
      });

      let count = 0;

      for (const receipt of allReceipts) {
        // ขั้น 2: ต้องมี permission + อยู่ใน ocr_approver (live)
        if (receipt.requester_approval_at && !receipt.line_approval_at) {
          if (hasLinePermission && receipt.ocr_code2 && myLineOcrNames.has(receipt.ocr_code2)) { count++; continue; }
        }

        // ขั้น 3: ต้องมี permission + อยู่ใน ocr_approver (live)
        if (receipt.line_approval_at && !receipt.cost_center_approval_at) {
          if (hasCostCenterPermission && receipt.ocr_code2 && myCcOcrNames.has(receipt.ocr_code2)) { count++; continue; }
        }

        // ขั้น 4: ต้องมี permission (ไม่ต้องเช็ค role แล้ว)
        if (receipt.cost_center_approval_at && !receipt.procurement_approval_at) {
          if (hasManagerPermission) { count++; continue; }
        }

        // ขั้น 5: ต้องมี permission (ไม่ต้องเช็ค role แล้ว)
        if (receipt.procurement_approval_at && !receipt.vpc_approval_at) {
          if (hasFinalPermission) { count++; continue; }
        }
      }

      return count;
    }),

  // 🔹 ดึงรายการ PR ที่รอการอนุมัติของฉัน (พร้อม job_name)
  getMyPendingApprovals: createTableProcedure('pr_approval', 'read')
    .input(z.object({
      userId: z.string(),
      userName: z.string().optional(),
      userRole: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // เช็ค permissions ของ user ก่อน
      const permissionChecks = await Promise.all([
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'line_approver', userId: input.userId, userRole: input.userRole || '' }),
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'cost_center', userId: input.userId, userRole: input.userRole || '' }),
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'manager', userId: input.userId, userRole: input.userRole || '' }),
        checkTablePermission(ctx.db, { tableName: 'pr_approve', action: 'final', userId: input.userId, userRole: input.userRole || '' }),
      ]);

      const hasLinePermission = permissionChecks[0]!.allowed;
      const hasCostCenterPermission = permissionChecks[1]!.allowed;
      const hasManagerPermission = permissionChecks[2]!.allowed;
      const hasFinalPermission = permissionChecks[3]!.allowed;

      // ดึง ocr_approver ของ user ปัจจุบัน (live data)
      const myOcrApprovers = await ctx.db.ocr_approver.findMany({
        where: { userProductionId: input.userId },
        select: { ocrCodeId: true, approverType: true },
      });

      const myLineOcrCodeIds = new Set(myOcrApprovers.filter(a => a.approverType === 'line').map(a => a.ocrCodeId));
      const myCcOcrCodeIds = new Set(myOcrApprovers.filter(a => a.approverType === 'cost_center').map(a => a.ocrCodeId));

      const allOcrCodeIds = new Set([...myLineOcrCodeIds, ...myCcOcrCodeIds]);
      const ocrCodes = allOcrCodeIds.size > 0
        ? await ctx.db.ocr_code_and_name.findMany({
            where: { id: { in: [...allOcrCodeIds] } },
            select: { id: true, name: true },
          })
        : [];
      const ocrIdToName = new Map(ocrCodes.map(o => [o.id, o.name]));
      const myLineOcrNames = new Set([...myLineOcrCodeIds].map(id => ocrIdToName.get(id)).filter(Boolean));
      const myCcOcrNames = new Set([...myCcOcrCodeIds].map(id => ocrIdToName.get(id)).filter(Boolean));

      const allReceipts = await ctx.db.pr_document_receipt.findMany({
        select: {
          pr_doc_num: true,
          ocr_code2: true,
          requester_approval_at: true,
          line_approval_at: true,
          cost_center_approval_at: true,
          procurement_approval_at: true,
          vpc_approval_at: true,
          created_at: true,
        },
      });

      const pendingApprovals: Array<{
        prNo: number;
        stage: string;
        stageName: string;
        createdAt: Date | null;
      }> = [];

      for (const receipt of allReceipts) {
        if (!receipt.requester_approval_at) continue;

        // ขั้น 2: ต้องมี permission + อยู่ใน ocr_approver (live)
        if (receipt.requester_approval_at && !receipt.line_approval_at) {
          if (hasLinePermission && receipt.ocr_code2 && myLineOcrNames.has(receipt.ocr_code2)) {
            pendingApprovals.push({
              prNo: receipt.pr_doc_num,
              stage: 'line',
              stageName: 'ผู้อนุมัติตามสายงาน',
              createdAt: receipt.created_at,
            });
            continue;
          }
        }

        // ขั้น 3: ต้องมี permission + อยู่ใน ocr_approver (live)
        if (receipt.line_approval_at && !receipt.cost_center_approval_at) {
          if (hasCostCenterPermission && receipt.ocr_code2 && myCcOcrNames.has(receipt.ocr_code2)) {
            pendingApprovals.push({
              prNo: receipt.pr_doc_num,
              stage: 'cost_center',
              stageName: 'ผู้อนุมัติตาม Cost Center',
              createdAt: receipt.created_at,
            });
            continue;
          }
        }

        // ขั้น 4: ต้องมี permission (ไม่ต้องเช็ค role แล้ว)
        if (receipt.cost_center_approval_at && !receipt.procurement_approval_at) {
          if (hasManagerPermission) {
            pendingApprovals.push({
              prNo: receipt.pr_doc_num,
              stage: 'procurement',
              stageName: 'งานจัดซื้อพัสดุ',
              createdAt: receipt.created_at,
            });
            continue;
          }
        }

        // ขั้น 5: ต้องมี permission (ไม่ต้องเช็ค role แล้ว)
        if (receipt.procurement_approval_at && !receipt.vpc_approval_at) {
          if (hasFinalPermission) {
            pendingApprovals.push({
              prNo: receipt.pr_doc_num,
              stage: 'vpc',
              stageName: 'VP-C',
              createdAt: receipt.created_at,
            });
            continue;
          }
        }
      }

      // Sort by createdAt DESC
      pendingApprovals.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Fetch job_name for each PR from pr_master
      const prNos = pendingApprovals.map(p => p.prNo);
      const prMasters = prNos.length > 0 ? await ctx.db.pr_master.findMany({
        where: { doc_num: { in: prNos } },
        select: { doc_num: true, job_name: true },
      }) : [];

      const jobNameMap = new Map(prMasters.map((h: { doc_num: number; job_name: string | null }) => [h.doc_num, h.job_name]));

      return pendingApprovals.map(p => ({
        ...p,
        jobName: jobNameMap.get(p.prNo) || null,
      }));
    }),

  // 🔹 ดึงข้อมูลการอนุมัติเอกสาร PR
  getDocumentApproval: createTableProcedure('pr_approval', 'read')
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const approval = await ctx.db.pr_document_approval.findUnique({
        where: { pr_doc_num: input.prNo },
      });
      return approval;
    }),

  // 🔹 บันทึกหรือแก้ไขการอนุมัติเอกสาร PR
  // Note: Uses authenticatedProcedure - internal logic handles role checks
  saveDocumentApproval: authenticatedProcedure
    .input(z.object({
      prNo: z.number(),
      approvalStatus: z.enum(['Approve', 'Reject', 'Waiting']),
      reason: z.string().optional(),
      approvedBy: z.string(),
      approvedByUserId: z.string().optional(),
      prJobName: z.string().optional(),
      prRequester: z.string().optional(),
      receiptDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const approvalDate = new Date(Date.UTC(bangkokNow.getFullYear(), bangkokNow.getMonth(), bangkokNow.getDate()));

      if (!input.receiptDate) {
        throw new Error('ต้องบันทึกวันที่รับเอกสารก่อนถึงจะอนุมัติได้');
      }

      const existing = await ctx.db.pr_document_approval.findUnique({
        where: { pr_doc_num: input.prNo },
      });

      let result;

      if (existing) {
        result = await ctx.db.pr_document_approval.update({
          where: { pr_doc_num: input.prNo },
          data: {
            approval_status: input.approvalStatus,
            reason: input.reason || null,
            approved_by: input.approvedBy,
            approved_by_user_id: input.approvedByUserId || null,
            approved_at: approvalDate,
            updated_at: now,
          },
        });
      } else {
        result = await ctx.db.pr_document_approval.create({
          data: {
            pr_doc_num: input.prNo,
            approval_status: input.approvalStatus,
            reason: input.reason || null,
            approved_by: input.approvedBy,
            approved_by_user_id: input.approvedByUserId || null,
            approved_at: approvalDate,
            created_at: now,
            updated_at: now,
          },
        });
      }

      // Audit log: Document Approval
      createAuditLog(ctx.db, {
        userId: input.approvedByUserId,
        userName: input.approvedBy,
        action: input.approvalStatus === 'Approve' ? "APPROVE_PR" :
               input.approvalStatus === 'Reject' ? "REJECT_PR" : AuditAction.UPDATE,
        tableName: "pr_document_approval",
        recordId: String(input.prNo),
        prNo: input.prNo,
        oldValues: existing ? {
          approvalStatus: existing.approval_status,
          reason: existing.reason,
        } : undefined,
        newValues: {
          approvalStatus: input.approvalStatus,
          reason: input.reason,
          approvedBy: input.approvedBy,
        },
        description: `${existing ? 'แก้ไข' : 'บันทึก'}การอนุมัติเอกสาร PR #${input.prNo}: ${
          input.approvalStatus === 'Approve' ? 'อนุมัติ' :
          input.approvalStatus === 'Reject' ? 'ปฏิเสธ' : 'รอดำเนินการ'
        }`,
        metadata: {
          prJobName: input.prJobName,
          prRequester: input.prRequester,
        },
        ipAddress: getIpFromContext(ctx),
      }).catch(console.error);

      // Send Telegram notification
      try {
        const statusText =
          input.approvalStatus === 'Approve' ? '✅ อนุมัติ' :
          input.approvalStatus === 'Reject' ? '❌ ปฏิเสธ' :
          '⏳ รอดำเนินการ';

        const messageParts = [
          `<b>🔔 การอนุมัติ PR #${input.prNo}</b>`,
          '',
        ];

        if (input.prJobName) messageParts.push(`🏗️ โครงการ: ${input.prJobName}`);
        if (input.prRequester) messageParts.push(`👤 ผู้ขอ PR: ${input.prRequester}`);

        messageParts.push('');
        messageParts.push(`<b>ผลการอนุมัติ:</b> ${statusText}`);

        if (input.reason) messageParts.push(`📝 เหตุผล: ${input.reason}`);

        messageParts.push(`👨‍💼 ผู้อนุมัติ: ${input.approvedBy}`);
        messageParts.push(`🕐 วันเวลา: ${now.toLocaleString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`);

        await sendCustomNotification(messageParts.join('\n'));
      } catch (telegramError) {
        console.error('[TELEGRAM] Failed to send approval notification:', telegramError);
      }

      return {
        success: true,
        action: existing ? 'updated' : 'created',
        data: result,
      };
    }),

  // 🔹 ดึง PR ที่รอการอนุมัติ
  getPendingApproval: createTableProcedure('pr_approval', 'read')
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
          AND (a.approval_status IS NULL OR a.approval_status = 'Waiting')
        ORDER BY r.receipt_date ASC, s.doc_num ASC
      `) as any[];

      return data;
    }),
});
