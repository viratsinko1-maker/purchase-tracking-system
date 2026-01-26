# PR-PO Management System - Project Summary

> ⚠️ **หมายเหตุ**: เอกสารนี้เป็นเวอร์ชันเก่า (v1.0-v2.x)
>
> **กรุณาดูเอกสารล่าสุดที่**: [README.md](./README.md)
>
> README.md เวอร์ชัน v3.0 มีข้อมูลครบถ้วนและเป็นปัจจุบันกว่า รวมถึง:
> - 📚 เอกสารแบบ comprehensive (1,000+ บรรทัด)
> - ❓ FAQ 10 ข้อ
> - 🚨 Troubleshooting 9 ปัญหา
> - 📦 Deployment guide 3 วิธี
> - 📊 Database Schema ครบถ้วน
> - 💼 Use Cases และ Workflow
>
> **เวอร์ชันปัจจุบัน**: v3.0 (2025-11-25)

---

## ภาพรวมโปรเจค (Quick Overview)

ระบบจัดการ Purchase Request (PR) และ Purchase Order (PO) ที่ดึงข้อมูลจาก SQL Server (SAP B1) และแสดงผลผ่าน Web Application

### วัตถุประสงค์หลัก
- ดึงข้อมูล PR-PO จาก SAP Business One (SQL Server) มาเก็บใน PostgreSQL
- แสดงผลข้อมูลผ่าน Web Application ที่ใช้งานง่าย responsive และรวดเร็ว
- ติดตามสถานะ PR และ PO แบบ real-time
- รองรับการ filter และค้นหาข้อมูลแบบละเอียด

### เทคโนโลยีที่ใช้
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Backend**: tRPC 11, NextAuth.js
- **Database**:
  - PostgreSQL (ปลายทาง - สำหรับแสดงผล)
  - SQL Server (SAP B1 - Read-only)
- **ORM**: Prisma 6
- **Scheduler**: node-cron

### Port และ URL
- **Development**: http://localhost:2025
- **Production**: http://dev.tmkpalmoil.com:2025

---

## Features หลัก

### 1. PR Tracking (`/pr-tracking`)
- แสดงรายการ PR แบบ card view
- Progress bar แสดงความคืบหน้า
- Filter: วันที่, สถานะ, ผู้เปิด PR, หน่วยงาน
- Manual sync จาก SAP

### 2. PR Overview (`/pr-overview`)
- Dashboard สรุปสถิติ
- กราฟแสดงแนวโน้ม

### 3. Sync History (`/sync-history`)
- ประวัติการ sync ทั้งหมด
- Change log รายละเอียด

### 4. Attachments (`/attachments`)
- จัดการไฟล์แนบจาก network share
- Auto-sync ทุก 2 ชั่วโมง

---

## การ Sync ข้อมูล

### Incremental Sync (แนะนำ)
- ดึงเฉพาะข้อมูลที่เปลี่ยนแปลง
- ใช้เวลา ~2-5 วินาที
- Auto-switch เป็น Full Sync ทุกเที่ยงคืน

### Auto-sync Schedule
- **Auto Sync**: ทุก 2 ชั่วโมง (00:00, 02:00, 04:00, ...)
- **Attachment Sync**: ทุก 2 ชั่วโมงที่ :30 (00:30, 02:30, ...)
- **Full Sync**: ทุกเที่ยงคืน (00:00)

---

## Database Schema

### Tables หลัก
1. `pr_master` - ข้อมูลหลัก PR
2. `pr_lines` - รายการ line ของ PR
3. `pr_po_link` - เชื่อมโยง PR กับ PO
4. `po_attachments` - ไฟล์แนบของ PO
5. `sync_log` - ประวัติการซิงค์
6. `sync_change_log` - รายละเอียดการเปลี่ยนแปลง
7. `activity_trail` - บันทึกการเข้าใช้งาน

### NextAuth Tables
- `User`, `Account`, `Session`, `VerificationToken`

---

## Quick Start

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า .env
# (ดูตัวอย่างใน README.md)

# 3. สร้าง database schema
npm run db:push

# 4. รันเซิร์ฟเวอร์
npm run dev

# เปิดใช้งานที่ http://localhost:2025
```

---

## การ Deployment

ดู deployment guide ครบถ้วนใน [README.md - Deployment Section](./README.md#-deployment)

### Options:
1. **Direct Run** - PM2 (แนะนำ)
2. **Windows Service** - node-windows
3. **Windows Task Scheduler** - Auto-start

---

## เอกสารเพิ่มเติม

| เอกสาร | คำอธิบาย |
|--------|----------|
| [README.md](./README.md) | **เอกสารหลัก (v3.0)** - ครบถ้วนที่สุด ⭐ |
| [CHANGELOG.md](./CHANGELOG.md) | ประวัติการเปลี่ยนแปลงทุกเวอร์ชัน |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide แบบละเอียด |
| [SYNC_STRATEGIES.md](./SYNC_STRATEGIES.md) | กลยุทธ์การซิงค์ต่างๆ |
| [SYNC_HISTORY.md](./SYNC_HISTORY.md) | Sync History & Change Tracking |
| [LOGIN_SYSTEM.md](./LOGIN_SYSTEM.md) | ระบบ Login และ Authentication |
| [CRON_SETUP.md](./CRON_SETUP.md) | การตั้งค่า Cron jobs |

---

## Version History

### v3.0 (2025-11-25) - Documentation Overhaul
- ✅ README comprehensive (1,016 บรรทัด)
- ✅ FAQ 10 ข้อ + Troubleshooting 9 ปัญหา
- ✅ Deployment guide 3 options

### v2.x (Previous)
- ✅ Incremental Sync with PO Check
- ✅ Attachment Management
- ✅ Sync History & Change Tracking
- ✅ Activity Trail

### v1.x (Initial)
- ✅ PR-PO Tracking System
- ✅ Card Layout UI
- ✅ Filter System
- ✅ Auto-sync Schedulers

---

## สถิติโปรเจกต์

- **จำนวนรายการ**: 23,000+ PR lines
- **Auto-sync**: ทุก 2 ชั่วโมง
- **Performance**: Incremental Sync ~2-5 วินาที
- **Port**: 2025
- **Database**: PostgreSQL + SQL Server (SAP B1)

---

## การติดต่อและ Support

หากพบปัญหาหรือต้องการความช่วยเหลือ:

1. ดู [README.md - FAQ Section](./README.md#-faq-คำถามที่พบบ่อย)
2. ดู [README.md - Troubleshooting Section](./README.md#-troubleshooting)
3. ตรวจสอบ [CHANGELOG.md](./CHANGELOG.md) สำหรับ known issues

---

**⚠️ อย่าลืม**: เอกสารนี้เป็นเวอร์ชันสรุปย่อ กรุณาดู [README.md](./README.md) สำหรับข้อมูลครบถ้วน

**Last Updated**: 2025-11-25
**Version**: 3.0
