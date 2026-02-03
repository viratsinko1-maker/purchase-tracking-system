# Sync History & Change Tracking

> **Version**: v4.0
> **Last Updated**: 2026-01-31
> **Status**: ✅ Production Ready

ระบบบันทึกและติดตามการเปลี่ยนแปลงของข้อมูล PR-PO จาก SAP B1 อัตโนมัติ

---

## 🎯 ภาพรวม

Sync History เป็นระบบที่บันทึกประวัติการ sync ข้อมูลทุกครั้ง พร้อมรายละเอียดการเปลี่ยนแปลงของแต่ละ PR และ PO

### ✨ Features

- 📊 **Sync Session Tracking** - บันทึกทุกครั้งที่ sync (Full/Incremental)
- 🔍 **Change Detection** - ตรวจจับการเปลี่ยนแปลงแต่ละ PR/PO (Incremental Sync)
- 📅 **Date Filter** - กรองประวัติตามช่วงวันที่
- ⏱️ **Performance Metrics** - แสดงเวลาที่ใช้ในการ sync
- 🌏 **Thai Timezone** - แสดงเวลาเป็นเวลาประเทศไทย
- 📝 **Detailed Logs** - รายละเอียดครบถ้วนทุกการเปลี่ยนแปลง

---

## 🗄️ Database Schema

### 1. `sync_log` - Sync Sessions

บันทึก sync session แต่ละครั้ง

```sql
CREATE TABLE sync_log (
    id SERIAL PRIMARY KEY,
    sync_date TIMESTAMP NOT NULL,
    sync_type VARCHAR(20) NOT NULL,      -- FULL, INCREMENTAL
    status VARCHAR(20) NOT NULL,         -- success, failed
    records_processed INTEGER,
    pr_updated INTEGER,
    pr_lines_updated INTEGER,
    po_links_updated INTEGER,
    duration_seconds NUMERIC,
    error_message TEXT,
    last_update_date TIMESTAMP
);
```

### 2. `sync_change_log` - Change Details

บันทึกรายละเอียดการเปลี่ยนแปลง (เฉพาะ Incremental Sync)

```sql
CREATE TABLE sync_change_log (
    id SERIAL PRIMARY KEY,
    sync_log_id INTEGER NOT NULL REFERENCES sync_log(id) ON DELETE CASCADE,

    -- ประเภทการเปลี่ยนแปลง
    change_type VARCHAR(50) NOT NULL,    -- PR_NEW, PR_UPDATED, PR_STATUS_CHANGED, PO_LINKED

    -- ข้อมูล PR
    pr_no INTEGER NOT NULL,
    pr_description TEXT,

    -- ข้อมูล PO (ถ้ามี)
    po_no INTEGER,
    po_description TEXT,

    -- การเปลี่ยนสถานะ
    old_status VARCHAR(10),
    new_status VARCHAR(10),

    -- รายละเอียดเพิ่มเติม
    details JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_sync_change_log_sync_log_id ON sync_change_log(sync_log_id);
CREATE INDEX idx_sync_change_log_pr_no ON sync_change_log(pr_no);
CREATE INDEX idx_sync_change_log_change_type ON sync_change_log(change_type);
CREATE INDEX idx_sync_change_log_created_at ON sync_change_log(created_at DESC);
```

---

## 🔄 การทำงาน

### Full Sync (ตีหนึ่ง)
```
1. ดึงข้อมูลทั้งหมดจาก SAP
2. บันทึกลง sync_log
3. ไม่บันทึก sync_change_log
   (เพราะเป็น full sync ไม่มีการเปรียบเทียบ)
```

### Incremental Sync (เวลาอื่นๆ)
```
1. ดึงข้อมูลที่เปลี่ยนแปลงจาก SAP
2. บันทึกลง sync_log
3. สำหรับแต่ละ PR:
   a. ตรวจสอบว่ามี PR เก่าอยู่ไหม
   b. เปรียบเทียบ old_status vs new_status
   c. ตรวจสอบ PO ที่เชื่อมโยง
   d. บันทึกลง sync_change_log
```

---

## 📊 Change Types

### 🟢 PR_NEW
PR ใหม่เข้าระบบ (ไม่มีข้อมูลเก่า)

**ตัวอย่าง:**
```sql
INSERT INTO sync_change_log (
  sync_log_id, change_type, pr_no, pr_description, new_status
) VALUES (
  123, 'PR_NEW', 251010087, 'พูลพิพัฒน์, นายพรพจน์', 'O'
);
```

### 🔵 PR_UPDATED
PR มีการอัพเดทข้อมูล (สถานะไม่เปลี่ยน)

**ตัวอย่าง:**
```sql
INSERT INTO sync_change_log (
  sync_log_id, change_type, pr_no, pr_description, new_status
) VALUES (
  123, 'PR_UPDATED', 251010087, 'พูลพิพัฒน์, นายพรพจน์', 'O'
);
```

### 🟡 PR_STATUS_CHANGED
PR เปลี่ยนสถานะ (O→C หรือ C→O)

**ตัวอย่าง:**
```sql
INSERT INTO sync_change_log (
  sync_log_id, change_type, pr_no, pr_description, old_status, new_status
) VALUES (
  123, 'PR_STATUS_CHANGED', 251010087, 'พูลพิพัฒน์, นายพรพจน์', 'O', 'C'
);
```

### 🟣 PO_LINKED
PO ใหม่เชื่อมโยงกับ PR

**ตัวอย่าง:**
```sql
INSERT INTO sync_change_log (
  sync_log_id, change_type, pr_no, pr_description, po_no, po_description
) VALUES (
  123, 'PO_LINKED', 251010087, 'พูลพิพัฒน์, นายพรพจน์', 200912345, 'สายไฟ 2x4'
);
```

---

## 🖥️ User Interface

### หน้า Sync History (`/sync-history`)

**Path**: `src/pages/sync-history.tsx`

**Features:**
- Date filter (จาก-ถึง)
- แสดงผลทั้งหมดในหน้าเดียว (ไม่มี pagination)
- แสดงเฉพาะ sync ที่สำเร็จ
- แสดงเวลาเป็นเวลาไทย (Asia/Bangkok)

**Layout:**
```
┌─────────────────────────────────────────┐
│ ประวัติการซิงค์                         │
│ [← กลับหน้าหลัก]                        │
├─────────────────────────────────────────┤
│ วันที่จาก: [____] ถึง: [____] [🔍 ค้นหา]│
├─────────────────────────────────────────┤
│ พบ X รายการ                             │
├─────────────────────────────────────────┤
│ ┌─ 25/10/2568 08:41:44 ────────────┐   │
│ │ ⚡ Incremental Sync | ✓ สำเร็จ    │   │
│ │ 📦 8 records | ⏱️ 2s | 📝 1 change│   │
│ ├───────────────────────────────────┤   │
│ │ 🔵 PR อัพเดท | PR: 251010087     │   │
│ │ ผู้ขอ: พูลพิพัฒน์, นายพรพจน์      │   │
│ └───────────────────────────────────┘   │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## 🔌 API Endpoints (tRPC)

### 1. `pr.getSyncHistory`

ดึง sync history พร้อม changes

**Input:**
```typescript
{
  dateFrom?: string,  // YYYY-MM-DD
  dateTo?: string     // YYYY-MM-DD
}
```

**Output:**
```typescript
{
  sessions: [
    {
      id: number,
      sync_date: Date,
      sync_type: 'FULL' | 'INCREMENTAL',
      status: 'success' | 'failed',
      records_processed: number,
      duration_seconds: number,
      change_count: number,
      changes: [
        {
          id: number,
          change_type: 'PR_NEW' | 'PR_UPDATED' | 'PR_STATUS_CHANGED' | 'PO_LINKED',
          pr_no: number,
          pr_description: string,
          po_no?: number,
          po_description?: string,
          old_status?: string,
          new_status?: string,
          created_at: Date
        }
      ]
    }
  ],
  total: number
}
```

**Usage:**
```typescript
const { data } = api.pr.getSyncHistory.useQuery({
  dateFrom: '2025-10-01',
  dateTo: '2025-10-31'
});
```

### 2. `pr.getSyncChanges`

ดึง changes ของ sync session เฉพาะ

**Input:**
```typescript
{
  syncLogId: number
}
```

**Output:**
```typescript
[
  {
    id: number,
    change_type: string,
    pr_no: number,
    pr_description: string,
    po_no?: number,
    po_description?: string,
    old_status?: string,
    new_status?: string,
    created_at: Date
  }
]
```

---

## 📝 Query Examples

### ดู Sync History ล่าสุด

```sql
SELECT
  sync_date,
  sync_type,
  status,
  records_processed,
  duration_seconds
FROM sync_log
ORDER BY sync_date DESC
LIMIT 10;
```

### ดูการเปลี่ยนแปลงของ PR เฉพาะ

```sql
SELECT
  sl.sync_date,
  scl.change_type,
  scl.pr_no,
  scl.pr_description,
  scl.old_status,
  scl.new_status
FROM sync_change_log scl
JOIN sync_log sl ON scl.sync_log_id = sl.id
WHERE scl.pr_no = 251010087
ORDER BY scl.created_at DESC;
```

### นับจำนวนการเปลี่ยนแปลงแต่ละประเภท

```sql
SELECT
  change_type,
  COUNT(*) as count
FROM sync_change_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY change_type
ORDER BY count DESC;
```

### ดู PR ที่เปลี่ยนสถานะ

```sql
SELECT
  pr_no,
  pr_description,
  old_status,
  new_status,
  created_at
FROM sync_change_log
WHERE change_type = 'PR_STATUS_CHANGED'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🚀 วิธีใช้งาน

### 1. เปิดหน้า Sync History

```
http://localhost:2025/sync-history
```

หรือคลิกปุ่ม **"📋 ดูประวัติการซิงค์"** ในหน้า PR Tracking

### 2. เลือกช่วงวันที่

- วันที่จาก: `01/10/2025`
- วันที่ถึง: `31/10/2025`
- กด **🔍 ค้นหา**

### 3. ดูรายละเอียด

- Sync sessions จะแสดงเรียงจากใหม่ไปเก่า
- คลิก expand เพื่อดูรายละเอียดการเปลี่ยนแปลง
- เลื่อนลงเพื่อดู history เก่าๆ

---

## 💡 Best Practices

### 1. การเก็บข้อมูล

**แนะนำ**: เก็บ sync history **30-90 วัน**

```sql
-- ลบ sync history เก่ากว่า 90 วัน
DELETE FROM sync_log
WHERE sync_date < CURRENT_DATE - INTERVAL '90 days';
```

### 2. Monitoring

**ตรวจสอบประจำ:**
- จำนวน sync ที่ล้มเหลว
- เวลาที่ใช้ในการ sync (ควร < 10 วินาที)
- จำนวนการเปลี่ยนแปลง

```sql
-- Sync ที่ล้มเหลววันนี้
SELECT * FROM sync_log
WHERE DATE(sync_date) = CURRENT_DATE
  AND status = 'failed';
```

### 3. Performance

**Indexes ที่สำคัญ:**
```sql
-- เร็วขึ้นเมื่อ query ตาม PR
CREATE INDEX idx_sync_change_log_pr_no ON sync_change_log(pr_no);

-- เร็วขึ้นเมื่อ query ตามวันที่
CREATE INDEX idx_sync_log_sync_date ON sync_log(sync_date DESC);
```

---

## 🔧 Maintenance

### ล้าง Sync History

```sql
-- ล้างทั้งหมด
DELETE FROM sync_change_log;
DELETE FROM sync_log;

-- ล้างเฉพาะเก่ากว่า 90 วัน
DELETE FROM sync_log
WHERE sync_date < CURRENT_DATE - INTERVAL '90 days';
```

### Backup

```bash
# Backup sync history
pg_dump -U postgres -d PR_PO \
  -t sync_log \
  -t sync_change_log \
  -f sync_history_backup.sql
```

### Restore

```bash
# Restore sync history
psql -U postgres -d PR_PO -f sync_history_backup.sql
```

---

## 📈 Statistics

### ดูสถิติการ Sync

```sql
-- Sync ในเดือนนี้
SELECT
  DATE(sync_date) as date,
  sync_type,
  COUNT(*) as count,
  AVG(duration_seconds) as avg_duration,
  SUM(records_processed) as total_records
FROM sync_log
WHERE DATE_TRUNC('month', sync_date) = DATE_TRUNC('month', CURRENT_DATE)
  AND status = 'success'
GROUP BY DATE(sync_date), sync_type
ORDER BY date DESC;
```

---

## ❓ FAQ

**Q: Full Sync จะบันทึก changes ไหม?**
A: ไม่ เพราะเป็นการดึงข้อมูลทั้งหมด ไม่มีการเปรียบเทียบ

**Q: Incremental Sync บันทึกอะไรบ้าง?**
A: บันทึกทุกการเปลี่ยนแปลง (PR ใหม่, อัพเดท, เปลี่ยนสถานะ, PO เชื่อมโยง)

**Q: ข้อมูลเก็บไว้นานแค่ไหน?**
A: แนะนำ 30-90 วัน (ตั้งค่าได้เอง)

**Q: ถ้าต้องการดู history เก่ากว่า 90 วัน?**
A: ควร backup ก่อนลบ แล้ว restore เมื่อต้องการดู

**Q: ทำไม Full Sync ไม่มี changes?**
A: เพื่อประหยัดพื้นที่ เพราะ Full Sync ดึงข้อมูลทั้งหมด ไม่จำเป็นต้องเก็บ details

---

## 🔗 เอกสารเพิ่มเติม

- [CHANGELOG.md](./CHANGELOG.md) - ประวัติการอัพเดท
- [SYNC_STRATEGIES.md](./SYNC_STRATEGIES.md) - กลยุทธ์การ Sync
- [README.md](./README.md) - เอกสารหลัก

---

**Last Updated**: 2026-01-31
**Version**: v4.0
**Status**: ✅ Production Ready
