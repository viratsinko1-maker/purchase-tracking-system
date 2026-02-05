/**
 * Permission System - Types and Constants
 * ระบบจัดการสิทธิ์แบบ Database-Driven (58 Actions)
 */

// =====================================================
// TYPES
// =====================================================

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'search' | 'sync' | 'respond' | 'clear' | 'requester' | 'line_approver' | 'cost_center' | 'manager' | 'final' | 'refresh';

export interface PermissionCheck {
  tableName: string;
  action: PermissionAction;
  userId: string;
  userRole: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason: 'admin_bypass' | 'role_permission' | 'user_override' | 'denied';
}

export interface TablePermissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

// =====================================================
// CONSTANTS - ADMIN ROLES (bypass all checks)
// =====================================================

/**
 * Roles ที่ได้สิทธิ์ทุกอย่างโดยอัตโนมัติ
 */
export const ADMIN_ROLES = ['Admin'] as const;

/**
 * Roles ที่ได้สิทธิ์ระดับ approval (มีสิทธิ์มากกว่า user ทั่วไป)
 */
export const ELEVATED_ROLES = ['Admin', 'Approval'] as const;

// =====================================================
// PROTECTED TABLES - Registry ของ Tables/Actions ทั้งหมด (58 items)
// =====================================================

export type PermissionCategory = 'pr_tracking' | 'pr_qa' | 'pr_approval' | 'receive_good' | 'po_tracking' | 'w_series' | 'my_kpi' | 'admin_users' | 'admin_roles' | 'admin_permissions' | 'admin_audit' | 'admin_sync' | 'admin_workflow' | 'admin_kpi';

export interface TableMetadata {
  friendlyName: string;      // ชื่อภาษาไทย
  category: PermissionCategory;
  description?: string;      // คำอธิบาย
  displayOrder?: number;     // ลำดับการแสดง
}

/**
 * รายการ Actions ทั้งหมดที่ต้องมี permission control (58 items)
 * key = tableName.action format
 */
export const PROTECTED_TABLES: Record<string, TableMetadata> = {
  // =====================================================
  // 1. PR TRACKING PAGE (8 items)
  // =====================================================
  'pr_tracking.read': {
    friendlyName: 'ดูหน้าติดตาม PR',
    category: 'pr_tracking',
    description: 'เข้าถึงหน้า PR Tracking',
    displayOrder: 1,
  },
  'pr_tracking.search': {
    friendlyName: 'ค้นหา PR',
    category: 'pr_tracking',
    description: 'ใช้ตัวกรองค้นหา PR',
    displayOrder: 2,
  },
  'pr_tracking.sync': {
    friendlyName: 'ซิงค์ PR',
    category: 'pr_tracking',
    description: 'ดึงข้อมูล PR ใหม่จาก SAP',
    displayOrder: 3,
  },
  'pr_detail.read': {
    friendlyName: 'ดูรายละเอียด PR',
    category: 'pr_tracking',
    description: 'เปิด popup ดูรายละเอียด PR',
    displayOrder: 4,
  },
  'wo_detail.read': {
    friendlyName: 'ดูใบสั่งงาน',
    category: 'pr_tracking',
    description: 'เปิด popup ดู Work Order',
    displayOrder: 5,
  },
  'po_detail.read': {
    friendlyName: 'ดูใบสั่งซื้อ',
    category: 'pr_tracking',
    description: 'เปิด popup ดู PO',
    displayOrder: 6,
  },
  'receive_report.read': {
    friendlyName: 'ดูรายงานรับของ',
    category: 'pr_tracking',
    description: 'เปิด popup ดูสถานะรับของ',
    displayOrder: 7,
  },
  'pr_print.execute': {
    friendlyName: 'พิมพ์ PR',
    category: 'pr_tracking',
    description: 'พิมพ์เอกสาร PR',
    displayOrder: 8,
  },

  // =====================================================
  // 2. PR Q&A (5 items)
  // =====================================================
  'pr_qa.read': {
    friendlyName: 'ดูคำถาม-คำตอบ',
    category: 'pr_qa',
    description: 'เข้าถึงหน้า Q&A',
    displayOrder: 1,
  },
  'pr_qa.create': {
    friendlyName: 'ถามคำถามใหม่',
    category: 'pr_qa',
    description: 'สร้างคำถามการติดตาม',
    displayOrder: 2,
  },
  'pr_qa.respond': {
    friendlyName: 'ตอบคำถาม',
    category: 'pr_qa',
    description: 'ตอบคำถามที่มีอยู่',
    displayOrder: 3,
  },
  'pr_qa.update': {
    friendlyName: 'แก้ไขคำถาม/คำตอบ',
    category: 'pr_qa',
    description: 'แก้ไขข้อความ Q&A',
    displayOrder: 4,
  },
  'pr_qa.delete': {
    friendlyName: 'ลบคำถาม/คำตอบ',
    category: 'pr_qa',
    description: 'ลบข้อความ Q&A',
    displayOrder: 5,
  },

  // =====================================================
  // 3. PR APPROVAL - 5 ขั้นตอน (8 items)
  // =====================================================
  'pr_approval.read': {
    friendlyName: 'ดูหน้าอนุมัติ',
    category: 'pr_approval',
    description: 'เข้าถึงหน้าอนุมัติ PR',
    displayOrder: 1,
  },
  'pr_approve.requester': {
    friendlyName: 'ผู้ขอซื้อยืนยัน (ขั้น 1)',
    category: 'pr_approval',
    description: 'ผู้เปิด PR กดยืนยัน',
    displayOrder: 2,
  },
  'pr_approve.line_approver': {
    friendlyName: 'อนุมัติตามสายงาน (ขั้น 2)',
    category: 'pr_approval',
    description: 'ผู้อนุมัติตาม Line อนุมัติ',
    displayOrder: 3,
  },
  'pr_approve.cost_center': {
    friendlyName: 'อนุมัติตาม Cost Center (ขั้น 3)',
    category: 'pr_approval',
    description: 'ผู้อนุมัติตาม Cost Center อนุมัติ',
    displayOrder: 4,
  },
  'pr_approve.manager': {
    friendlyName: 'งานจัดซื้อพัสดุอนุมัติ (ขั้น 4)',
    category: 'pr_approval',
    description: 'Manager อนุมัติ',
    displayOrder: 5,
  },
  'pr_approve.final': {
    friendlyName: 'VP-C อนุมัติ (ขั้น 5)',
    category: 'pr_approval',
    description: 'Approval role อนุมัติขั้นสุดท้าย',
    displayOrder: 6,
  },
  'pr_reject.execute': {
    friendlyName: 'ปฏิเสธ PR',
    category: 'pr_approval',
    description: 'ปฏิเสธการอนุมัติ',
    displayOrder: 7,
  },
  'pr_approve.clear': {
    friendlyName: 'ล้างการอนุมัติ',
    category: 'pr_approval',
    description: 'Admin ล้าง approval',
    displayOrder: 8,
  },

  // =====================================================
  // 4. RECEIVE GOOD (7 items)
  // =====================================================
  'receive_good.read': {
    friendlyName: 'ดูรายการรับของ',
    category: 'receive_good',
    description: 'เข้าถึงหน้ารับของ',
    displayOrder: 1,
  },
  'receive_good.create': {
    friendlyName: 'บันทึกรับของ',
    category: 'receive_good',
    description: 'สร้างรายการรับของใหม่',
    displayOrder: 2,
  },
  'receive_attachment.create': {
    friendlyName: 'แนบเอกสาร/รูป',
    category: 'receive_good',
    description: 'อัพโหลดเอกสาร/รูปภาพ',
    displayOrder: 3,
  },
  'receive_confirm.execute': {
    friendlyName: 'ยืนยันรับของ',
    category: 'receive_good',
    description: 'กดยืนยันรายการรับ (Confirm batch)',
    displayOrder: 4,
  },
  'receive_good.update': {
    friendlyName: 'แก้ไขรับของ',
    category: 'receive_good',
    description: 'แก้ไขข้อมูลการรับ',
    displayOrder: 5,
  },
  'receive_good.delete': {
    friendlyName: 'ลบรายการรับของ',
    category: 'receive_good',
    description: 'ลบรายการ (Admin only)',
    displayOrder: 6,
  },
  'receive_good.report': {
    friendlyName: 'ดูรายงานรับของ',
    category: 'receive_good',
    description: 'ดูรายงานสรุปการรับของ',
    displayOrder: 7,
  },

  // =====================================================
  // 5. PO TRACKING (5 items)
  // =====================================================
  'po_tracking.read': {
    friendlyName: 'ดูหน้าติดตาม PO',
    category: 'po_tracking',
    description: 'เข้าถึงหน้า PO Tracking',
    displayOrder: 1,
  },
  'po_tracking.search': {
    friendlyName: 'ค้นหา PO',
    category: 'po_tracking',
    description: 'ใช้ตัวกรองค้นหา PO',
    displayOrder: 2,
  },
  'po_tracking.sync': {
    friendlyName: 'ซิงค์ PO',
    category: 'po_tracking',
    description: 'ดึงข้อมูล PO ใหม่จาก SAP',
    displayOrder: 3,
  },
  // Note: po_detail.read อยู่ใน pr_tracking category แล้ว (ใช้ร่วมกัน)
  'po_delivery.create': {
    friendlyName: 'บันทึกติดตามส่งของ',
    category: 'po_tracking',
    description: 'บันทึกการติดตามการจัดส่ง',
    displayOrder: 4,
  },

  // =====================================================
  // 6. W SERIES - Work Order Management (4 items)
  // =====================================================
  'w_series_wr.read': {
    friendlyName: 'ดูหน้า WR',
    category: 'w_series',
    description: 'เข้าถึงหน้า Work Request',
    displayOrder: 1,
  },
  'w_series_wo.read': {
    friendlyName: 'ดูหน้า WO',
    category: 'w_series',
    description: 'เข้าถึงหน้า Work Order',
    displayOrder: 2,
  },
  'w_series_wa.read': {
    friendlyName: 'ดูหน้า WA',
    category: 'w_series',
    description: 'เข้าถึงหน้า Work Approval',
    displayOrder: 3,
  },
  'w_series_wc.read': {
    friendlyName: 'ดูหน้า WC',
    category: 'w_series',
    description: 'เข้าถึงหน้า Work Complete',
    displayOrder: 4,
  },

  // =====================================================
  // 7. MY KPI - KPI ส่วนตัว (1 item)
  // =====================================================
  'my_kpi.read': {
    friendlyName: 'ดู KPI ของฉัน',
    category: 'my_kpi',
    description: 'เข้าถึงหน้า KPI ส่วนตัว',
    displayOrder: 1,
  },

  // =====================================================
  // 8. ADMIN - จัดการผู้ใช้ (5 items)
  // =====================================================
  'admin_users.read': {
    friendlyName: 'ดูรายชื่อผู้ใช้',
    category: 'admin_users',
    description: 'เข้าหน้าจัดการผู้ใช้',
    displayOrder: 1,
  },
  'admin_users.create': {
    friendlyName: 'เพิ่มผู้ใช้',
    category: 'admin_users',
    description: 'สร้าง user ใหม่',
    displayOrder: 2,
  },
  'admin_users.update': {
    friendlyName: 'แก้ไขผู้ใช้',
    category: 'admin_users',
    description: 'แก้ไขข้อมูล user',
    displayOrder: 3,
  },
  'admin_users.delete': {
    friendlyName: 'ลบผู้ใช้',
    category: 'admin_users',
    description: 'ลบ user',
    displayOrder: 4,
  },
  'admin_users.sync': {
    friendlyName: 'ซิงค์ผู้ใช้',
    category: 'admin_users',
    description: 'ดึง user จาก TMK Production',
    displayOrder: 5,
  },

  // =====================================================
  // 7. ADMIN - จัดการ Role (5 items)
  // =====================================================
  'admin_roles.read': {
    friendlyName: 'ดู Role',
    category: 'admin_roles',
    description: 'เข้าหน้าจัดการ Role',
    displayOrder: 1,
  },
  'admin_roles.create': {
    friendlyName: 'เพิ่ม Role',
    category: 'admin_roles',
    description: 'สร้าง Role ใหม่',
    displayOrder: 2,
  },
  'admin_roles.update': {
    friendlyName: 'แก้ไข Role',
    category: 'admin_roles',
    description: 'แก้ไข Role',
    displayOrder: 3,
  },
  'admin_roles.delete': {
    friendlyName: 'ลบ Role',
    category: 'admin_roles',
    description: 'ลบ Role',
    displayOrder: 4,
  },
  'admin_roles.seed': {
    friendlyName: 'สร้าง Role เริ่มต้น',
    category: 'admin_roles',
    description: 'seed Role default',
    displayOrder: 5,
  },

  // =====================================================
  // 8. ADMIN - จัดการสิทธิ์ (2 items)
  // =====================================================
  'admin_permissions.read': {
    friendlyName: 'ดูการตั้งค่าสิทธิ์',
    category: 'admin_permissions',
    description: 'เข้าหน้าจัดการสิทธิ์',
    displayOrder: 1,
  },
  'admin_permissions.update': {
    friendlyName: 'แก้ไขสิทธิ์',
    category: 'admin_permissions',
    description: 'เปลี่ยนสิทธิ์ของ Role',
    displayOrder: 2,
  },

  // =====================================================
  // 9. ADMIN - Audit Trail (2 items)
  // =====================================================
  'admin_audit.read': {
    friendlyName: 'ดูประวัติการใช้งาน',
    category: 'admin_audit',
    description: 'ดู log การใช้งาน',
    displayOrder: 1,
  },
  'admin_audit.filter': {
    friendlyName: 'กรอง Audit',
    category: 'admin_audit',
    description: 'กรองตาม user/action/date',
    displayOrder: 2,
  },

  // =====================================================
  // 10. ADMIN - Sync History (6 items)
  // =====================================================
  'admin_sync_pr.read': {
    friendlyName: 'ดูประวัติซิงค์ PR',
    category: 'admin_sync',
    description: 'ดู PR sync history',
    displayOrder: 1,
  },
  'admin_sync_po.read': {
    friendlyName: 'ดูประวัติซิงค์ PO',
    category: 'admin_sync',
    description: 'ดู PO sync history',
    displayOrder: 2,
  },
  'admin_sync_user.read': {
    friendlyName: 'ดูประวัติซิงค์ผู้ใช้',
    category: 'admin_sync',
    description: 'ดู user sync history',
    displayOrder: 3,
  },
  'admin_sync_attach.read': {
    friendlyName: 'ดูประวัติซิงค์ไฟล์',
    category: 'admin_sync',
    description: 'ดู attachment sync',
    displayOrder: 4,
  },
  'admin_sync.execute': {
    friendlyName: 'เรียกซิงค์ด้วยมือ',
    category: 'admin_sync',
    description: 'trigger sync ด้วยตนเอง',
    displayOrder: 5,
  },
  'admin_sync.refresh': {
    friendlyName: 'รีเฟรช PR ทั้งหมด',
    category: 'admin_sync',
    description: 'TRUNCATE & resync (อันตราย)',
    displayOrder: 6,
  },

  // =====================================================
  // 11. ADMIN - Workflow (5 items)
  // =====================================================
  'admin_workflow.read': {
    friendlyName: 'ดูรายการแผนก',
    category: 'admin_workflow',
    description: 'ดูรายการ OCR Code/แผนก',
    displayOrder: 1,
  },
  'admin_workflow.sync': {
    friendlyName: 'ซิงค์แผนก',
    category: 'admin_workflow',
    description: 'ดึงแผนกใหม่จาก SAP',
    displayOrder: 2,
  },
  'admin_ocr_member.update': {
    friendlyName: 'จัดการสมาชิกแผนก',
    category: 'admin_workflow',
    description: 'เพิ่ม/ลบสมาชิกในแผนก',
    displayOrder: 3,
  },
  'admin_approver_line.update': {
    friendlyName: 'ตั้งค่าผู้อนุมัติสายงาน',
    category: 'admin_workflow',
    description: 'ตั้งค่า line approver',
    displayOrder: 4,
  },
  'admin_approver_cc.update': {
    friendlyName: 'ตั้งค่าผู้อนุมัติ CC',
    category: 'admin_workflow',
    description: 'ตั้งค่า cost center approver',
    displayOrder: 5,
  },

  // =====================================================
  // 14. ADMIN - KPI Dashboard (3 items)
  // =====================================================
  'admin_kpi.read': {
    friendlyName: 'ดู KPI Dashboard',
    category: 'admin_kpi',
    description: 'เข้าถึงหน้า KPI Dashboard',
    displayOrder: 1,
  },
  'admin_kpi.update': {
    friendlyName: 'จัดการ SLA Config',
    category: 'admin_kpi',
    description: 'ตั้งค่า SLA target',
    displayOrder: 2,
  },
  'admin_kpi.delete': {
    friendlyName: 'ลบ SLA Config',
    category: 'admin_kpi',
    description: 'ลบการตั้งค่า SLA',
    displayOrder: 3,
  },

} as const;

// =====================================================
// CATEGORY LABELS
// =====================================================

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  'pr_tracking': 'หน้าติดตาม PR',
  'pr_qa': 'ระบบถาม-ตอบ (Q&A)',
  'pr_approval': 'ระบบอนุมัติ PR (5 ขั้น)',
  'receive_good': 'ระบบรับของ',
  'po_tracking': 'หน้าติดตาม PO',
  'w_series': 'W Series (Work Order)',
  'my_kpi': 'KPI ส่วนตัว',
  'admin_users': 'จัดการผู้ใช้',
  'admin_roles': 'จัดการ Role',
  'admin_permissions': 'จัดการสิทธิ์',
  'admin_audit': 'Audit Trail',
  'admin_sync': 'ประวัติ Sync',
  'admin_workflow': 'Workflow/แผนก',
  'admin_kpi': 'KPI Dashboard (Admin)',
};

// =====================================================
// PAGE PERMISSIONS - Mapping URL Path to Table/Action
// =====================================================

export interface PagePermission {
  table: string;
  action: PermissionAction;
}

/**
 * Mapping จาก URL path → permission ที่ต้อง check
 */
export const PAGE_PERMISSIONS: Record<string, PagePermission> = {
  '/pr-tracking': { table: 'pr_tracking', action: 'read' },
  '/pr-approval': { table: 'pr_approval', action: 'read' },
  '/pr-qa': { table: 'pr_qa', action: 'read' },
  '/po-tracking': { table: 'po_tracking', action: 'read' },
  '/receive-good': { table: 'receive_good', action: 'read' },
  '/receive-good/new': { table: 'receive_good', action: 'create' },
  '/receive-good/report': { table: 'receive_good', action: 'read' },
  '/w-series/wr': { table: 'w_series_wr', action: 'read' },
  '/w-series/wo': { table: 'w_series_wo', action: 'read' },
  '/w-series/wa': { table: 'w_series_wa', action: 'read' },
  '/w-series/wc': { table: 'w_series_wc', action: 'read' },
  '/my-kpi': { table: 'my_kpi', action: 'read' },
  '/admin/users': { table: 'admin_users', action: 'read' },
  '/admin/roles': { table: 'admin_roles', action: 'read' },
  '/admin/permissions': { table: 'admin_permissions', action: 'read' },
  '/admin/audit-trail': { table: 'admin_audit', action: 'read' },
  '/admin/sync-history': { table: 'admin_sync_pr', action: 'read' },
  '/admin/po-sync-history': { table: 'admin_sync_po', action: 'read' },
  '/admin/user-sync-history': { table: 'admin_sync_user', action: 'read' },
  '/admin/attachment-sync-history': { table: 'admin_sync_attach', action: 'read' },
  '/admin/workflow': { table: 'admin_workflow', action: 'read' },
  '/admin/kpi-dashboard': { table: 'admin_kpi', action: 'read' },
} as const;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * ตรวจสอบว่า role เป็น Admin หรือไม่
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);
}

/**
 * ตรวจสอบว่า role มีสิทธิ์ระดับสูง (Admin หรือ Approval)
 */
export function isElevatedRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ELEVATED_ROLES.includes(role as typeof ELEVATED_ROLES[number]);
}

/**
 * ดึงข้อมูล table metadata
 */
export function getTableMetadata(tableName: string): TableMetadata | undefined {
  return PROTECTED_TABLES[tableName];
}

/**
 * ดึง page permission จาก path
 */
export function getPagePermission(path: string): PagePermission | undefined {
  return PAGE_PERMISSIONS[path];
}

/**
 * ดึงรายการ tables ตาม category
 */
export function getTablesByCategory(category: PermissionCategory): string[] {
  return Object.entries(PROTECTED_TABLES)
    .filter(([_, meta]) => meta.category === category)
    .sort((a, b) => (a[1].displayOrder || 0) - (b[1].displayOrder || 0))
    .map(([tableName]) => tableName);
}

/**
 * ดึงรายการ tables ทั้งหมด
 */
export function getAllTables(): string[] {
  return Object.keys(PROTECTED_TABLES);
}

/**
 * ดึงรายการ categories ทั้งหมด
 */
export function getAllCategories(): PermissionCategory[] {
  const categories = new Set<PermissionCategory>();
  Object.values(PROTECTED_TABLES).forEach(meta => categories.add(meta.category));
  return Array.from(categories);
}

/**
 * แปลง PermissionAction เป็นชื่อภาษาไทย
 */
export function getActionLabel(action: PermissionAction): string {
  const labels: Record<PermissionAction, string> = {
    create: 'สร้าง',
    read: 'ดู',
    update: 'แก้ไข',
    delete: 'ลบ',
    execute: 'ดำเนินการ',
    search: 'ค้นหา',
    sync: 'ซิงค์',
    respond: 'ตอบ',
    clear: 'ล้าง',
    requester: 'ผู้ขอซื้อยืนยัน',
    line_approver: 'อนุมัติตามสายงาน',
    cost_center: 'อนุมัติตาม CC',
    manager: 'งานจัดซื้อพัสดุ',
    final: 'VP-C อนุมัติ',
    refresh: 'รีเฟรช',
  };
  return labels[action];
}

/**
 * แปลง Category เป็นชื่อภาษาไทย
 */
export function getCategoryLabel(category: PermissionCategory): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * ดึง permission ทั้งหมดจัดกลุ่มตาม category
 */
export function getPermissionsByCategory(): Record<PermissionCategory, Array<{ key: string; meta: TableMetadata }>> {
  const result: Record<string, Array<{ key: string; meta: TableMetadata }>> = {};

  for (const [key, meta] of Object.entries(PROTECTED_TABLES)) {
    if (!result[meta.category]) {
      result[meta.category] = [];
    }
    result[meta.category]!.push({ key, meta });
  }

  // Sort by displayOrder within each category
  for (const category of Object.keys(result)) {
    result[category]!.sort((a, b) => (a.meta.displayOrder || 0) - (b.meta.displayOrder || 0));
  }

  return result as Record<PermissionCategory, Array<{ key: string; meta: TableMetadata }>>;
}
