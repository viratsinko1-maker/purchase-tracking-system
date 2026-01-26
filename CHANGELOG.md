# Changelog

All notable changes to the PR Tracking System will be documented in this file.

## [v3.0] - 2025-11-25

### 📚 Documentation Overhaul - Comprehensive README

**การปรับปรุง Documentation ครั้งใหญ่**

### ✨ Features

#### README.md Comprehensive Update
- **เนื้อหาเพิ่มจาก 160 → 1,016 บรรทัด (+537%)**
- **10 FAQ** - คำถามที่พบบ่อยพร้อมคำตอบละเอียด
- **9 Troubleshooting Scenarios** - วิธีแก้ปัญหาต่างๆ
- **3 Deployment Options** - Direct Run, Windows Service, Task Scheduler
- **Database Schema แบบละเอียด** - ทุกตารางพร้อม field descriptions
- **Use Cases & Workflow** - 3 use cases หลักพร้อม diagram
- **Pages และฟีเจอร์** - รายละเอียด 5 หน้าหลัก

#### เนื้อหาที่เพิ่ม

**1. ภาพรวมระบบแบบละเอียด**
- ข้อมูลที่ระบบจัดการ (PR, PO, Attachments, ฯลฯ)
- สถาปัตยกรรมระบบ (ASCII diagram)
- ฟีเจอร์ทั้งหมด 9 ข้อ
- สถิติเชิงประสิทธิภาพ

**2. การตั้งค่าแบบครบถ้วน**
- การตั้งค่า PostgreSQL + SQL Server
- Environment Variables พร้อมคำอธิบาย
- Database Schema ทั้ง 7 tables
- ความสัมพันธ์ระหว่างตาราง (ERD style)

**3. การซิงค์ข้อมูล**
- Incremental Sync vs Full Sync
- Schedule ของ auto-sync (4 schedulers)
- Performance comparison พร้อมตัวอย่าง

**4. Pages และฟีเจอร์**
- `/pr-tracking` - หน้าหลัก
- `/pr-overview` - Dashboard
- `/sync-history` - ประวัติการซิงค์
- `/attachments` - จัดการไฟล์แนบ
- PR Detail Modal

**5. Use Cases และ Workflow**
- 3 Use Cases: View Only, Reporting, Workflow
- Workflow diagram แบบละเอียด (step-by-step)
- ความสัมพันธ์ PR-PO (1:0, 1:1, 1:N)

**6. FAQ (10 คำถาม)**
- Q1: ทำไมมีตารางอื่นๆ (User, Account, Session)?
- Q2: Incremental Sync vs Full Sync
- Q3: ข้อมูลจะไม่ซ้ำใช่ไหม?
- Q4: PR 1 อันมีหลาย PO จัดการยังไง?
- Q5: ถ้าต้องการข้อมูล realtime ทำยังไง?
- Q6: ทำไมไม่แก้ไขข้อมูลใน PostgreSQL?
- Q7: ไฟล์แนบอยู่ที่ไหน?
- Q8: ตรวจสอบว่า sync ทำงานหรือไม่?
- Q9: Materialized View คืออะไร?
- Q10: ต้อง refresh MV บ่อยแค่ไหน?

**7. Troubleshooting (9 ปัญหา)**
- ปัญหา 1: Port 2025 ถูกใช้งานแล้ว
- ปัญหา 2: Database Connection Error
- ปัญหา 3: ไม่แสดงข้อมูล / เว็บว่างเปล่า
- ปัญหา 4: Sync ล้มเหลว / Connection Error
- ปัญหา 5: UntrustedHost Error
- ปัญหา 6: ไฟล์แนบไม่แสดง / ดาวน์โหลดไม่ได้
- ปัญหา 7: Database Schema ไม่ตรง
- ปัญหา 8: Build Error / TypeScript Error
- ปัญหา 9: Slow Performance / Query ช้า

**8. Deployment Guide**
- Development setup
- Production (3 options):
  - Option 1: Direct Run (PM2)
  - Option 2: Windows Service (node-windows)
  - Option 3: Windows Task Scheduler
- Environment Variables สำหรับ Production
- Auto-sync Schedule configuration
- Monitoring และ Logging (PM2)
- Backup และ Restore
- Security Checklist
- Performance Optimization

**9. เอกสารเสริม**
- Version History (v1.x, v2.x, v3.0)
- T3 Stack Resources
- การพัฒนาต่อยอด
- License

### 📊 Statistics

- **README บรรทัด**: 1,016 (เพิ่มจาก 160)
- **หัวข้อหลัก**: 15 หัวข้อ
- **FAQ**: 10 คำถาม
- **Troubleshooting**: 9 ปัญหา
- **Deployment Options**: 3 วิธี
- **Database Tables Documented**: 7 tables

### 💡 Benefits

1. **ง่ายต่อการเข้าใจ**: Developer ใหม่สามารถเริ่มต้นได้ทันที
2. **ครอบคลุม**: ทุกอย่างที่ต้องรู้อยู่ในที่เดียว
3. **แก้ปัญหาเร็ว**: Troubleshooting guide ครบถ้วน
4. **Production Ready**: Deployment guide 3 วิธี
5. **เอกสารอ้างอิง**: สำหรับ maintenance ในอนาคต

---

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
