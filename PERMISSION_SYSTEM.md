# ระบบ Permission (สิทธิ์การเข้าถึง)

> **Version**: v4.1
> **Last Updated**: 2026-02-03
> **Status**: Production Ready - Fully Enforced with PageGuard & CanAccess

ระบบ Permission แบบ Action-Based ครอบคลุม **63 Actions** ใน **14 หมวดหมู่** พร้อมการป้องกัน 4 ชั้น + Components สำหรับควบคุม UI

---

## สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [โครงสร้างฐานข้อมูล](#โครงสร้างฐานข้อมูล)
3. [ลำดับการตรวจสอบสิทธิ์](#ลำดับการตรวจสอบสิทธิ์)
4. [การป้องกัน 4 ชั้น](#การป้องกัน-4-ชั้น)
5. [รายการ Actions ทั้งหมด](#รายการ-actions-ทั้งหมด-58-actions)
6. [ตารางสิทธิ์เริ่มต้น](#ตารางสิทธิ์เริ่มต้นตาม-role)
7. [Approval Flow](#approval-flow-5-ขั้นตอน)
8. [ไฟล์สำคัญ](#ไฟล์สำคัญ)
9. [วิธีใช้งาน](#วิธีใช้งาน)
10. [การเพิ่ม Feature ใหม่](#การเพิ่ม-feature-ใหม่)
11. [การทดสอบ](#การทดสอบ)

---

## ภาพรวมระบบ

### สถิติระบบ
| รายการ | จำนวน |
|--------|-------|
| Actions ทั้งหมด | 63 |
| หมวดหมู่ | 14 |
| Roles | 6 (Admin, Approval, Manager, POPR, Warehouse, PR) |
| Protection Layers | 4 |

### Key Features
- **Action-Based**: ไม่ใช่แค่ CRUD แต่ละเอียดถึงทุกปุ่ม/ฟังก์ชัน
- **4-Layer Protection**: ป้องกันทั้ง Frontend และ Backend
- **Admin Bypass**: Admin มีสิทธิ์ทุกอย่างอัตโนมัติ
- **User Override**: ตั้งค่าสิทธิ์เฉพาะ user ได้ (override role)
- **Thai Labels**: ชื่อไทยและคำอธิบายทุก action

---

## โครงสร้างฐานข้อมูล

### ตารางที่เกี่ยวข้อง

| ตาราง | หน้าที่ |
|-------|---------|
| `system_role` | เก็บ Role (Admin, Approval, Manager, POPR, Warehouse, PR) |
| `role_permission` | สิทธิ์ตาม Role (default) |
| `user_table_permission` | สิทธิ์เฉพาะ User (override role) |
| `table_metadata` | ชื่อไทย/คำอธิบายของ action |

### Default Roles

| Role | Code | Priority | คำอธิบาย |
|------|------|----------|---------|
| ผู้ดูแลระบบ | Admin | 1 | Full access (bypass ทุกอย่าง) |
| ผู้อนุมัติ | Approval | 2 | เข้าถึงได้เกือบทุกอย่าง + Admin pages |
| ผู้จัดการ | Manager | 3 | ดูได้ทุกอย่าง อนุมัติได้ถึงขั้น 4-5 |
| จัดซื้อ | POPR | 4 | จัดการ PR, PO, รับของ |
| คลังสินค้า | Warehouse | 5 | จัดการรับของ |
| ทั่วไป | PR | 6 | ดู PR ที่เกี่ยวข้อง |

---

## ลำดับการตรวจสอบสิทธิ์

```
┌─────────────────────────────────────────────────────────┐
│              Permission Check Flow (4 ขั้น)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Admin Bypass?                                       │
│     └── ถ้า role = Admin → อนุญาตทันที                  │
│                                                         │
│  2. User Override?                                      │
│     └── ถ้ามี user_table_permission → ใช้ค่านั้น       │
│                                                         │
│  3. Role Permission?                                    │
│     └── ถ้ามี role_permission → ใช้ค่านั้น             │
│                                                         │
│  4. Default Deny                                        │
│     └── ไม่มีข้อมูล → ปฏิเสธ                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## การป้องกัน 4 ชั้น

| ชั้น | ตำแหน่ง | หน้าที่ | File |
|------|---------|---------|------|
| 1 | **Sidebar** | ซ่อนเมนูที่ไม่มีสิทธิ์ | `src/components/Sidebar.tsx` |
| 2 | **AuthGuard** | บล็อก URL ตรง (แสดง 403) | `src/components/AuthGuard.tsx` |
| 3 | **API Middleware** | ป้องกัน REST API | `src/server/api/middleware/withPermission.ts` |
| 4 | **tRPC Procedure** | ป้องกัน tRPC mutations/queries | `src/server/api/trpc.ts` |

### การทำงาน

1. **Sidebar**: User เห็นเฉพาะเมนูที่มีสิทธิ์ (ใช้ `useMenuVisibility` hook)
2. **AuthGuard**: ถ้าพิมพ์ URL ตรง (เช่น `/admin/users`) → ตรวจสอบ → แสดง "ไม่มีสิทธิ์เข้าถึง"
3. **API Middleware**: ถ้าเรียก API โดยไม่มีสิทธิ์ → return 403 Forbidden
4. **tRPC Procedure**: ถ้าเรียก tRPC mutation/query โดยไม่มีสิทธิ์ → throw TRPCError

---

## รายการ Actions ทั้งหมด (63 Actions)

### 1. หน้าติดตาม PR (`pr_tracking`) - 8 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูหน้าติดตาม PR | `pr_tracking.read` | เข้าถึงหน้า PR Tracking |
| ค้นหา PR | `pr_tracking.search` | ใช้ตัวกรองค้นหา |
| ซิงค์ PR | `pr_tracking.sync` | ดึงข้อมูลใหม่จาก SAP |
| ดูรายละเอียด PR | `pr_detail.read` | เปิด popup ดู PR |
| ดูใบสั่งงาน | `wo_detail.read` | เปิด popup ดู Work Order |
| ดูใบสั่งซื้อ | `po_detail.read` | เปิด popup ดู PO |
| ดูรายงานรับของ | `receive_report.read` | เปิด popup สถานะรับของ |
| พิมพ์ PR | `pr_print.execute` | พิมพ์เอกสาร PR |

### 2. ระบบถาม-ตอบ (`pr_qa`) - 5 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูคำถาม-คำตอบ | `pr_qa.read` | เข้าถึงหน้า Q&A |
| ถามคำถามใหม่ | `pr_qa.create` | สร้างคำถามการติดตาม |
| ตอบคำถาม | `pr_qa.respond` | ตอบคำถามที่มีอยู่ |
| แก้ไขคำถาม/คำตอบ | `pr_qa.update` | แก้ไขข้อความ |
| ลบคำถาม/คำตอบ | `pr_qa.delete` | ลบข้อความ |

### 3. ระบบอนุมัติ PR (`pr_approval`) - 8 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูหน้าอนุมัติ | `pr_approval.read` | เข้าถึงหน้าอนุมัติ (**ทุก role**) |
| ผู้ขอซื้อยืนยัน | `pr_approve.requester` | ขั้น 1: ผู้เปิด PR ยืนยัน |
| อนุมัติตามสายงาน | `pr_approve.line_approver` | ขั้น 2: Approver ตาม Line |
| อนุมัติตาม CC | `pr_approve.cost_center` | ขั้น 3: Approver ตาม Cost Center |
| งานจัดซื้อพัสดุ | `pr_approve.manager` | ขั้น 4: Manager อนุมัติ |
| VP-C อนุมัติ | `pr_approve.final` | ขั้น 5: Approval role อนุมัติ |
| ปฏิเสธ PR | `pr_reject.execute` | ปฏิเสธการอนุมัติ |
| ล้างการอนุมัติ | `pr_approve.clear` | Admin ล้าง approval |

### 4. ระบบรับของ (`receive_good`) - 7 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูรายการรับของ | `receive_good.read` | เข้าถึงหน้ารับของ |
| บันทึกรับของ | `receive_good.create` | สร้างรายการรับของใหม่ |
| แนบเอกสาร/รูป | `receive_attachment.create` | อัพโหลดเอกสาร |
| ยืนยันรับของ | `receive_confirm.execute` | กดยืนยัน (Confirm batch) |
| แก้ไขรับของ | `receive_good.update` | แก้ไขข้อมูลการรับ |
| ลบรายการรับของ | `receive_good.delete` | ลบรายการ (**Admin only**) |
| ดูรายงานรับของ | `receive_report.read` | ดูรายงานสรุป |

### 5. หน้าติดตาม PO (`po_tracking`) - 5 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูหน้าติดตาม PO | `po_tracking.read` | เข้าถึงหน้า PO |
| ค้นหา PO | `po_tracking.search` | ใช้ตัวกรอง |
| ซิงค์ PO | `po_tracking.sync` | ดึงข้อมูล PO ใหม่ |
| ดูรายละเอียด PO | `po_detail.read` | เปิด popup รายละเอียด |
| บันทึกติดตามส่งของ | `po_delivery.create` | บันทึกการติดตามการจัดส่ง |

### 6. Admin - จัดการผู้ใช้ (`admin_users`) - 5 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูรายชื่อผู้ใช้ | `admin_users.read` | เข้าหน้าจัดการผู้ใช้ |
| เพิ่มผู้ใช้ | `admin_users.create` | สร้าง user ใหม่ |
| แก้ไขผู้ใช้ | `admin_users.update` | แก้ไขข้อมูล user |
| ลบผู้ใช้ | `admin_users.delete` | ลบ user |
| ซิงค์ผู้ใช้ | `admin_users.sync` | ดึง user จาก TMK |

### 7. Admin - จัดการ Role (`admin_roles`) - 5 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดู Role | `admin_roles.read` | เข้าหน้าจัดการ Role |
| เพิ่ม Role | `admin_roles.create` | สร้าง Role ใหม่ |
| แก้ไข Role | `admin_roles.update` | แก้ไข Role |
| ลบ Role | `admin_roles.delete` | ลบ Role |
| สร้าง Role เริ่มต้น | `admin_roles.seed` | seed Role default |

### 8. Admin - จัดการสิทธิ์ (`admin_permissions`) - 2 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูการตั้งค่าสิทธิ์ | `admin_permissions.read` | เข้าหน้าจัดการสิทธิ์ |
| แก้ไขสิทธิ์ | `admin_permissions.update` | เปลี่ยนสิทธิ์ของ Role |

### 9. Admin - Audit Trail (`admin_audit`) - 2 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูประวัติการใช้งาน | `admin_audit.read` | ดู log การใช้งาน |
| กรอง Audit | `admin_audit.filter` | กรองตาม user/action/date |

### 10. Admin - Sync History (`admin_sync`) - 6 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูประวัติซิงค์ PR | `admin_sync_pr.read` | ดู PR sync history |
| ดูประวัติซิงค์ PO | `admin_sync_po.read` | ดู PO sync history |
| ดูประวัติซิงค์ผู้ใช้ | `admin_sync_user.read` | ดู user sync history |
| ดูประวัติซิงค์ไฟล์ | `admin_sync_attach.read` | ดู attachment sync |
| เรียกซิงค์ด้วยมือ | `admin_sync.execute` | trigger sync ด้วยตนเอง |
| รีเฟรช PR ทั้งหมด | `admin_sync.refresh` | TRUNCATE & resync (**อันตราย**) |

### 11. Admin - Workflow (`admin_workflow`) - 5 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูรายการแผนก | `admin_workflow.read` | ดูรายการ OCR Code/แผนก |
| ซิงค์แผนก | `admin_workflow.sync` | ดึงแผนกใหม่จาก SAP |
| จัดการสมาชิกแผนก | `admin_ocr_member.update` | เพิ่ม/ลบสมาชิก |
| ตั้งค่าผู้อนุมัติสายงาน | `admin_approver_line.update` | ตั้งค่า line approver |
| ตั้งค่าผู้อนุมัติ CC | `admin_approver_cc.update` | ตั้งค่า cost center approver |

### 12. KPI ของฉัน (`my_kpi`) - 1 action

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดู KPI ส่วนตัว | `my_kpi.read` | ดู KPI + สถิติการใช้งานของตัวเอง |

### 13. Admin - KPI Dashboard (`admin_kpi`) - 3 actions

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดู KPI Dashboard | `admin_kpi.read` | เข้าหน้า Admin KPI Dashboard |
| แก้ไข SLA Config | `admin_kpi.update` | ตั้งค่า/แก้ไข SLA |
| ลบ SLA Config | `admin_kpi.delete` | ลบ SLA config |

### 14. Admin - Usage Analytics (`admin_usage`) - 1 action

| Action | รหัส | คำอธิบาย |
|--------|------|----------|
| ดูสถิติการใช้งาน | `admin_usage.read` | ดู Usage Analytics (login/logout รายวัน/สัปดาห์/เดือน) |

---

## ตารางสิทธิ์เริ่มต้นตาม Role

### สิทธิ์ทั่วไป

| Permission | ชื่อไทย | Admin | Approval | Manager | POPR | Warehouse | PR |
|------------|---------|:-----:|:--------:|:-------:|:----:|:---------:|:--:|
| `pr_tracking.read` | ดูหน้าติดตาม PR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pr_tracking.sync` | ซิงค์ PR | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `pr_approval.read` | ดูหน้าอนุมัติ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pr_qa.read` | ดูคำถาม-คำตอบ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pr_qa.create` | ถามคำถามใหม่ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `pr_qa.respond` | ตอบคำถาม | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `po_tracking.read` | ดูหน้าติดตาม PO | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `receive_good.read` | ดูรายการรับของ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `receive_good.create` | บันทึกรับของ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `receive_confirm.execute` | ยืนยันรับของ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `receive_good.delete` | ลบรายการรับของ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### สิทธิ์ Approval Flow

| Permission | ชื่อไทย | Admin | Approval | Manager | POPR | Warehouse | PR |
|------------|---------|:-----:|:--------:|:-------:|:----:|:---------:|:--:|
| `pr_approve.requester` | ผู้ขอซื้อยืนยัน | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pr_approve.line_approver` | อนุมัติตามสายงาน | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pr_approve.cost_center` | อนุมัติตาม CC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pr_approve.manager` | งานจัดซื้อพัสดุ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pr_approve.final` | VP-C อนุมัติ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pr_approve.clear` | ล้างการอนุมัติ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **หมายเหตุ**: ขั้น 1-3 ทุก role มีสิทธิ์ แต่ต้องถูก assign ใน `ocr_approvers` table ด้วย

### สิทธิ์ Admin

| Permission | Admin | Approval | Manager | POPR | Warehouse | PR |
|------------|:-----:|:--------:|:-------:|:----:|:---------:|:--:|
| `admin_users.*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin_roles.*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin_permissions.*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin_audit.*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin_sync_*.*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin_workflow.*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Approval Flow (5 ขั้นตอน)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PR Approval Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ขั้น 1: ผู้ขอซื้อยืนยัน                                        │
│  ├── ตรวจสอบ: เป็นคนเปิด PR หรือไม่                            │
│  └── เมื่อกด → auto-create receipt                             │
│                                                                 │
│  ขั้น 2: ผู้อนุมัติตามสายงาน                                    │
│  └── ตรวจสอบ: อยู่ใน ocr_approvers (type='line')               │
│                                                                 │
│  ขั้น 3: ผู้อนุมัติ Cost Center                                 │
│  └── ตรวจสอบ: อยู่ใน ocr_approvers (type='cost_center')        │
│                                                                 │
│  ขั้น 4: งานจัดซื้อพัสดุ                                        │
│  └── ตรวจสอบ: role = Manager หรือ Approval                     │
│                                                                 │
│  ขั้น 5: VP-C อนุมัติ (Final)                                   │
│  └── ตรวจสอบ: role = Approval                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| `src/lib/permissions.ts` | นิยาม 58 actions ทั้งหมด |
| `src/lib/check-permission.ts` | Logic ตรวจสอบสิทธิ์ |
| `src/server/api/middleware/withPermission.ts` | API Middleware |
| `src/server/api/trpc.ts` | tRPC Procedures |
| `src/hooks/usePermission.ts` | Frontend Hooks |
| `src/components/AuthGuard.tsx` | Page-level protection (legacy) |
| `src/components/PageGuard.tsx` | **Page wrapper ตรวจสอบสิทธิ์ (v4.0)** |
| `src/components/CanAccess.tsx` | **ซ่อน/แสดง elements ตามสิทธิ์ (v4.0)** |
| `src/components/Sidebar.tsx` | Menu visibility |
| `src/components/AdminSidebar.tsx` | Admin menu visibility |
| `prisma/seed-permissions.ts` | Seed default permissions |

---

## Components สำหรับควบคุม UI (v4.0)

### PageGuard - ป้องกันระดับหน้า

ใช้ครอบ content ของหน้าที่ต้องตรวจสอบสิทธิ์ก่อนเข้าถึง

```typescript
// src/pages/admin/roles.tsx
import PageGuard from "~/components/PageGuard";

function AdminRolesContent() {
  // content ที่ต้องการป้องกัน
  return <div>...</div>;
}

export default function AdminRolesPage() {
  return (
    <PageGuard action="admin_roles.read" pageName="จัดการ Role">
      <AdminRolesContent />
    </PageGuard>
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `action` | string | Action key เช่น `admin_roles.read` |
| `pageName` | string | ชื่อหน้าแสดงใน error message |
| `children` | ReactNode | Content ที่จะแสดงถ้ามีสิทธิ์ |

**หน้าที่ใช้ PageGuard แล้ว:**
- `/admin/roles` → `admin_roles.read`
- `/admin/permissions` → `admin_permissions.read`
- `/admin/audit-trail` → `admin_audit.read`
- `/admin/workflow` → `admin_workflow.read`
- `/admin/users` → `admin_users.read`
- `/admin/sync-history` → `admin_sync_pr.read`
- และอื่นๆ

---

### CanAccess - ซ่อน/แสดง Elements ตามสิทธิ์

ใช้ครอบ elements (ปุ่ม, form, etc.) ที่ต้องการซ่อนหรือแสดงตามสิทธิ์

```typescript
import CanAccess from "~/components/CanAccess";

// ซ่อนถ้าไม่มีสิทธิ์
<CanAccess action="admin_roles.create">
  <button onClick={handleCreate}>+ เพิ่ม Role</button>
</CanAccess>

// แสดงเป็น disabled พร้อม tooltip
<CanAccess
  action="admin_roles.delete"
  showDisabled
  disabledTooltip="คุณไม่มีสิทธิ์ลบ"
>
  <button onClick={handleDelete}>ลบ</button>
</CanAccess>

// แสดง fallback component แทน
<CanAccess
  action="admin_roles.update"
  fallback={<span className="text-gray-400">แก้ไข</span>}
>
  <button onClick={handleEdit}>แก้ไข</button>
</CanAccess>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `action` | string | Action key เช่น `admin_roles.delete` |
| `children` | ReactNode | Content ที่จะแสดงถ้ามีสิทธิ์ |
| `fallback` | ReactNode | Content แสดงแทนถ้าไม่มีสิทธิ์ (optional) |
| `showDisabled` | boolean | แสดง children แบบ disabled แทนการซ่อน |
| `disabledTooltip` | string | tooltip เมื่อ hover บน disabled element |

---

## วิธีใช้งาน

### 1. ตรวจสอบสิทธิ์ใน Frontend

```typescript
// ตรวจสอบสิทธิ์ table เดียว
import { useTablePermission } from '~/hooks/usePermission';

function MyComponent() {
  const { canRead, canCreate, canUpdate, canDelete, loading } = useTablePermission('admin_users');

  if (loading) return <Spinner />;
  if (!canRead) return null; // ซ่อน component

  return <UserManagement />;
}
```

```typescript
// ตรวจสอบสิทธิ์หน้า
import { usePagePermission } from '~/hooks/usePermission';

function PageGuard({ children }) {
  const { canAccess, loading } = usePagePermission('/admin/users');

  if (loading) return <Spinner />;
  if (!canAccess) return <AccessDenied />;

  return children;
}
```

```typescript
// ซ่อน/แสดงเมนูตาม permission
import { useMenuVisibility } from '~/hooks/usePermission';

const menuItems = [
  { name: 'PR Tracking', path: '/pr-tracking', permission: { table: 'pr_tracking', action: 'read' } },
  { name: 'Admin', path: '/admin/users', adminOnly: true },
];

function Sidebar() {
  const visibleMenuItems = useMenuVisibility(menuItems);
  // visibleMenuItems จะมีเฉพาะเมนูที่ user มีสิทธิ์
}
```

```typescript
// ตรวจสอบแบบ one-time (ไม่ใช่ hook)
import { checkPermission } from '~/hooks/usePermission';

async function handleDelete() {
  const canDelete = await checkPermission('admin_users', 'delete', user);
  if (!canDelete) {
    alert('ไม่มีสิทธิ์ลบ');
    return;
  }
  // proceed with deletion
}
```

### 2. ป้องกัน API Route

```typescript
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

async function handler(req, res) {
  // existing logic
}

export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_users', action: 'read' },
  POST: { tableName: 'admin_users', action: 'create' },
  PUT: { tableName: 'admin_users', action: 'update' },
  DELETE: { tableName: 'admin_users', action: 'delete' },
});
```

### 3. ป้องกัน tRPC

```typescript
// ใช้ createTableProcedure
import { createTableProcedure } from '~/server/api/trpc';

getAllUsers: createTableProcedure('admin_users', 'read')
  .query(async ({ ctx }) => {
    return ctx.db.user.findMany();
  }),
```

```typescript
// ใช้ authenticatedProcedure + manual check (สำหรับ dynamic permission)
import { authenticatedProcedure } from '~/server/api/trpc';
import { checkTablePermission } from '~/lib/check-permission';

deleteUser: authenticatedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const result = await checkTablePermission(ctx.db, {
      tableName: 'admin_users',
      action: 'delete',
      userId: ctx.user.id,
      userRole: ctx.user.role,
    });

    if (!result.allowed) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    // proceed with deletion
  }),
```

---

## การเพิ่ม Feature ใหม่

> **สำคัญ**: การเพิ่ม Feature/หน้า/ปุ่มใหม่ **ต้องให้ Developer เขียน code เพิ่ม**

### สิ่งที่ Admin ทำได้ผ่าน UI

- ✅ เปิด/ปิด permission ที่มีอยู่แล้ว (checkbox)
- ✅ ตั้งค่า permission เฉพาะ user (override role)
- ❌ **ไม่สามารถ** สร้างหมวดหมู่ permission ใหม่
- ❌ **ไม่สามารถ** เพิ่ม action ใหม่

### ขั้นตอนสำหรับ Developer

1. **เพิ่ม Action ใหม่ใน `src/lib/permissions.ts`**
   ```typescript
   export const PROTECTED_TABLES = {
     // ... existing
     new_feature: {
       displayName: 'ฟีเจอร์ใหม่',
       category: 'feature',
       actions: ['read', 'create', 'update', 'delete'],
     },
   };
   ```

2. **เพิ่ม Page Permission Mapping**
   ```typescript
   export const PAGE_PERMISSIONS: Record<string, PagePermission> = {
     // ... existing
     '/new-feature': { table: 'new_feature', action: 'read' },
   };
   ```

3. **เพิ่มใน Sidebar Menu**
   ```typescript
   {
     name: "ฟีเจอร์ใหม่",
     path: "/new-feature",
     icon: "🆕",
     permission: { table: "new_feature", action: "read" },
   }
   ```

4. **ป้องกัน API/tRPC**
   - ใช้ `withMethodPermissions` หรือ `createTableProcedure`

5. **อัพเดต `prisma/seed-permissions.ts`**
   - เพิ่ม default permission สำหรับแต่ละ role

6. **Run Seed**
   ```bash
   npx prisma db seed
   ```

---

## การทดสอบ

### ทดสอบ API

```bash
# ไม่มี auth - expect 401
curl http://localhost:3000/api/admin/users

# PR role - expect 403 สำหรับ admin pages
curl -H "x-user-role: PR" -H "x-user-id: test" http://localhost:3000/api/admin/users

# Admin role - expect 200
curl -H "x-user-role: Admin" -H "x-user-id: test" http://localhost:3000/api/admin/users
```

### ทดสอบ Frontend

1. **Login เป็น PR role**
   - ❌ ไม่เห็นเมนู Admin
   - ❌ ไม่เห็นเมนู PO Tracking
   - ✅ **เห็น PR Approval** (เป็น default สำหรับทุก role)

2. **Login เป็น Warehouse**
   - ✅ เห็น Receive Good
   - ✅ **เห็น PR Approval**
   - ❌ ไม่เห็น Admin

3. **พิมพ์ URL `/admin/users` โดยตรง**
   - ถ้าไม่มีสิทธิ์ → แสดงหน้า "ไม่มีสิทธิ์เข้าถึง"

### ทดสอบ Approval Flow

| ขั้น | ใครกดได้ | ตรวจสอบจาก |
|------|----------|------------|
| 1 | ทุกคน (เจ้าของ PR) | เป็นคนเปิด PR หรือไม่ |
| 2 | คนที่ถูก assign | `ocr_approvers` table |
| 3 | คนที่ถูก assign | `ocr_approvers` table |
| 4 | Manager + Approval | role check |
| 5 | Approval | role check |

---

## Troubleshooting

### Permission Denied
1. ตรวจสอบ user role
2. ตรวจสอบ `role_permission` table: `canRead = true`?
3. ดู response reason: `admin_bypass`, `role_permission`, `denied`

### Role ใหม่ไม่มี permissions
- Run seed script หรือตั้งค่าใน Admin UI

### หน้า Admin เข้าไม่ได้
- ต้องเป็น Admin หรือ Approval role

### เมนูไม่แสดง
- ตรวจสอบ permission ของ menu item นั้น
- ตรวจสอบ `adminOnly: true` ใน menu definition

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v4.0 | 2026-02-02 | เพิ่ม **PageGuard** และ **CanAccess** components สำหรับควบคุม UI อย่างละเอียด |
| v3.0 | 2026-02-02 | Full enforcement with 4-layer protection |
| v2.0 | 2026-02-01 | Action-based permissions (58 actions) |
| v1.0 | 2026-01-15 | Initial CRUD-based permission system |

### v4.0 Changelog

**New Components:**
- `PageGuard` - ครอบหน้าทั้งหมดเพื่อตรวจสอบสิทธิ์ก่อนเข้าถึง
- `CanAccess` - ซ่อน/แสดง/disable elements ตามสิทธิ์

**Pages Updated with PageGuard:**
- `/admin/roles` - จัดการ Role
- `/admin/permissions` - จัดการสิทธิ์
- `/admin/audit-trail` - Audit Trail
- `/admin/workflow` - Workflow/OCR Codes
- `/admin/users` - จัดการผู้ใช้
- `/admin/sync-history` - PR Sync History
- `/admin/po-sync-history` - PO Sync History
- `/admin/user-sync-history` - User Sync History
- `/admin/attachment-sync-history` - Attachment Sync History
- `/admin/wo-sync-history` - WO Sync History

**Buttons Updated with CanAccess:**
- ปุ่ม CRUD ในหน้า Admin ทุกหน้าใช้ CanAccess เพื่อซ่อน/disable ตามสิทธิ์

---

## ผู้ดูแล

- Developer Team
- Contact: [Administrator]
