# Receive Goods Module

> **Version**: v4.0
> **Last Updated**: 2026-01-31
> **Status**: Production Ready

ระบบบันทึกการรับของตาม PR (Purchase Request) พร้อมขั้นตอนยืนยัน

---

## ภาพรวม

Receive Goods เป็นระบบสำหรับ:
- บันทึกการรับของตาม PR แต่ละรายการ
- แนบเอกสาร/รูปภาพประกอบ
- ยืนยันการรับของ (Confirm/Reject)
- รายงานสรุปการรับของ

### Workflow

```
1. Warehouse บันทึกรับของ    2. บันทึกลง Database    3. Admin/Manager ยืนยัน
   └─> เลือก PR                └─> warehouse_receivegood    └─> Confirm ✅
   └─> ใส่จำนวนที่รับ           └─> warehouse_receive_attachment    └─> Reject ❌
   └─> แนบเอกสาร/รูป
   └─> Submit
```

---

## Database Schema

### ตาราง `warehouse_receivegood`

```sql
CREATE TABLE warehouse_receivegood (
  id                SERIAL PRIMARY KEY,
  pr_doc_num        INTEGER NOT NULL,
  pr_line_id        INTEGER NOT NULL,
  line_num          INTEGER NOT NULL,
  item_code         VARCHAR(255),
  description       TEXT,
  original_qty      NUMERIC(19,6),
  received_qty      NUMERIC(19,6),
  unit_msr          VARCHAR(100),
  received_by       VARCHAR(255),
  received_by_user_id VARCHAR(255),
  received_at       TIMESTAMP DEFAULT NOW(),
  remarks           TEXT,
  batch_key         VARCHAR(255),

  -- Confirmation fields
  confirm_status    VARCHAR(20) DEFAULT 'waiting', -- waiting, confirmed, rejected
  confirm_remarks   TEXT,
  confirmed_at      TIMESTAMP,
  confirmed_by      VARCHAR(255),

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

### ตาราง `warehouse_receive_attachment`

```sql
CREATE TABLE warehouse_receive_attachment (
  id            SERIAL PRIMARY KEY,
  pr_doc_num    INTEGER,
  batch_key     VARCHAR(255),
  category      VARCHAR(50),        -- 'document' หรือ 'photo'
  file_name     VARCHAR(255),
  file_path     TEXT,
  file_size     BIGINT,
  file_type     VARCHAR(100),
  uploaded_at   TIMESTAMP DEFAULT NOW()
);
```

---

## Pages

### 1. `/receive-good` - รายการรับของ

**หน้าแสดงรายการรับของทั้งหมด**

**Features:**
- ค้นหาตาม PR, ชื่อสินค้า, ผู้เปิด PR
- แสดง Group by PR + เวลาที่รับ
- แสดงสถานะ Confirm: Waiting/Confirmed/Rejected
- Expand เพื่อดูรายละเอียด items และ attachments
- ปุ่ม Confirm เพื่อไปหน้ายืนยัน

**Roles:**
- **Admin**: ดูได้ทั้งหมด, ลบได้
- **Warehouse**: ดูได้, เพิ่มได้
- **อื่นๆ**: ดูได้อย่างเดียว

### 2. `/receive-good/new` - บันทึกรับของ

**หน้าสำหรับบันทึกการรับของใหม่**

**Features:**
- ค้นหา PR ได้ 3 วิธี:
  1. ค้นหาตามชื่อผู้เปิด PR
  2. ค้นหาตามเลข PR
  3. ค้นหาตามชื่องาน (Job Name)
- แสดงรายการ PR Lines ที่ยังรับไม่ครบ
- ใส่จำนวนที่รับแต่ละ line
- อัพโหลดเอกสาร (PDF, Excel, Word)
- อัพโหลดรูปถ่าย (JPEG, PNG)
- ใส่หมายเหตุ
- Validation: ไม่ให้รับเกินจำนวนคงเหลือ

**Roles:** Admin, Warehouse เท่านั้น

### 3. `/receive-good/confirm/[batchKey]` - ยืนยันการรับ

**หน้าสำหรับยืนยันหรือปฏิเสธการรับของ**

**Features:**
- แสดงรายการที่รอยืนยัน
- Confirm ทีละ item หรือทั้งหมด
- Reject พร้อมใส่เหตุผล
- ดู attachments ประกอบ

**Roles:** Admin, Manager

### 4. `/receive-good/report` - รายงาน

**รายงานสรุปการรับของ**

**Features:**
- กรองตามช่วงวันที่
- สรุปจำนวนที่รับ แยกตาม PR
- Export Excel (ถ้ามี)

---

## API Endpoints (tRPC)

### `pr.saveReceiveGoods`

บันทึกการรับของ

```typescript
input: {
  prDocNum: number,
  items: [{
    prLineId: number,
    lineNum: number,
    itemCode: string | null,
    description: string | null,
    originalQty: number,
    receivedQty: number,
    unitMsr: string | null,
  }],
  receivedBy: string,
  receivedByUserId?: string,
  remarks?: string,
  batchKey?: string,
}
```

### `pr.getAllReceived`

ดึงรายการรับของทั้งหมด

```typescript
input: {
  search?: string,
  limit?: number,
}
```

### `pr.getReceivedQtyByLines`

ดึงจำนวนที่รับไปแล้วของแต่ละ PR Line

```typescript
input: {
  prDocNum: number,
}
output: Record<number, number>  // prLineId -> totalReceived
```

### `pr.updateBatchConfirmStatus`

อัพเดทสถานะ confirm

```typescript
input: {
  items: [{
    id: number,
    confirm_status: 'waiting' | 'confirmed' | 'rejected',
    confirm_remarks?: string,
  }],
  confirmed_by: string,
}
```

### `pr.deleteReceived`

ลบรายการรับของ (Admin only)

```typescript
input: {
  id: number,
  deletedBy: string,
}
```

---

## Attachments

### การอัพโหลด

**Endpoint:** `POST /api/upload-receive-attachment`

```typescript
// Request: FormData
formData.append('file', file);
formData.append('prDocNum', '251010087');
formData.append('batchKey', 'batch-12345');
formData.append('category', 'document'); // หรือ 'photo'

// Response
{
  success: true,
  attachment: {
    id: 123,
    file_name: 'invoice.pdf',
    file_path: '...',
  }
}
```

### การดูไฟล์

**Endpoint:** `GET /api/serve-receive-attachment?path=...`

- รองรับ images (inline display)
- รองรับ PDF
- รองรับ download

### ที่เก็บไฟล์

```
D:\VS\network\VS\PR_PO\test-github-clone\uploads\receive-attachments\
├── documents\
│   └── 2026-01\
│       └── batch-12345-invoice.pdf
└── photos\
    └── 2026-01\
        └── batch-12345-photo1.jpg
```

---

## Confirmation Workflow

### สถานะ

| Status | คำอธิบาย | สี |
|--------|----------|-----|
| `waiting` | รอยืนยัน | เหลือง |
| `confirmed` | ยืนยันแล้ว | เขียว |
| `rejected` | ปฏิเสธ | แดง |

### Logic

1. **Warehouse** บันทึกรับของ → สถานะ = `waiting`
2. **Admin/Manager** ตรวจสอบ
   - ถูกต้อง → `confirmed`
   - ไม่ถูกต้อง → `rejected` + ใส่เหตุผล
3. ระบบบันทึก audit log ทุกขั้นตอน

---

## Audit Trail Integration

ทุก action จะถูกบันทึกใน `activity_trail`:

| Action | Description |
|--------|-------------|
| `CREATE` | บันทึกรับของใหม่ |
| `UPDATE` | แก้ไข/ยืนยันการรับ |
| `DELETE` | ลบรายการรับของ |

**ตัวอย่าง Log:**

```typescript
createAuditLog(db, {
  userName: 'warehouse_user',
  action: AuditAction.CREATE,
  tableName: 'warehouse_receivegood',
  prNo: 251010087,
  newValues: {
    itemCount: 5,
    items: [...],
  },
  description: 'รับของ PR #251010087 จำนวน 5 รายการ',
}).catch(console.error);
```

---

## Roles & Permissions

| Action | Admin | Manager | Warehouse | อื่นๆ |
|--------|-------|---------|-----------|-------|
| ดูรายการรับของ | ✅ | ✅ | ✅ | ✅ |
| บันทึกรับของ | ✅ | ❌ | ✅ | ❌ |
| ยืนยัน/ปฏิเสธ | ✅ | ✅ | ❌ | ❌ |
| ลบรายการ | ✅ | ❌ | ❌ | ❌ |
| ดู Report | ✅ | ✅ | ✅ | ✅ |

---

## Files ที่เกี่ยวข้อง

| File | หน้าที่ |
|------|--------|
| `src/pages/receive-good/index.tsx` | หน้ารายการรับของ |
| `src/pages/receive-good/new.tsx` | หน้าบันทึกรับของใหม่ |
| `src/pages/receive-good/confirm/[batchKey].tsx` | หน้ายืนยันการรับ |
| `src/pages/receive-good/report.tsx` | รายงาน |
| `src/server/api/routers/pr/pr-warehouse.ts` | API endpoints |
| `src/pages/api/upload-receive-attachment.ts` | Upload API |
| `src/pages/api/serve-receive-attachment.ts` | Serve files API |

---

## Best Practices

1. **บันทึกทันที** - รับของเสร็จให้บันทึกทันที ไม่รอสะสม
2. **ถ่ายรูปประกอบ** - ถ่ายรูปสินค้าที่รับเพื่อเป็นหลักฐาน
3. **ตรวจสอบจำนวน** - ตรวจนับก่อนบันทึก ไม่ให้เกินจำนวนใน PR
4. **ยืนยันทันที** - Admin/Manager ควรยืนยันภายใน 24 ชั่วโมง
5. **ใส่เหตุผล** - ถ้า reject ให้ใส่เหตุผลชัดเจน

---

## WO (Work Order) Sync

### Scripts

| Script | หน้าที่ |
|--------|--------|
| `scripts/sync-wo-summary.mjs` | Sync WO Summary จาก SAP |
| `scripts/sync-wo-gi-detail.mjs` | Sync WO GI (Goods Issue) Detail |
| `scripts/sync-wo-po-detail.mjs` | Sync WO PO Detail |

### การใช้งาน

```bash
# Sync WO Summary
node scripts/sync-wo-summary.mjs

# Sync WO GI Detail
node scripts/sync-wo-gi-detail.mjs

# Sync WO PO Detail
node scripts/sync-wo-po-detail.mjs
```

### ตาราง WO

```sql
-- WO Summary
wo_summary (
  id, wo_doc_num, wo_doc_entry, series_name,
  doc_date, item_name, req_name, department, ...
)

-- WO GI Detail (Goods Issue)
wo_gi_detail (
  id, wo_doc_num, gi_doc_num, item_code, quantity, ...
)

-- WO PO Detail
wo_po_detail (
  id, wo_doc_num, po_doc_num, item_code, quantity, ...
)
```

---

**Last Updated**: 2026-01-31
**Version**: v4.0
**Status**: Production Ready
