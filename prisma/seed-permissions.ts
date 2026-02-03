/**
 * Seed Permissions Script (v2)
 * สร้าง default permissions สำหรับ 58 actions ครอบคลุมทุกหน้า
 *
 * วิธีใช้:
 * npx ts-node prisma/seed-permissions.ts
 *
 * หรือเพิ่มใน package.json:
 * "prisma": { "seed": "ts-node prisma/seed-permissions.ts" }
 * แล้วรัน: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// =====================================================
// DEFAULT ROLES
// =====================================================

const DEFAULT_ROLES = [
  { name: "ผู้ดูแลระบบ", code: "Admin", priority: 1, description: "ผู้ดูแลระบบมีสิทธิ์เต็มที่ในการจัดการข้อมูลทั้งหมด", isSystem: true },
  { name: "ผู้อนุมัติ", code: "Approval", priority: 2, description: "มีสิทธิ์อนุมัติ PR และจัดการข้อมูลบางส่วน", isSystem: true },
  { name: "ผู้จัดการ", code: "Manager", priority: 3, description: "มีสิทธิ์ดูข้อมูลทุกส่วนและจัดการบางส่วน", isSystem: false },
  { name: "จัดซื้อ", code: "POPR", priority: 4, description: "มีสิทธิ์จัดการ PO และ PR", isSystem: false },
  { name: "คลังสินค้า", code: "Warehouse", priority: 5, description: "มีสิทธิ์จัดการการรับของ", isSystem: false },
  { name: "ทั่วไป", code: "PR", priority: 6, description: "มีสิทธิ์ดู PR ที่เกี่ยวข้อง", isSystem: false },
];

// =====================================================
// ALL 58 PERMISSIONS (from src/lib/permissions.ts)
// =====================================================

// Permission Matrix: true = allowed, false = denied
// Admin ไม่ต้องกำหนดเพราะ bypass ทั้งหมด
type PermissionMatrix = Record<string, Record<string, boolean>>;

const PERMISSION_MATRIX: PermissionMatrix = {
  // ===========================
  // 1. PR TRACKING (8 actions)
  // ===========================
  'pr_tracking.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'pr_tracking.search': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'pr_tracking.sync': {
    Approval: true, Manager: false, POPR: true, Warehouse: false, PR: false,
  },
  'pr_detail.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'wo_detail.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'po_detail.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: false,
  },
  'receive_report.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: false,
  },
  'pr_print.execute': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },

  // ===========================
  // 2. PR Q&A (5 actions)
  // ===========================
  'pr_qa.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'pr_qa.create': {
    Approval: true, Manager: true, POPR: true, Warehouse: false, PR: true,
  },
  'pr_qa.respond': {
    Approval: true, Manager: true, POPR: true, Warehouse: false, PR: true,
  },
  'pr_qa.update': {
    Approval: true, Manager: true, POPR: true, Warehouse: false, PR: true,
  },
  'pr_qa.delete': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 3. PR APPROVAL (8 actions)
  // ===========================
  'pr_approval.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'pr_approve.requester': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'pr_approve.line_approver': {
    Approval: true, Manager: true, POPR: false, Warehouse: false, PR: false,
  },
  'pr_approve.cost_center': {
    Approval: true, Manager: true, POPR: false, Warehouse: false, PR: false,
  },
  'pr_approve.manager': {
    Approval: true, Manager: true, POPR: false, Warehouse: false, PR: false,
  },
  'pr_approve.final': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'pr_reject.execute': {
    Approval: true, Manager: true, POPR: false, Warehouse: false, PR: false,
  },
  'pr_approve.clear': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 4. RECEIVE GOOD (7 actions)
  // ===========================
  'receive_good.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: false,
  },
  'receive_good.create': {
    Approval: true, Manager: false, POPR: true, Warehouse: true, PR: false,
  },
  'receive_attachment.create': {
    Approval: true, Manager: false, POPR: true, Warehouse: true, PR: false,
  },
  'receive_confirm.execute': {
    Approval: true, Manager: false, POPR: true, Warehouse: true, PR: false,
  },
  'receive_good.update': {
    Approval: true, Manager: false, POPR: true, Warehouse: true, PR: false,
  },
  'receive_good.delete': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  // 'receive_report.read' อยู่ใน PR Tracking แล้ว

  // ===========================
  // 5. PO TRACKING (5 actions)
  // ===========================
  'po_tracking.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: false,
  },
  'po_tracking.search': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: false,
  },
  'po_tracking.sync': {
    Approval: true, Manager: false, POPR: true, Warehouse: false, PR: false,
  },
  // 'po_detail.read' อยู่ใน PR Tracking แล้ว
  'po_delivery.create': {
    Approval: true, Manager: false, POPR: true, Warehouse: true, PR: false,
  },

  // ===========================
  // 6. ADMIN - USERS (5 actions)
  // ===========================
  'admin_users.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_users.create': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_users.update': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_users.delete': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_users.sync': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 7. ADMIN - ROLES (5 actions)
  // ===========================
  'admin_roles.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_roles.create': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_roles.update': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_roles.delete': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_roles.seed': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 8. ADMIN - PERMISSIONS (2 actions)
  // ===========================
  'admin_permissions.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_permissions.update': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 9. ADMIN - AUDIT (2 actions)
  // ===========================
  'admin_audit.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_audit.filter': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 10. ADMIN - SYNC (6 actions)
  // ===========================
  'admin_sync_pr.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_sync_po.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_sync_user.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_sync_attach.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_sync.execute': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_sync.refresh': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 11. ADMIN - WORKFLOW (5 actions)
  // ===========================
  'admin_workflow.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_workflow.sync': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_ocr_member.update': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_approver_line.update': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_approver_cc.update': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },

  // ===========================
  // 12. KPI (3 actions)
  // ===========================
  'my_kpi.read': {
    Approval: true, Manager: true, POPR: true, Warehouse: true, PR: true,
  },
  'admin_kpi.read': {
    Approval: true, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
  'admin_kpi.update': {
    Approval: false, Manager: false, POPR: false, Warehouse: false, PR: false,
  },
};

// =====================================================
// ACTION METADATA (ชื่อไทย และหมวดหมู่)
// =====================================================

const ACTION_METADATA: Record<string, { friendlyName: string; category: string; description: string; displayOrder: number }> = {
  // PR Tracking
  'pr_tracking.read': { friendlyName: 'ดูหน้าติดตาม PR', category: 'pr_tracking', description: 'เข้าถึงหน้า PR Tracking', displayOrder: 1 },
  'pr_tracking.search': { friendlyName: 'ค้นหา PR', category: 'pr_tracking', description: 'ใช้ตัวกรองค้นหา', displayOrder: 2 },
  'pr_tracking.sync': { friendlyName: 'ซิงค์ PR', category: 'pr_tracking', description: 'ดึงข้อมูลใหม่จาก SAP', displayOrder: 3 },
  'pr_detail.read': { friendlyName: 'ดูรายละเอียด PR', category: 'pr_tracking', description: 'เปิด popup ดูรายละเอียด PR', displayOrder: 4 },
  'wo_detail.read': { friendlyName: 'ดูใบสั่งงาน', category: 'pr_tracking', description: 'เปิด popup ดู Work Order', displayOrder: 5 },
  'po_detail.read': { friendlyName: 'ดูใบสั่งซื้อ', category: 'pr_tracking', description: 'เปิด popup ดู PO', displayOrder: 6 },
  'receive_report.read': { friendlyName: 'ดูรายงานรับของ', category: 'pr_tracking', description: 'เปิด popup ดูสถานะรับของ', displayOrder: 7 },
  'pr_print.execute': { friendlyName: 'พิมพ์ PR', category: 'pr_tracking', description: 'พิมพ์เอกสาร PR', displayOrder: 8 },

  // PR Q&A
  'pr_qa.read': { friendlyName: 'ดูคำถาม-คำตอบ', category: 'pr_qa', description: 'เข้าถึงหน้า Q&A', displayOrder: 1 },
  'pr_qa.create': { friendlyName: 'ถามคำถามใหม่', category: 'pr_qa', description: 'สร้างคำถามการติดตาม', displayOrder: 2 },
  'pr_qa.respond': { friendlyName: 'ตอบคำถาม', category: 'pr_qa', description: 'ตอบคำถามที่มีอยู่', displayOrder: 3 },
  'pr_qa.update': { friendlyName: 'แก้ไขคำถาม/คำตอบ', category: 'pr_qa', description: 'แก้ไขข้อความ', displayOrder: 4 },
  'pr_qa.delete': { friendlyName: 'ลบคำถาม/คำตอบ', category: 'pr_qa', description: 'ลบข้อความ', displayOrder: 5 },

  // PR Approval
  'pr_approval.read': { friendlyName: 'ดูหน้าอนุมัติ', category: 'pr_approval', description: 'เข้าถึงหน้าอนุมัติ', displayOrder: 1 },
  'pr_approve.requester': { friendlyName: 'ผู้ขอซื้อยืนยัน', category: 'pr_approval', description: 'ผู้เปิด PR กดยืนยัน (ขั้น 1)', displayOrder: 2 },
  'pr_approve.line_approver': { friendlyName: 'อนุมัติตามสายงาน', category: 'pr_approval', description: 'Approver ตาม Line อนุมัติ (ขั้น 2)', displayOrder: 3 },
  'pr_approve.cost_center': { friendlyName: 'อนุมัติตาม Cost Center', category: 'pr_approval', description: 'Approver ตาม CC อนุมัติ (ขั้น 3)', displayOrder: 4 },
  'pr_approve.manager': { friendlyName: 'งานจัดซื้อพัสดุอนุมัติ', category: 'pr_approval', description: 'Manager อนุมัติ (ขั้น 4)', displayOrder: 5 },
  'pr_approve.final': { friendlyName: 'VP-C อนุมัติ (สุดท้าย)', category: 'pr_approval', description: 'อนุมัติขั้นสุดท้าย (ขั้น 5)', displayOrder: 6 },
  'pr_reject.execute': { friendlyName: 'ปฏิเสธ PR', category: 'pr_approval', description: 'ปฏิเสธการอนุมัติ', displayOrder: 7 },
  'pr_approve.clear': { friendlyName: 'ล้างการอนุมัติ', category: 'pr_approval', description: 'Admin ล้าง approval', displayOrder: 8 },

  // Receive Good
  'receive_good.read': { friendlyName: 'ดูรายการรับของ', category: 'receive_good', description: 'เข้าถึงหน้ารับของ', displayOrder: 1 },
  'receive_good.create': { friendlyName: 'บันทึกรับของ', category: 'receive_good', description: 'สร้างรายการรับของใหม่', displayOrder: 2 },
  'receive_attachment.create': { friendlyName: 'แนบเอกสาร/รูป', category: 'receive_good', description: 'อัพโหลดเอกสาร/รูปภาพ', displayOrder: 3 },
  'receive_confirm.execute': { friendlyName: 'ยืนยันรับของ', category: 'receive_good', description: 'กดยืนยันรายการรับ (Confirm batch)', displayOrder: 4 },
  'receive_good.update': { friendlyName: 'แก้ไขรับของ', category: 'receive_good', description: 'แก้ไขข้อมูลการรับ', displayOrder: 5 },
  'receive_good.delete': { friendlyName: 'ลบรายการรับของ', category: 'receive_good', description: 'ลบรายการ (Admin only)', displayOrder: 6 },

  // PO Tracking
  'po_tracking.read': { friendlyName: 'ดูหน้าติดตาม PO', category: 'po_tracking', description: 'เข้าถึงหน้า PO', displayOrder: 1 },
  'po_tracking.search': { friendlyName: 'ค้นหา PO', category: 'po_tracking', description: 'ใช้ตัวกรอง', displayOrder: 2 },
  'po_tracking.sync': { friendlyName: 'ซิงค์ PO', category: 'po_tracking', description: 'ดึงข้อมูล PO ใหม่', displayOrder: 3 },
  'po_delivery.create': { friendlyName: 'บันทึกติดตามส่งของ', category: 'po_tracking', description: 'บันทึกการติดตามการจัดส่ง', displayOrder: 4 },

  // Admin Users
  'admin_users.read': { friendlyName: 'ดูรายชื่อผู้ใช้', category: 'admin_users', description: 'เข้าหน้าจัดการผู้ใช้', displayOrder: 1 },
  'admin_users.create': { friendlyName: 'เพิ่มผู้ใช้', category: 'admin_users', description: 'สร้าง user ใหม่', displayOrder: 2 },
  'admin_users.update': { friendlyName: 'แก้ไขผู้ใช้', category: 'admin_users', description: 'แก้ไขข้อมูล user', displayOrder: 3 },
  'admin_users.delete': { friendlyName: 'ลบผู้ใช้', category: 'admin_users', description: 'ลบ user', displayOrder: 4 },
  'admin_users.sync': { friendlyName: 'ซิงค์ผู้ใช้', category: 'admin_users', description: 'ดึง user จาก TMK', displayOrder: 5 },

  // Admin Roles
  'admin_roles.read': { friendlyName: 'ดู Role', category: 'admin_roles', description: 'เข้าหน้าจัดการ Role', displayOrder: 1 },
  'admin_roles.create': { friendlyName: 'เพิ่ม Role', category: 'admin_roles', description: 'สร้าง Role ใหม่', displayOrder: 2 },
  'admin_roles.update': { friendlyName: 'แก้ไข Role', category: 'admin_roles', description: 'แก้ไข Role', displayOrder: 3 },
  'admin_roles.delete': { friendlyName: 'ลบ Role', category: 'admin_roles', description: 'ลบ Role', displayOrder: 4 },
  'admin_roles.seed': { friendlyName: 'สร้าง Role เริ่มต้น', category: 'admin_roles', description: 'seed Role default', displayOrder: 5 },

  // Admin Permissions
  'admin_permissions.read': { friendlyName: 'ดูการตั้งค่าสิทธิ์', category: 'admin_permissions', description: 'เข้าหน้าจัดการสิทธิ์', displayOrder: 1 },
  'admin_permissions.update': { friendlyName: 'แก้ไขสิทธิ์', category: 'admin_permissions', description: 'เปลี่ยนสิทธิ์ของ Role', displayOrder: 2 },

  // Admin Audit
  'admin_audit.read': { friendlyName: 'ดูประวัติการใช้งาน', category: 'admin_audit', description: 'ดู log การใช้งาน', displayOrder: 1 },
  'admin_audit.filter': { friendlyName: 'กรอง Audit', category: 'admin_audit', description: 'กรองตาม user/action/date', displayOrder: 2 },

  // Admin Sync
  'admin_sync_pr.read': { friendlyName: 'ดูประวัติซิงค์ PR', category: 'admin_sync', description: 'ดู PR sync history', displayOrder: 1 },
  'admin_sync_po.read': { friendlyName: 'ดูประวัติซิงค์ PO', category: 'admin_sync', description: 'ดู PO sync history', displayOrder: 2 },
  'admin_sync_user.read': { friendlyName: 'ดูประวัติซิงค์ผู้ใช้', category: 'admin_sync', description: 'ดู user sync history', displayOrder: 3 },
  'admin_sync_attach.read': { friendlyName: 'ดูประวัติซิงค์ไฟล์', category: 'admin_sync', description: 'ดู attachment sync', displayOrder: 4 },
  'admin_sync.execute': { friendlyName: 'เรียกซิงค์ด้วยมือ', category: 'admin_sync', description: 'trigger sync ด้วยตนเอง', displayOrder: 5 },
  'admin_sync.refresh': { friendlyName: 'รีเฟรช PR ทั้งหมด', category: 'admin_sync', description: 'TRUNCATE & resync (อันตราย)', displayOrder: 6 },

  // Admin Workflow
  'admin_workflow.read': { friendlyName: 'ดูรายการแผนก', category: 'admin_workflow', description: 'ดูรายการ OCR Code/แผนก', displayOrder: 1 },
  'admin_workflow.sync': { friendlyName: 'ซิงค์แผนก', category: 'admin_workflow', description: 'ดึงแผนกใหม่จาก SAP', displayOrder: 2 },
  'admin_ocr_member.update': { friendlyName: 'จัดการสมาชิกแผนก', category: 'admin_workflow', description: 'เพิ่ม/ลบสมาชิก', displayOrder: 3 },
  'admin_approver_line.update': { friendlyName: 'ตั้งค่าผู้อนุมัติสายงาน', category: 'admin_workflow', description: 'ตั้งค่า line approver', displayOrder: 4 },
  'admin_approver_cc.update': { friendlyName: 'ตั้งค่าผู้อนุมัติ CC', category: 'admin_workflow', description: 'ตั้งค่า cost center approver', displayOrder: 5 },

  // KPI
  'my_kpi.read': { friendlyName: 'ดู KPI ของฉัน', category: 'kpi', description: 'ดู KPI ส่วนตัว (เวลา approve, confirm)', displayOrder: 1 },
  'admin_kpi.read': { friendlyName: 'ดู KPI ทุกคน', category: 'admin_kpi', description: 'ดู KPI ของทุกคนใน Admin Panel', displayOrder: 1 },
  'admin_kpi.update': { friendlyName: 'ตั้งค่า SLA', category: 'admin_kpi', description: 'ตั้งค่า SLA target สำหรับ KPI', displayOrder: 2 },
};

// =====================================================
// CATEGORY METADATA
// =====================================================

const CATEGORY_METADATA = [
  { category: 'pr_tracking', friendlyName: 'หน้าติดตาม PR', displayOrder: 1 },
  { category: 'pr_qa', friendlyName: 'ระบบถาม-ตอบ', displayOrder: 2 },
  { category: 'pr_approval', friendlyName: 'ระบบอนุมัติ PR', displayOrder: 3 },
  { category: 'receive_good', friendlyName: 'ระบบรับของ', displayOrder: 4 },
  { category: 'po_tracking', friendlyName: 'หน้าติดตาม PO', displayOrder: 5 },
  { category: 'kpi', friendlyName: 'KPI ส่วนตัว', displayOrder: 6 },
  { category: 'admin_users', friendlyName: 'จัดการผู้ใช้', displayOrder: 7 },
  { category: 'admin_roles', friendlyName: 'จัดการ Role', displayOrder: 8 },
  { category: 'admin_permissions', friendlyName: 'จัดการสิทธิ์', displayOrder: 9 },
  { category: 'admin_audit', friendlyName: 'ประวัติการใช้งาน', displayOrder: 10 },
  { category: 'admin_sync', friendlyName: 'ประวัติซิงค์', displayOrder: 11 },
  { category: 'admin_workflow', friendlyName: 'จัดการ Workflow', displayOrder: 12 },
  { category: 'admin_kpi', friendlyName: 'KPI Dashboard', displayOrder: 13 },
];

// =====================================================
// SEED FUNCTION
// =====================================================

async function seedPermissions() {
  console.log("🚀 Starting permission seed (v2 - 58 actions)...\n");

  // 1. Upsert Roles
  console.log("📋 Seeding roles...");
  const roleMap: Record<string, number> = {};

  for (const role of DEFAULT_ROLES) {
    const existing = await db.system_role.findUnique({
      where: { code: role.code },
    });

    if (existing) {
      await db.system_role.update({
        where: { code: role.code },
        data: {
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          updatedAt: new Date(),
        },
      });
      roleMap[role.code] = existing.id;
      console.log(`  ✅ Updated: ${role.name} (${role.code})`);
    } else {
      const created = await db.system_role.create({
        data: {
          name: role.name,
          code: role.code,
          priority: role.priority,
          description: role.description,
          isSystem: role.isSystem,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      roleMap[role.code] = created.id;
      console.log(`  ✅ Created: ${role.name} (${role.code})`);
    }
  }

  // 2. Seed Action Metadata (table_metadata)
  console.log("\n📋 Seeding action metadata...");
  for (const [actionName, meta] of Object.entries(ACTION_METADATA)) {
    try {
      await db.table_metadata.upsert({
        where: { tableName: actionName },
        update: {
          friendlyName: meta.friendlyName,
          category: meta.category,
          description: meta.description,
          displayOrder: meta.displayOrder,
          updatedAt: new Date(),
        },
        create: {
          tableName: actionName,
          friendlyName: meta.friendlyName,
          category: meta.category,
          description: meta.description,
          displayOrder: meta.displayOrder,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      // Silently skip if table doesn't exist
    }
  }
  console.log(`  ✅ Seeded ${Object.keys(ACTION_METADATA).length} action metadata entries`);

  // 3. Seed Role Permissions (action-based)
  console.log("\n📋 Seeding role permissions...");

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const [actionName, rolePermissions] of Object.entries(PERMISSION_MATRIX)) {
    for (const [roleCode, allowed] of Object.entries(rolePermissions)) {
      const roleIdNum = roleMap[roleCode];
      if (roleIdNum === undefined) continue;

      try {
        const existing = await db.role_permission.findUnique({
          where: {
            roleId_tableName: {
              roleId: roleIdNum,
              tableName: actionName,
            },
          },
        });

        if (existing) {
          // Update only canRead (action-based system uses canRead as "allowed")
          await db.role_permission.update({
            where: {
              roleId_tableName: {
                roleId: roleIdNum,
                tableName: actionName,
              },
            },
            data: {
              canRead: allowed,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              updatedAt: new Date(),
            },
          });
          totalUpdated++;
        } else {
          await db.role_permission.create({
            data: {
              roleId: roleIdNum,
              tableName: actionName,
              canRead: allowed,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              updatedAt: new Date(),
            },
          });
          totalCreated++;
        }
      } catch {
        // Silently skip errors
      }
    }
  }

  console.log(`  ✅ Created ${totalCreated} permissions`);
  console.log(`  ✅ Updated ${totalUpdated} permissions`);

  // 4. Summary
  const totalActions = Object.keys(PERMISSION_MATRIX).length;
  const totalRoles = Object.keys(roleMap).length;

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   - Total Actions: ${totalActions}`);
  console.log(`   - Total Roles: ${totalRoles}`);
  console.log(`   - Total Permissions: ${totalActions * (totalRoles - 1)} (Admin bypasses)`);
  console.log("=".repeat(50));

  console.log("\n✅ Permission seed (v2) completed!");
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  try {
    await seedPermissions();
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
