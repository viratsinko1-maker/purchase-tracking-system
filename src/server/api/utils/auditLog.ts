/**
 * Audit Log Helper (v2)
 * ใช้สำหรับบันทึกประวัติการใช้งานทุก Action ในระบบ
 * รองรับ 58 actions ตาม Permission System
 *
 * Pattern: Fire-and-forget (ไม่ block main operation)
 */

import type { PrismaClient, Prisma } from "@prisma/client";

/**
 * Action types for audit logging
 * ตรงกับ Permission keys ใน src/lib/permissions.ts
 */
export enum AuditAction {
  // ===============================
  // GENERIC CRUD (legacy support)
  // ===============================
  CREATE = "CREATE",
  READ = "READ",
  UPDATE = "UPDATE",
  DELETE = "DELETE",

  // ===============================
  // AUTH
  // ===============================
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  PASSWORD_RESET = "PASSWORD_RESET",

  // ===============================
  // PR TRACKING (8 actions)
  // ===============================
  PR_TRACKING_READ = "pr_tracking.read",
  PR_TRACKING_SEARCH = "pr_tracking.search",
  PR_TRACKING_SYNC = "pr_tracking.sync",
  PR_DETAIL_READ = "pr_detail.read",
  WO_DETAIL_READ = "wo_detail.read",
  PO_DETAIL_READ = "po_detail.read",
  RECEIVE_REPORT_READ = "receive_report.read",
  PR_PRINT = "pr_print.execute",

  // ===============================
  // PR Q&A (5 actions)
  // ===============================
  PR_QA_READ = "pr_qa.read",
  PR_QA_CREATE = "pr_qa.create",
  PR_QA_RESPOND = "pr_qa.respond",
  PR_QA_UPDATE = "pr_qa.update",
  PR_QA_DELETE = "pr_qa.delete",

  // ===============================
  // PR APPROVAL (8 actions)
  // ===============================
  PR_APPROVAL_READ = "pr_approval.read",
  PR_APPROVE_REQUESTER = "pr_approve.requester",
  PR_APPROVE_LINE = "pr_approve.line_approver",
  PR_APPROVE_COST_CENTER = "pr_approve.cost_center",
  PR_APPROVE_MANAGER = "pr_approve.manager",
  PR_APPROVE_FINAL = "pr_approve.final",
  PR_REJECT = "pr_reject.execute",
  PR_APPROVE_CLEAR = "pr_approve.clear",

  // ===============================
  // RECEIVE GOOD (6 actions)
  // ===============================
  RECEIVE_GOOD_READ = "receive_good.read",
  RECEIVE_GOOD_CREATE = "receive_good.create",
  RECEIVE_ATTACHMENT_CREATE = "receive_attachment.create",
  RECEIVE_CONFIRM = "receive_confirm.execute",
  RECEIVE_GOOD_UPDATE = "receive_good.update",
  RECEIVE_GOOD_DELETE = "receive_good.delete",

  // ===============================
  // PO TRACKING (4 actions)
  // ===============================
  PO_TRACKING_READ = "po_tracking.read",
  PO_TRACKING_SEARCH = "po_tracking.search",
  PO_TRACKING_SYNC = "po_tracking.sync",
  PO_DELIVERY_CREATE = "po_delivery.create",

  // ===============================
  // ADMIN - USERS (5 actions)
  // ===============================
  ADMIN_USERS_READ = "admin_users.read",
  ADMIN_USERS_CREATE = "admin_users.create",
  ADMIN_USERS_UPDATE = "admin_users.update",
  ADMIN_USERS_DELETE = "admin_users.delete",
  ADMIN_USERS_SYNC = "admin_users.sync",

  // ===============================
  // ADMIN - ROLES (5 actions)
  // ===============================
  ADMIN_ROLES_READ = "admin_roles.read",
  ADMIN_ROLES_CREATE = "admin_roles.create",
  ADMIN_ROLES_UPDATE = "admin_roles.update",
  ADMIN_ROLES_DELETE = "admin_roles.delete",
  ADMIN_ROLES_SEED = "admin_roles.seed",

  // ===============================
  // ADMIN - PERMISSIONS (2 actions)
  // ===============================
  ADMIN_PERMISSIONS_READ = "admin_permissions.read",
  ADMIN_PERMISSIONS_UPDATE = "admin_permissions.update",

  // ===============================
  // ADMIN - AUDIT (2 actions)
  // ===============================
  ADMIN_AUDIT_READ = "admin_audit.read",
  ADMIN_AUDIT_FILTER = "admin_audit.filter",

  // ===============================
  // ADMIN - SYNC (6 actions)
  // ===============================
  ADMIN_SYNC_PR_READ = "admin_sync_pr.read",
  ADMIN_SYNC_PO_READ = "admin_sync_po.read",
  ADMIN_SYNC_USER_READ = "admin_sync_user.read",
  ADMIN_SYNC_ATTACH_READ = "admin_sync_attach.read",
  ADMIN_SYNC_EXECUTE = "admin_sync.execute",
  ADMIN_SYNC_REFRESH = "admin_sync.refresh",

  // ===============================
  // ADMIN - WORKFLOW (5 actions)
  // ===============================
  ADMIN_WORKFLOW_READ = "admin_workflow.read",
  ADMIN_WORKFLOW_SYNC = "admin_workflow.sync",
  ADMIN_OCR_MEMBER_UPDATE = "admin_ocr_member.update",
  ADMIN_APPROVER_LINE_UPDATE = "admin_approver_line.update",
  ADMIN_APPROVER_CC_UPDATE = "admin_approver_cc.update",

  // ===============================
  // LEGACY (for backward compatibility)
  // ===============================
  TRACK_PR = "TRACK_PR",
  RESPONSE_PR = "RESPONSE_PR",
  TRACK_DELIVERY = "TRACK_DELIVERY",
  SYNC_DATA = "SYNC_DATA",
  VIEW_PR = "VIEW_PR",
  VIEW_PO = "VIEW_PO",
}

/**
 * Action Labels in Thai - ครอบคลุมทุก action
 */
export const ACTION_LABELS: Record<string, string> = {
  // Generic CRUD
  CREATE: "สร้าง",
  READ: "ดู",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",

  // Auth
  LOGIN: "เข้าสู่ระบบ",
  LOGOUT: "ออกจากระบบ",
  PASSWORD_CHANGE: "เปลี่ยนรหัสผ่าน",
  PASSWORD_RESET: "รีเซ็ตรหัสผ่าน",

  // PR Tracking
  "pr_tracking.read": "ดูหน้าติดตาม PR",
  "pr_tracking.search": "ค้นหา PR",
  "pr_tracking.sync": "ซิงค์ PR",
  "pr_detail.read": "ดูรายละเอียด PR",
  "wo_detail.read": "ดูใบสั่งงาน",
  "po_detail.read": "ดูใบสั่งซื้อ",
  "receive_report.read": "ดูรายงานรับของ",
  "pr_print.execute": "พิมพ์ PR",

  // PR Q&A
  "pr_qa.read": "ดูคำถาม-คำตอบ",
  "pr_qa.create": "ถามคำถามใหม่",
  "pr_qa.respond": "ตอบคำถาม",
  "pr_qa.update": "แก้ไขคำถาม/คำตอบ",
  "pr_qa.delete": "ลบคำถาม/คำตอบ",

  // PR Approval
  "pr_approval.read": "ดูหน้าอนุมัติ",
  "pr_approve.requester": "ผู้ขอซื้อยืนยัน (ขั้น 1)",
  "pr_approve.line_approver": "อนุมัติตามสายงาน (ขั้น 2)",
  "pr_approve.cost_center": "อนุมัติตาม Cost Center (ขั้น 3)",
  "pr_approve.manager": "งานจัดซื้อพัสดุอนุมัติ (ขั้น 4)",
  "pr_approve.final": "VP-C อนุมัติ (ขั้น 5)",
  "pr_reject.execute": "ปฏิเสธ PR",
  "pr_approve.clear": "ล้างการอนุมัติ",

  // Receive Good
  "receive_good.read": "ดูรายการรับของ",
  "receive_good.create": "บันทึกรับของ",
  "receive_attachment.create": "แนบเอกสาร/รูป",
  "receive_confirm.execute": "ยืนยันรับของ",
  "receive_good.update": "แก้ไขรับของ",
  "receive_good.delete": "ลบรายการรับของ",

  // PO Tracking
  "po_tracking.read": "ดูหน้าติดตาม PO",
  "po_tracking.search": "ค้นหา PO",
  "po_tracking.sync": "ซิงค์ PO",
  "po_delivery.create": "บันทึกติดตามส่งของ",

  // Admin Users
  "admin_users.read": "ดูรายชื่อผู้ใช้",
  "admin_users.create": "เพิ่มผู้ใช้",
  "admin_users.update": "แก้ไขผู้ใช้",
  "admin_users.delete": "ลบผู้ใช้",
  "admin_users.sync": "ซิงค์ผู้ใช้",

  // Admin Roles
  "admin_roles.read": "ดู Role",
  "admin_roles.create": "เพิ่ม Role",
  "admin_roles.update": "แก้ไข Role",
  "admin_roles.delete": "ลบ Role",
  "admin_roles.seed": "สร้าง Role เริ่มต้น",

  // Admin Permissions
  "admin_permissions.read": "ดูการตั้งค่าสิทธิ์",
  "admin_permissions.update": "แก้ไขสิทธิ์",

  // Admin Audit
  "admin_audit.read": "ดูประวัติการใช้งาน",
  "admin_audit.filter": "กรอง Audit",

  // Admin Sync
  "admin_sync_pr.read": "ดูประวัติซิงค์ PR",
  "admin_sync_po.read": "ดูประวัติซิงค์ PO",
  "admin_sync_user.read": "ดูประวัติซิงค์ผู้ใช้",
  "admin_sync_attach.read": "ดูประวัติซิงค์ไฟล์",
  "admin_sync.execute": "เรียกซิงค์ด้วยมือ",
  "admin_sync.refresh": "รีเฟรช PR ทั้งหมด",

  // Admin Workflow
  "admin_workflow.read": "ดูรายการแผนก",
  "admin_workflow.sync": "ซิงค์แผนก",
  "admin_ocr_member.update": "จัดการสมาชิกแผนก",
  "admin_approver_line.update": "ตั้งค่าผู้อนุมัติสายงาน",
  "admin_approver_cc.update": "ตั้งค่าผู้อนุมัติ CC",

  // Legacy
  TRACK_PR: "ติดตาม PR",
  RESPONSE_PR: "ตอบกลับ PR",
  TRACK_DELIVERY: "ติดตามการส่ง",
  SYNC_DATA: "Sync ข้อมูล",
  VIEW_PR: "ดู PR",
  VIEW_PO: "ดู PO",
};

/**
 * Action Colors - สีตามประเภท action
 */
export const ACTION_COLORS: Record<string, string> = {
  // Auth - Emerald/Slate
  LOGIN: "bg-emerald-100 text-emerald-800",
  LOGOUT: "bg-slate-100 text-slate-800",
  PASSWORD_CHANGE: "bg-amber-100 text-amber-800",
  PASSWORD_RESET: "bg-amber-100 text-amber-800",

  // Generic CRUD
  CREATE: "bg-green-100 text-green-800",
  READ: "bg-gray-100 text-gray-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",

  // PR Tracking - Purple
  "pr_tracking.read": "bg-purple-100 text-purple-800",
  "pr_tracking.search": "bg-purple-100 text-purple-800",
  "pr_tracking.sync": "bg-indigo-100 text-indigo-800",
  "pr_detail.read": "bg-purple-100 text-purple-800",
  "wo_detail.read": "bg-purple-100 text-purple-800",
  "po_detail.read": "bg-cyan-100 text-cyan-800",
  "receive_report.read": "bg-teal-100 text-teal-800",
  "pr_print.execute": "bg-violet-100 text-violet-800",

  // PR Q&A - Yellow/Orange
  "pr_qa.read": "bg-yellow-100 text-yellow-800",
  "pr_qa.create": "bg-orange-100 text-orange-800",
  "pr_qa.respond": "bg-amber-100 text-amber-800",
  "pr_qa.update": "bg-yellow-100 text-yellow-800",
  "pr_qa.delete": "bg-red-100 text-red-800",

  // PR Approval - Green gradient
  "pr_approval.read": "bg-lime-100 text-lime-800",
  "pr_approve.requester": "bg-green-100 text-green-800",
  "pr_approve.line_approver": "bg-emerald-100 text-emerald-800",
  "pr_approve.cost_center": "bg-teal-100 text-teal-800",
  "pr_approve.manager": "bg-cyan-100 text-cyan-800",
  "pr_approve.final": "bg-sky-100 text-sky-800",
  "pr_reject.execute": "bg-red-100 text-red-800",
  "pr_approve.clear": "bg-rose-100 text-rose-800",

  // Receive Good - Teal
  "receive_good.read": "bg-teal-100 text-teal-800",
  "receive_good.create": "bg-green-100 text-green-800",
  "receive_attachment.create": "bg-blue-100 text-blue-800",
  "receive_confirm.execute": "bg-emerald-100 text-emerald-800",
  "receive_good.update": "bg-blue-100 text-blue-800",
  "receive_good.delete": "bg-red-100 text-red-800",

  // PO Tracking - Cyan
  "po_tracking.read": "bg-cyan-100 text-cyan-800",
  "po_tracking.search": "bg-cyan-100 text-cyan-800",
  "po_tracking.sync": "bg-indigo-100 text-indigo-800",
  "po_delivery.create": "bg-green-100 text-green-800",

  // Admin - Indigo/Blue
  "admin_users.read": "bg-indigo-100 text-indigo-800",
  "admin_users.create": "bg-green-100 text-green-800",
  "admin_users.update": "bg-blue-100 text-blue-800",
  "admin_users.delete": "bg-red-100 text-red-800",
  "admin_users.sync": "bg-indigo-100 text-indigo-800",
  "admin_roles.read": "bg-indigo-100 text-indigo-800",
  "admin_roles.create": "bg-green-100 text-green-800",
  "admin_roles.update": "bg-blue-100 text-blue-800",
  "admin_roles.delete": "bg-red-100 text-red-800",
  "admin_roles.seed": "bg-violet-100 text-violet-800",
  "admin_permissions.read": "bg-indigo-100 text-indigo-800",
  "admin_permissions.update": "bg-blue-100 text-blue-800",
  "admin_audit.read": "bg-slate-100 text-slate-800",
  "admin_audit.filter": "bg-slate-100 text-slate-800",
  "admin_sync_pr.read": "bg-indigo-100 text-indigo-800",
  "admin_sync_po.read": "bg-indigo-100 text-indigo-800",
  "admin_sync_user.read": "bg-indigo-100 text-indigo-800",
  "admin_sync_attach.read": "bg-indigo-100 text-indigo-800",
  "admin_sync.execute": "bg-violet-100 text-violet-800",
  "admin_sync.refresh": "bg-rose-100 text-rose-800",
  "admin_workflow.read": "bg-indigo-100 text-indigo-800",
  "admin_workflow.sync": "bg-indigo-100 text-indigo-800",
  "admin_ocr_member.update": "bg-blue-100 text-blue-800",
  "admin_approver_line.update": "bg-blue-100 text-blue-800",
  "admin_approver_cc.update": "bg-blue-100 text-blue-800",

  // Legacy
  TRACK_PR: "bg-purple-100 text-purple-800",
  RESPONSE_PR: "bg-yellow-100 text-yellow-800",
  TRACK_DELIVERY: "bg-purple-100 text-purple-800",
  SYNC_DATA: "bg-indigo-100 text-indigo-800",
  VIEW_PR: "bg-blue-100 text-blue-800",
  VIEW_PO: "bg-blue-100 text-blue-800",
};

/**
 * Data structure for creating audit logs
 */
export interface AuditLogData {
  userId?: string;
  userName?: string;
  action: AuditAction | string;
  tableName?: string;
  recordId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
  prNo?: number;
  poNo?: number;
  trackingId?: number;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  computerName?: string;
}

/**
 * Create an audit log entry
 * Uses fire-and-forget pattern - errors are logged but don't throw
 */
export async function createAuditLog(
  db: PrismaClient,
  data: AuditLogData
): Promise<void> {
  try {
    await db.activity_trail.create({
      data: {
        user_id: data.userId ?? null,
        user_name: data.userName ?? null,
        action: data.action,
        table_name: data.tableName ?? null,
        record_id: data.recordId ?? null,
        old_values: data.oldValues as Prisma.InputJsonValue | undefined,
        new_values: data.newValues as Prisma.InputJsonValue | undefined,
        description: data.description ?? null,
        pr_no: data.prNo ?? null,
        po_no: data.poNo ?? null,
        tracking_id: data.trackingId ?? null,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
        ip_address: data.ipAddress ?? null,
        computer_name: data.computerName ?? null,
      },
    });
  } catch (error) {
    console.error("[AUDIT-LOG] Failed to create audit log:", error);
  }
}

/**
 * Helper to get action label in Thai
 */
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

/**
 * Helper to get action color class for UI
 */
export function getActionColorClass(action: string): string {
  return ACTION_COLORS[action] || "bg-gray-100 text-gray-800";
}

/**
 * Helper to extract IP address from request
 */
export function getIpFromRequest(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | undefined {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip?.trim();
  }
  return req.socket?.remoteAddress;
}

/**
 * Quick helper for common audit scenarios
 */
export const auditHelpers = {
  /** Log user login */
  login: (db: PrismaClient, userId: string, userName: string, ip?: string) =>
    createAuditLog(db, {
      userId,
      userName,
      action: AuditAction.LOGIN,
      description: `${userName} เข้าสู่ระบบ`,
      ipAddress: ip,
    }),

  /** Log user logout */
  logout: (db: PrismaClient, userId: string, userName: string, ip?: string) =>
    createAuditLog(db, {
      userId,
      userName,
      action: AuditAction.LOGOUT,
      description: `${userName} ออกจากระบบ`,
      ipAddress: ip,
    }),

  /** Log PR approval */
  prApprove: (db: PrismaClient, userId: string, userName: string, prNo: number, approvalType: string) =>
    createAuditLog(db, {
      userId,
      userName,
      action: `pr_approve.${approvalType}` as AuditAction,
      tableName: "pr_document_approval",
      recordId: String(prNo),
      prNo,
      description: `${userName} อนุมัติ PR #${prNo} (${approvalType})`,
    }),

  /** Log receive good confirm */
  receiveConfirm: (db: PrismaClient, userId: string, userName: string, prNo: number, confirmCount: number) =>
    createAuditLog(db, {
      userId,
      userName,
      action: AuditAction.RECEIVE_CONFIRM,
      tableName: "receive_good_confirmation",
      recordId: String(prNo),
      prNo,
      description: `${userName} ยืนยันรับของ PR #${prNo} (${confirmCount} รายการ)`,
    }),
};
