# Changelog

All notable changes to the PR Tracking System will be documented in this file.

## [v1.1.0] - 2025-10-25

### 🚀 Major Improvements - Smart Sync Strategy + Sync History

**ระบบ Sync อัจฉริยะ: Full Sync + Incremental Sync + Change Tracking**

### ✨ Features

#### Smart Sync Strategy
- **Automatic Sync Type Selection**:
  - 🌙 **Full Sync**: ทำงานอัตโนมัติตอนตีหนึ่ง (01:00-01:59)
  - ⚡ **Incremental Sync**: ทำงานตอนเวลาอื่นๆ (ดึงเฉพาะข้อมูลที่เปลี่ยน)
- **Performance Optimization**:
  - Incremental Sync ใช้เวลาเฉลี่ย 2-5 วินาที (เทียบกับ Full Sync 60-90 วินาที)
  - เช็คทั้ง PR.UpdateDate และ PO.DocDate (จับ PR ที่มี PO ใหม่ได้)

#### Sync History & Change Tracking 🆕
- **Database Tables**:
  - `sync_log` - บันทึก sync session แต่ละครั้ง
  - `sync_change_log` - บันทึกรายละเอียดการเปลี่ยนแปลงแต่ละ PR/PO
- **Change Detection** (Incremental Sync):
  - 🟢 PR_NEW - PR ใหม่เข้าระบบ
  - 🔵 PR_UPDATED - PR ที่มีการอัพเดทข้อมูล
  - 🟡 PR_STATUS_CHANGED - PR เปลี่ยนสถานะ (O↔C)
  - 🟣 PO_LINKED - PO ใหม่เชื่อมโยงกับ PR
- **Sync History Page** (`/sync-history`):
  - แสดงประวัติการ sync พร้อมรายละเอียด
  - Date filter (จาก-ถึง) เหมือนหน้าหลัก
  - แสดงผลทั้งหมดในหน้าเดียว (ไม่มี pagination)
  - แสดงเวลาเป็นเวลาไทย (Asia/Bangkok)
  - แสดงเฉพาะ sync ที่สำเร็จ
- **Integration**:
  - ปุ่ม "📋 ดูประวัติการซิงค์" ในหน้า PR Tracking
  - Auto-logging ทุกครั้งที่ sync (Incremental เท่านั้น)

### 🔧 Technical Changes

#### Database Schema
- **New Tables**:
  - `sync_log` - บันทึก sync sessions (id, sync_date, sync_type, status, records_processed, duration_seconds)
  - `sync_change_log` - บันทึก detailed changes (sync_log_id, change_type, pr_no, po_no, old_status, new_status)
- **Indexes**: Optimized for performance (sync_log_id, pr_no, change_type, created_at)

#### Backend (src/server/api/routers/pr.ts)
- **Sync Logic Enhancement**:
  - แก้ไข sync logic ให้รองรับ Incremental Sync (pr.ts:313)
  - เพิ่มการเช็ค `isDailyFullSync` (hour === 1)
  - เพิ่ม WHERE clause แบบ dynamic:
    ```sql
    -- Incremental Sync
    WHERE (PR.UpdateDate > last_sync_date OR
           EXISTS(PO.DocDate > last_sync_date))
    ```
  - Fixed: เปลี่ยนจาก `isSundayFullSync` เป็น `isDailyFullSync`

- **Change Tracking**:
  - บันทึก sync_log พร้อม RETURNING id
  - ตรวจจับการเปลี่ยนแปลงแต่ละ PR (เฉพาะ Incremental Sync)
  - เปรียบเทียบ old_status vs new_status
  - บันทึกลง sync_change_log

- **New tRPC Endpoints**:
  - `pr.getSyncHistory({ dateFrom, dateTo })` - ดึง sync history พร้อม changes
  - `pr.getSyncChanges({ syncLogId })` - ดึง changes ของ sync session เฉพาะ

#### Frontend
- **New Page**: `/sync-history`
  - Date filter (dateFrom, dateTo)
  - Display all results (no pagination)
  - Thai timezone (Asia/Bangkok)
  - Filter success-only sessions
- **PR Tracking Enhancement**:
  - เพิ่มปุ่ม "📋 ดูประวัติการซิงค์" (หลังข้อความ "พบ xxx รายการ")

### 📊 Performance Results

**ทดสอบจริง (25/10/2568 01:41:41)**:
- Sync Type: INCREMENTAL
- Records: 8
- PR Updated: 1 (PR 251010087)
- Lines Updated: 8
- Duration: **1.95 วินาที** ⚡
- Status: SUCCESS ✅

### 💡 Benefits

1. **ประหยัดเวลา**: Incremental Sync เร็วกว่า Full Sync 30-50 เท่า
2. **ลด Load**: ลดภาระ Database และ Network
3. **อัตโนมัติ**: ไม่ต้องตั้งค่า ระบบเลือกเอง
4. **Reliable**: Full Sync ทุกวันตอนตีหนึ่งเพื่อความแม่นยำ

### 🐛 Bug Fixes

- Fixed: Type error `isSundayFullSync` → `isDailyFullSync`

---

## [v1.0.0] - 2025-10-24

### 🎉 Initial Release - Production Ready

**ระบบ PR Tracking System v1.0** - ระบบติดตามสถานะ Purchase Request และ Purchase Order

### ✨ Features

#### Frontend
- **PR Card View**: แสดง PR เป็น card พร้อม progress bar
- **PR Detail View**: หน้ารายละเอียด PR แบบเต็ม รวม lines และ PO ที่เชื่อมโยง
- **Filter System**:
  - วันที่เปิด PR (จาก-ถึง)
  - สถานะ (Open/Closed)
  - ค้นหา (PR No, ชื่อผู้เปิด, หน่วยงาน)
  - Sticky filter bar (ติดด้านบนเมื่อเลื่อน)
- **Statistics Cards**:
  - PR ทั้งหมด (ตามช่วงวันที่ที่เลือก)
  - PR เปิดอยู่
  - PR ที่ยังไม่ครบ
- **Data Sync**: ซิงค์ข้อมูลจาก SAP B1 ด้วยการกดปุ่ม

#### Backend
- **Database Schema v2.0**:
  - `pr_master` - ข้อมูลหัว PR พร้อม job_name และ remarks
  - `pr_lines` - รายละเอียด PR lines
  - `pr_po_link` - ความสัมพันธ์ PR-PO
  - `mv_pr_summary` - Materialized view สำหรับ performance
- **tRPC API**:
  - `pr.getAllSummary` - ดึงข้อมูล PR summary
  - `pr.getByPRNo` - ดึงรายละเอียด PR เฉพาะเลข
  - `pr.getStats` - ดึงสถิติตามช่วงวันที่
  - `pr.sync` - ซิงค์ข้อมูลจาก SAP
- **SAP Integration**: ดึงข้อมูลจาก SAP B1 (SQL Server)

### 🔧 Technical Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: tRPC, Prisma
- **Database**: PostgreSQL (pr_po_db)
- **SAP**: SQL Server (TMK_PRD)

### 📝 Notes
- Port: `2025`
- Auto-redirect จาก `/` ไป `/pr-tracking`
- Support keyboard navigation และ responsive design

### 🚀 Deployment
```bash
npm run build
npm start
```

### 📊 Performance
- Materialized view สำหรับ query performance
- CONCURRENTLY refresh ไม่ lock table
- Indexed columns สำหรับ search

---

## Rollback Instructions

หากต้องการ rollback กลับไปเวอร์ชันก่อนหน้า:

```bash
git checkout tags/v1.0.0
npm install
npm run build
npm start
```

### Database Rollback
```sql
-- Backup ข้อมูลปัจจุบันก่อน
pg_dump -U tmkpowerquery -d pr_po_db > backup_v1.sql

-- Restore เวอร์ชันก่อนหน้า (ถ้ามี)
psql -U tmkpowerquery -d pr_po_db < backup_previous.sql
```

---

**Version**: v1.0.0
**Build Date**: 2025-10-24
**Build Status**: ✅ Production Ready
