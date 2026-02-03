# Audit Trail System

> **Version**: v2.0
> **Last Updated**: 2026-02-02
> **Status**: Production Ready

ระบบบันทึกประวัติการใช้งานทุก Action ในระบบ (58 actions) พร้อมชื่อไทย

---

## ภาพรวม

Audit Trail v2 รองรับทุกการกระทำในระบบ ตรงกับ Permission System

### Key Features
- **58 Actions** - ครอบคลุมทุกการกระทำ
- **Thai Labels** - แสดงชื่อไทยใน UI
- **Color Coded** - สีตามประเภท action
- **Fire-and-Forget** - ไม่ block การทำงานหลัก

---

## Database Schema

### ตาราง `activity_trail`

```sql
CREATE TABLE activity_trail (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR(255),
  user_name     VARCHAR(255),
  ip_address    VARCHAR(50),
  action        VARCHAR(50) NOT NULL,  -- เช่น "pr_approve.requester"
  table_name    VARCHAR(100),
  record_id     VARCHAR(255),
  old_values    JSONB,
  new_values    JSONB,
  description   TEXT,
  pr_no         INTEGER,
  po_no         INTEGER,
  tracking_id   INTEGER,
  metadata      JSONB,
  admin_note    TEXT,
  computer_name VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_activity_trail_action ON activity_trail(action);
CREATE INDEX idx_activity_trail_table_name ON activity_trail(table_name);
CREATE INDEX idx_activity_trail_user_id ON activity_trail(user_id);
CREATE INDEX idx_activity_trail_created_at ON activity_trail(created_at DESC);
CREATE INDEX idx_activity_trail_pr_no ON activity_trail(pr_no);
CREATE INDEX idx_activity_trail_po_no ON activity_trail(po_no);
```

---

## Action Types (58 Actions)

### Authentication (4 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `LOGIN` | เข้าสู่ระบบ | เขียวเข้ม |
| `LOGOUT` | ออกจากระบบ | เทาเข้ม |
| `PASSWORD_CHANGE` | เปลี่ยนรหัสผ่าน | ส้ม |
| `PASSWORD_RESET` | รีเซ็ตรหัสผ่าน | ส้ม |

### PR Tracking (8 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `pr_tracking.read` | ดูหน้าติดตาม PR | ม่วง |
| `pr_tracking.search` | ค้นหา PR | ม่วง |
| `pr_tracking.sync` | ซิงค์ PR | คราม |
| `pr_detail.read` | ดูรายละเอียด PR | ม่วง |
| `wo_detail.read` | ดูใบสั่งงาน | ม่วง |
| `po_detail.read` | ดูใบสั่งซื้อ | ฟ้า |
| `receive_report.read` | ดูรายงานรับของ | เขียวน้ำทะเล |
| `pr_print.execute` | พิมพ์ PR | ม่วงอ่อน |

### PR Q&A (5 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `pr_qa.read` | ดูคำถาม-คำตอบ | เหลือง |
| `pr_qa.create` | ถามคำถามใหม่ | ส้ม |
| `pr_qa.respond` | ตอบคำถาม | ส้มอ่อน |
| `pr_qa.update` | แก้ไขคำถาม/คำตอบ | เหลือง |
| `pr_qa.delete` | ลบคำถาม/คำตอบ | แดง |

### PR Approval (8 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `pr_approval.read` | ดูหน้าอนุมัติ | เขียวมะนาว |
| `pr_approve.requester` | ผู้ขอซื้อยืนยัน (ขั้น 1) | เขียว |
| `pr_approve.line_approver` | อนุมัติตามสายงาน (ขั้น 2) | เขียวเข้ม |
| `pr_approve.cost_center` | อนุมัติตาม Cost Center (ขั้น 3) | เขียวน้ำทะเล |
| `pr_approve.manager` | งานจัดซื้อพัสดุอนุมัติ (ขั้น 4) | ฟ้า |
| `pr_approve.final` | VP-C อนุมัติ (ขั้น 5) | ฟ้าอ่อน |
| `pr_reject.execute` | ปฏิเสธ PR | แดง |
| `pr_approve.clear` | ล้างการอนุมัติ | ชมพู |

### Receive Good (6 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `receive_good.read` | ดูรายการรับของ | เขียวน้ำทะเล |
| `receive_good.create` | บันทึกรับของ | เขียว |
| `receive_attachment.create` | แนบเอกสาร/รูป | น้ำเงิน |
| `receive_confirm.execute` | ยืนยันรับของ | เขียวเข้ม |
| `receive_good.update` | แก้ไขรับของ | น้ำเงิน |
| `receive_good.delete` | ลบรายการรับของ | แดง |

### PO Tracking (4 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `po_tracking.read` | ดูหน้าติดตาม PO | ฟ้า |
| `po_tracking.search` | ค้นหา PO | ฟ้า |
| `po_tracking.sync` | ซิงค์ PO | คราม |
| `po_delivery.create` | บันทึกติดตามส่งของ | เขียว |

### Admin Actions (25 actions)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `admin_users.*` | จัดการผู้ใช้ | คราม/เขียว/น้ำเงิน/แดง |
| `admin_roles.*` | จัดการ Role | คราม/เขียว/น้ำเงิน/แดง |
| `admin_permissions.*` | จัดการสิทธิ์ | คราม/น้ำเงิน |
| `admin_audit.*` | ประวัติการใช้งาน | เทา |
| `admin_sync.*` | ประวัติซิงค์ | คราม/ม่วง/ชมพู |
| `admin_workflow.*` | จัดการ Workflow | คราม/น้ำเงิน |

### Generic CRUD (Legacy)

| Action | ชื่อไทย | สี |
|--------|---------|-----|
| `CREATE` | สร้าง | เขียว |
| `READ` | ดู | เทา |
| `UPDATE` | แก้ไข | น้ำเงิน |
| `DELETE` | ลบ | แดง |

---

## การใช้งาน

### 1. Import Helper

```typescript
import {
  createAuditLog,
  AuditAction,
  auditHelpers,
  getIpFromRequest
} from "~/server/api/utils/auditLog";
```

### 2. Log with AuditAction Enum

```typescript
createAuditLog(db, {
  userId: user.id,
  userName: user.name,
  action: AuditAction.PR_APPROVE_REQUESTER, // "pr_approve.requester"
  tableName: "pr_document_approval",
  recordId: String(prNo),
  prNo: prNo,
  description: `${user.name} อนุมัติ PR #${prNo} (ขั้น 1)`,
  ipAddress: getIpFromRequest(req),
}).catch(console.error);
```

### 3. Use Helper Shortcuts

```typescript
// Login
auditHelpers.login(db, user.id, user.name, ip);

// Logout
auditHelpers.logout(db, user.id, user.name, ip);

// PR Approval
auditHelpers.prApprove(db, user.id, user.name, prNo, "requester");

// Receive Confirm
auditHelpers.receiveConfirm(db, user.id, user.name, prNo, 5);
```

### 4. Log with String Action

```typescript
// สามารถใช้ string ได้โดยตรง
createAuditLog(db, {
  action: "pr_approve.line_approver",
  prNo: 123,
  description: "อนุมัติตามสายงาน",
}).catch(console.error);
```

---

## AuditAction Enum Reference

```typescript
export enum AuditAction {
  // Auth
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  PASSWORD_RESET = "PASSWORD_RESET",

  // PR Tracking
  PR_TRACKING_READ = "pr_tracking.read",
  PR_TRACKING_SEARCH = "pr_tracking.search",
  PR_TRACKING_SYNC = "pr_tracking.sync",
  PR_DETAIL_READ = "pr_detail.read",
  WO_DETAIL_READ = "wo_detail.read",
  PO_DETAIL_READ = "po_detail.read",
  RECEIVE_REPORT_READ = "receive_report.read",
  PR_PRINT = "pr_print.execute",

  // PR Q&A
  PR_QA_READ = "pr_qa.read",
  PR_QA_CREATE = "pr_qa.create",
  PR_QA_RESPOND = "pr_qa.respond",
  PR_QA_UPDATE = "pr_qa.update",
  PR_QA_DELETE = "pr_qa.delete",

  // PR Approval
  PR_APPROVAL_READ = "pr_approval.read",
  PR_APPROVE_REQUESTER = "pr_approve.requester",
  PR_APPROVE_LINE = "pr_approve.line_approver",
  PR_APPROVE_COST_CENTER = "pr_approve.cost_center",
  PR_APPROVE_MANAGER = "pr_approve.manager",
  PR_APPROVE_FINAL = "pr_approve.final",
  PR_REJECT = "pr_reject.execute",
  PR_APPROVE_CLEAR = "pr_approve.clear",

  // Receive Good
  RECEIVE_GOOD_READ = "receive_good.read",
  RECEIVE_GOOD_CREATE = "receive_good.create",
  RECEIVE_ATTACHMENT_CREATE = "receive_attachment.create",
  RECEIVE_CONFIRM = "receive_confirm.execute",
  RECEIVE_GOOD_UPDATE = "receive_good.update",
  RECEIVE_GOOD_DELETE = "receive_good.delete",

  // PO Tracking
  PO_TRACKING_READ = "po_tracking.read",
  PO_TRACKING_SEARCH = "po_tracking.search",
  PO_TRACKING_SYNC = "po_tracking.sync",
  PO_DELIVERY_CREATE = "po_delivery.create",

  // ... และ admin actions อีก 25 รายการ
}
```

---

## หน้า Admin - Audit Trail

เข้าถึงได้ที่: `/admin/audit-trail`

### Features v2
1. **Thai Labels** - แสดงชื่อไทยของทุก action
2. **Action Code** - แสดง action code ใต้ชื่อไทย
3. **Color Badges** - สีตามประเภท action
4. **Date Filter** - กรองตามช่วงวันที่
5. **Action Filter** - dropdown แสดงชื่อไทย + code
6. **Table Filter** - กรองตามตาราง
7. **User Filter** - กรองตามผู้ใช้
8. **Diff View** - แสดง old vs new values

---

## SQL Queries ตัวอย่าง

### ดู PR Approval History

```sql
SELECT
  pr_no,
  user_name,
  action,
  description,
  created_at
FROM activity_trail
WHERE action LIKE 'pr_approve.%'
  AND pr_no = 251010087
ORDER BY created_at;
```

### ดู Receive Confirm ย้อนหลัง

```sql
SELECT
  pr_no,
  user_name,
  description,
  created_at
FROM activity_trail
WHERE action = 'receive_confirm.execute'
ORDER BY created_at DESC
LIMIT 50;
```

### นับจำนวน action แต่ละประเภท

```sql
SELECT
  action,
  COUNT(*) as count
FROM activity_trail
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY action
ORDER BY count DESC;
```

### ดู activity ของผู้ใช้เฉพาะ

```sql
SELECT
  action,
  description,
  created_at
FROM activity_trail
WHERE user_id = 'user-123'
ORDER BY created_at DESC
LIMIT 100;
```

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|------|--------|
| `src/server/api/utils/auditLog.ts` | AuditAction enum, ACTION_LABELS, ACTION_COLORS, helpers |
| `src/pages/admin/audit-trail.tsx` | หน้าแสดง Audit Trail (ใช้ Thai labels) |
| `src/pages/api/admin/audit-trail.ts` | API endpoint |
| `prisma/schema.prisma` | Database schema |

---

## Best Practices

1. **Use AuditAction enum** - ใช้ enum แทน string เพื่อป้องกัน typo
2. **Fire-and-forget** - ใช้ `.catch(console.error)` เสมอ
3. **Use helpers** - ใช้ `auditHelpers` สำหรับ actions ที่ใช้บ่อย
4. **Meaningful descriptions** - เขียน description ให้เข้าใจง่าย
5. **Include PR/PO number** - ใส่ `prNo` หรือ `poNo` เสมอถ้ามี
6. **Include IP address** - บันทึก IP ทุกครั้งที่ทำได้

---

## Migration from v1

Action names เปลี่ยนดังนี้:

| v1 | v2 |
|----|-----|
| `APPROVE_PR` | `pr_approve.requester` / `pr_approve.line_approver` / etc. |
| `REJECT_PR` | `pr_reject.execute` |
| `CLEAR_APPROVAL` | `pr_approve.clear` |
| `TRACK_PR` | `pr_tracking.read` |
| `RESPONSE_PR` | `pr_qa.respond` |
| `VIEW_PR` | `pr_detail.read` |
| `VIEW_PO` | `po_detail.read` |

Legacy actions ยังใช้งานได้ แต่แนะนำให้ใช้ v2 format

---

**Last Updated**: 2026-02-02
**Version**: v2.0
