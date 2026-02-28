# PR-PO Tracking System

ระบบติดตาม Purchase Request (PR) และ Purchase Order (PO) จาก SAP B1 (SQL Server) พร้อมแสดงผลผ่าน Web Application

สร้างด้วย [T3 Stack](https://create.t3.gg/) - Next.js 15, tRPC 11, Prisma 6, NextAuth, Tailwind CSS 4

---

## 🚀 Quick Start

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า .env (ดูตัวอย่างด้านล่าง)

# 3. สร้าง database schema
npm run db:push

# 4. รันเซิร์ฟเวอร์
npm run dev

# เปิดใช้งานที่ http://localhost:2025
```

**หมายเหตุ:** ระบบจะ auto-sync ข้อมูลจาก SAP ทุก 2 ชั่วโมง หรือสามารถกดปุ่ม "ซิงค์ข้อมูลจาก SAP" ในหน้า PR Tracking เพื่อ sync แบบ manual

## 📋 ภาพรวมระบบ

ระบบนี้ทำการดึงข้อมูล Purchase Request (PR) และ Purchase Order (PO) จาก **SQL Server (SAP Business One)** แล้วนำเข้าสู่ **PostgreSQL** เพื่อให้สามารถ query และวิเคราะห์ข้อมูลได้รวดเร็ว พร้อมแสดงผลผ่าน Web Application

### ข้อมูลที่ระบบจัดการ

- **PR (Purchase Request)** - ใบขอซื้อ
  - ข้อมูลหลัก PR (เลขที่, วันที่, ผู้เปิด, หน่วยงาน, สถานะ)
  - รายการสินค้า/บริการที่ขอ (PR Lines)
  - ความคืบหน้าของ PR (มี PO แล้วหรือยัง)

- **PO (Purchase Order)** - ใบสั่งซื้อ
  - เชื่อมโยงกับ PR (PR-PO Link)
  - รายละเอียด PO (เลขที่, จำนวน, ราคา)
  - ไฟล์แนบ (จาก network share \\10.1.1.199\b1_shr)

- **ข้อมูลเสริม**
  - ผู้เปิด PR และหน่วยงาน
  - ประวัติการซิงค์ (Sync History)
  - การเข้าใช้งาน (Activity Trail)

### สถาปัตยกรรมระบบ

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│  SAP B1 (TMK)   │ ──────▶│  PostgreSQL      │ ──────▶│  Web App        │
│  SQL Server     │ Sync   │  (Local/Server)  │ tRPC   │  (Next.js)      │
│  (Read-only)    │        │  + Prisma ORM    │        │  Port 2025      │
└─────────────────┘        └──────────────────┘        └─────────────────┘
      Source                    Database                    Frontend
```

### ฟีเจอร์หลัก

- ✅ **PR Tracking** - แสดงรายการ PR พร้อมสถานะและความคืบหน้า
- ✅ **PO Linking** - เชื่อมโยง PR กับ PO แบบ real-time
- ✅ **Advanced Filtering** - กรองตามวันที่, สถานะ, ผู้เปิด PR, หน่วยงาน
- ✅ **Incremental Sync** - ดึงเฉพาะข้อมูลที่เปลี่ยนแปลง (เร็วกว่า Full Sync 10-100 เท่า)
- ✅ **Attachment Management** - จัดการไฟล์แนบจาก network share
- ✅ **Sync History** - ติดตามประวัติการซิงค์และการเปลี่ยนแปลง
- ✅ **Audit Trail** - บันทึกทุกการเปลี่ยนแปลงในระบบ (CRUD, Login/Logout, PR Approval)
- ✅ **PR Approval Workflow** - ระบบอนุมัติ PR (Line + Cost Center Approvers)
- ✅ **User Management** - จัดการผู้ใช้พร้อม Role-based access
- ✅ **Warehouse Receive Goods** - บันทึกการรับของและยืนยัน
- ✅ **PR Overview** - Dashboard สรุปภาพรวม PR
- ✅ **Auto-mount Network Share** - เชื่อมต่อ network drive อัตโนมัติ

### ข้อมูลเชิงสถิติ

- **Port**: 2025
- **จำนวนรายการ**: 23,000+ PR lines
- **Auto-sync**: ทุก 2 ชั่วโมง (00:00, 02:00, 04:00, ...)
- **Full sync**: ทุกเที่ยงคืน (00:00)
- **Attachment sync**: ทุก 2 ชั่วโมงที่นาทีที่ 30
- **Performance**: Incremental Sync ~2-5 วินาที, Full Sync ~60-90 วินาที

## 🔧 การตั้งค่า

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. การตั้งค่าฐานข้อมูล

#### PostgreSQL (ปลายทาง - สำหรับเก็บข้อมูลและแสดงผล)

```
Host: localhost (หรือ IP ของเซิร์ฟเวอร์)
Port: 5432
Database: PR_PO (หรือชื่อที่ต้องการ)
Username: postgres (หรือ user ที่สร้างไว้)
Password: ****
```

**การสร้าง Database:**
```bash
# เข้าสู่ PostgreSQL
psql -U postgres

# สร้าง database
CREATE DATABASE "PR_PO";

# ออกจาก psql
\q
```

#### SQL Server (แหล่งข้อมูล - SAP B1 Read-only)

```
Server: SAPSERVERTMK (หรือ IP)
Database: TMK_PRD
Username: powerquery_hq (read-only user)
Password: ****
```

**หมายเหตุ:** SQL Server เป็น **read-only** เท่านั้น ไม่มีการแก้ไขหรือเขียนข้อมูลลงไป

### 3. Environment Variables (.env)

สร้างไฟล์ `.env` ใน root directory:

```env
# =====================================================
# Next Auth Configuration
# =====================================================
AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="

# URL Configuration (ต้องตรงกับ URL ที่ใช้งานจริง)
NEXTAUTH_URL="http://localhost:2025"         # Development
# NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"  # Production

AUTH_URL="http://localhost:2025"
AUTH_TRUST_HOST="true"

# Auth Provider (required by NextAuth schema)
AUTH_DISCORD_ID="dummy"
AUTH_DISCORD_SECRET="dummy"

# =====================================================
# Database Configuration
# =====================================================
# PostgreSQL (ปลายทาง)
DATABASE_URL="postgresql://postgres:1234@localhost:5432/PR_PO"

# SQL Server (SAP B1 - แหล่งข้อมูล)
MSSQL_SERVER="xxxxxxxxxxxxxxxxxx"
MSSQL_DATABASE="xxxxxxxxxxxxxxxx"
MSSQL_USER="powerquery_hq"
MSSQL_PASSWORD="xxxxxxxxxxxxxxxxxxxxxxx*"
MSSQL_PORT=1433
MSSQL_TRUST_SERVER_CERTIFICATE=true
```

**สำคัญ:**
- `NEXTAUTH_URL` และ `AUTH_URL` ต้องตรงกับ URL ที่ใช้งานจริง
- สำหรับ **development**: `http://localhost:2025`
- สำหรับ **production**: `http://dev.tmkpalmoil.com:2025` (หรือ IP/Domain จริง)
- ถ้าแก้ไข `.env` ต้อง restart server หรือ rebuild ใหม่

### 4. สร้าง Database Schema

```bash
# Push Prisma schema ไปยัง PostgreSQL
npm run db:push

# หรือใช้ migration
npm run db:generate
```

**ตรวจสอบ schema:**
```bash
# เปิด Prisma Studio
npm run db:studio
```

## 📦 คำสั่งหลัก

### Development
```bash
npm run dev          # รัน dev server (port 2025)
npm run build        # Build production
npm start            # รัน production server
```

### Database
```bash
npm run db:push      # Push schema ไปยัง database
npm run db:studio    # เปิด Prisma Studio
```

### การซิงค์ข้อมูลจาก SAP

#### 🚀 Incremental Sync (แนะนำ - ใช้ใน Production) ⭐

**การทำงาน:**
- ดึงเฉพาะข้อมูลที่เปลี่ยนแปลงตั้งแต่ครั้งล่าสุด
- เร็วกว่า Full Sync **10-100 เท่า!**
- Auto-switch เป็น Full Sync ทุกเที่ยงคืน

**วิธีใช้:**
1. **Auto Sync** - ระบบจะ sync อัตโนมัติทุก 2 ชั่วโมง
2. **Manual Sync** - กดปุ่ม "ซิงค์ข้อมูลจาก SAP" ในหน้า PR Tracking

**ตัวอย่างผลลัพธ์:**
```
✅ เริ่มการซิงค์ (INCREMENTAL)
📊 ดึงข้อมูลจาก SAP: 15 รายการที่เปลี่ยนแปลง
💾 อัพเดตข้อมูล: 3 PR ใหม่, 12 PR อัพเดต
⏱️  ใช้เวลา: 2.34 วินาที
```

**ทำงานอย่างไร:**
1. **ครั้งแรก** → Full Sync (ดึงทุกอย่าง ~60-90 วินาที)
2. **ครั้งถัดไป** → Incremental Sync (~2-5 วินาที):
   - เช็ค `PR.UpdateDate > last_sync_date` (PR ที่ถูกแก้ไข)
   - เช็ค `EXISTS(PO.DocDate > last_sync_date)` (PR ที่มี PO ใหม่)
   - ดึงครบทุก line ของ PR (รวม line ที่ไม่มี PO)
3. **เที่ยงคืน (00:00)** → Full Sync อัตโนมัติ (เพื่อความแน่ใจ)

**Performance:**
- **Full Sync**: ~60-90 วินาที (23,000+ รายการ)
- **Incremental Sync**: ~2-5 วินาที (0-100 รายการโดยเฉลี่ย)
- **ประหยัดเวลา**: 90%+

#### 📅 Schedule ของ Auto-sync

| Scheduler | เวลาทำงาน | หน้าที่ |
|-----------|-----------|---------|
| **Auto Sync** | ทุก 2 ชั่วโมง<br>(00:00, 02:00, 04:00, ...) | ซิงค์ PR-PO หลัก<br>- เที่ยงคืน → Full Sync<br>- เวลาอื่น → Incremental |
| **Attachment Sync** | ทุก 2 ชั่วโมง (:30)<br>(00:30, 02:30, 04:30, ...) | Regular sync ไฟล์แนบ |
| **Attachment Full Refresh** | ทุกเที่ยงคืน (00:00) | Full refresh ไฟล์แนบทั้งหมด |
| **W-Series Sync** | ทุก 2 ชั่วโมง | ซิงค์ W-Series (ถ้ามี) |

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Backend**: tRPC, NextAuth.js
- **Database**: PostgreSQL, Prisma ORM
- **Data Source**: SQL Server (mssql)
- **Scheduler**: node-cron

## 📊 Database Schema

### Tables หลัก

#### 1. `pr_master` - ข้อมูลหลักของ PR
```sql
pr_doc_num        INTEGER PRIMARY KEY   -- เลขที่ PR (unique)
req_name          VARCHAR(255)          -- ชื่อผู้เปิด PR
department_name   VARCHAR(255)          -- หน่วยงาน
doc_date          DATE                  -- วันที่เปิด PR
doc_due_date      DATE                  -- วันที่ครบกำหนด
doc_status        VARCHAR(1)            -- สถานะ (O=Open, C=Closed)
job_name          TEXT                  -- ชื่องาน/โปรเจกต์
remarks           TEXT                  -- หมายเหตุ
series_name       VARCHAR(100)          -- ชื่อ Series
created_at        TIMESTAMP             -- วันที่สร้างใน DB
updated_at        TIMESTAMP             -- วันที่อัพเดตล่าสุด
```

#### 2. `pr_lines` - รายละเอียดแต่ละ line ของ PR
```sql
id                SERIAL PRIMARY KEY
pr_doc_num        INTEGER               -- เลขที่ PR (FK → pr_master)
line_num          INTEGER               -- เลขบรรทัด (0, 1, 2, ...)
item_code         VARCHAR(255)          -- รหัสสินค้า
description       TEXT                  -- ชื่อสินค้า/รายการ
quantity          NUMERIC(19,6)         -- จำนวนที่ขอ
unit_msr          VARCHAR(100)          -- หน่วย (เช่น PCS, KG)
has_po            BOOLEAN               -- มี PO แล้วหรือยัง
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

#### 3. `pr_po_link` - เชื่อมโยง PR กับ PO
```sql
id                  SERIAL PRIMARY KEY
pr_doc_num          INTEGER             -- เลขที่ PR
pr_line_num         INTEGER             -- เลขบรรทัด PR
pr_line_description TEXT                -- รายละเอียด (จาก PR)
po_doc_num          INTEGER             -- เลขที่ PO
po_line_num         INTEGER             -- เลขบรรทัด PO
po_quantity         NUMERIC(19,6)       -- จำนวนใน PO
po_doc_date         DATE                -- วันที่ PO
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

#### 4. `po_attachments` - ไฟล์แนบของ PO
```sql
id                SERIAL PRIMARY KEY
abs_entry         INTEGER               -- SAP Attachment Entry
line_num          INTEGER               -- เลขบรรทัด
po_doc_num        INTEGER               -- เลขที่ PO
file_name         VARCHAR(255)          -- ชื่อไฟล์
file_ext          VARCHAR(10)           -- นามสกุล (.pdf, .xlsx)
file_path         TEXT                  -- Path บน network share
date_created      TIMESTAMP             -- วันที่สร้างไฟล์
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

#### 5. `sync_log` - ประวัติการซิงค์
```sql
id                    SERIAL PRIMARY KEY
sync_date             TIMESTAMP           -- วันเวลาที่ sync
sync_type             VARCHAR(20)         -- FULL หรือ INCREMENTAL
duration_seconds      NUMERIC(10,2)       -- ระยะเวลาที่ใช้
records_processed     INTEGER             -- จำนวนรายการที่ประมวลผล
records_new           INTEGER             -- จำนวน PR ใหม่
records_updated       INTEGER             -- จำนวน PR ที่อัพเดต
status                VARCHAR(20)         -- SUCCESS หรือ FAILED
error_message         TEXT                -- ข้อความ error (ถ้ามี)
```

#### 6. `sync_change_log` - รายละเอียดการเปลี่ยนแปลง (Incremental Sync)
```sql
id                SERIAL PRIMARY KEY
sync_id           INTEGER               -- FK → sync_log
pr_doc_num        INTEGER               -- เลขที่ PR
change_type       VARCHAR(20)           -- PR_NEW, PR_UPDATED, PR_STATUS_CHANGED, PO_LINKED
change_details    TEXT                  -- รายละเอียด JSON
created_at        TIMESTAMP
```

#### 7. `activity_trail` - Audit Trail (บันทึกทุกการเปลี่ยนแปลง)
```sql
id                SERIAL PRIMARY KEY
user_id           VARCHAR(255)          -- User ID
user_name         VARCHAR(255)          -- ชื่อ user
ip_address        VARCHAR(50)           -- IP Address
action            VARCHAR(50)           -- CREATE, READ, UPDATE, DELETE, LOGIN, etc.
table_name        VARCHAR(100)          -- ตารางที่เปลี่ยนแปลง
record_id         VARCHAR(255)          -- ID ของ record
old_values        JSONB                 -- ค่าก่อนเปลี่ยน
new_values        JSONB                 -- ค่าหลังเปลี่ยน
description       TEXT                  -- คำอธิบาย
pr_no             INTEGER               -- เลข PR (ถ้ามี)
po_no             INTEGER               -- เลข PO (ถ้ามี)
metadata          JSONB                 -- ข้อมูลเพิ่มเติม
computer_name     VARCHAR(255)          -- ชื่อเครื่อง
created_at        TIMESTAMP
```

### NextAuth Tables (สำหรับ Authentication)
```sql
User              -- ข้อมูล users
Account           -- OAuth accounts
Session           -- User sessions
VerificationToken -- Email verification
```

### Materialized Views (สำหรับ Performance)
```sql
mv_pr_summary     -- สรุปข้อมูล PR (group by PR)
```

### ความสัมพันธ์ระหว่างตาราง

```
pr_master (1) ──────< (N) pr_lines
     │
     └──────< (N) pr_po_link ───< (N) po_attachments
```

- 1 PR มีได้หลาย Lines
- 1 PR Line อาจมีหลาย PO (split purchase)
- 1 PO อาจมีหลาย Attachments

## 🌐 Pages และฟีเจอร์

### 1. `/pr-tracking` - หน้าหลัก (PR List)
- แสดงรายการ PR ทั้งหมดแบบ card view
- Progress bar แสดงความคืบหน้า (กี่ line มี PO แล้ว)
- Filter: วันที่, สถานะ, ผู้เปิด PR, หน่วยงาน, ค้นหา
- Statistics cards (แสดงตามช่วงวันที่ที่กรอง)
- กดปุ่ม "ซิงค์ข้อมูลจาก SAP" เพื่อ manual sync
- คลิกที่ PR card เพื่อดูรายละเอียด

### 2. `/pr-overview` - สรุปภาพรวม PR
- Dashboard สรุปสถิติ PR ทั้งหมด
- กราฟแสดงแนวโน้ม PR/PO
- แยกตามหน่วยงาน/ผู้เปิด PR

### 3. `/sync-history` - ประวัติการซิงค์
- แสดงประวัติการ sync ทั้งหมด
- กรองตามช่วงวันที่
- รายละเอียดการเปลี่ยนแปลง (Change Log):
  - 🟢 PR_NEW - PR ใหม่
  - 🔵 PR_UPDATED - PR อัพเดต
  - 🟡 PR_STATUS_CHANGED - สถานะเปลี่ยน
  - 🟣 PO_LINKED - มี PO ใหม่

### 4. `/attachments` - จัดการไฟล์แนบ
- แสดงไฟล์แนบของ PO ทั้งหมด
- ดาวน์โหลดไฟล์จาก network share
- แสดงสถานะไฟล์ (มีอยู่หรือถูกลบ)

### 5. PR Detail Modal
- แสดงรายละเอียด PR ทั้งหมด
- รายการ PR Lines (แต่ละรายการที่ขอ)
- PO ที่เชื่อมโยงกับแต่ละ line
- ไฟล์แนบของ PO

## 💼 Use Cases และ Workflow

### Use Case 1: เว็บแสดงข้อมูล PR-PO (View Only)
```
📊 ดูรายการ PR ทั้งหมด
└─> 🔍 กรองตามวันที่/สถานะ/ผู้เปิด PR
    └─> 📋 คลิกดูรายละเอียด PR
        └─> 🔗 เห็น PO ที่เกี่ยวข้อง
            └─> 📎 ดาวน์โหลดไฟล์แนบ PO
```

**หมายเหตุ:** ไม่มีการแก้ไขข้อมูล - แก้ไขใน SAP เท่านั้น

### Use Case 2: Dashboard และ Reporting
- สรุปจำนวน PR แยกตามสถานะ (Open/Closed)
- สรุปจำนวน PO แยกตามเดือน
- แสดง PR ที่ยังไม่มี PO (รอดำเนินการ)
- แสดง PR ที่มีหลาย PO (split purchase)
- วิเคราะห์เวลาตั้งแต่เปิด PR จนได้ PO
- ดูประวัติการซิงค์และการเปลี่ยนแปลง

### Use Case 3: Workflow ทั่วไป

```
┌─────────────────────────────────────────────────────────────┐
│  1. User เปิด PR ใน SAP Business One                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ระบบ Auto-sync (ทุก 2 ชั่วโมง)                         │
│     หรือ Manual sync (กดปุ่มในเว็บ)                          │
│     → Incremental Sync ดึงเฉพาะที่เปลี่ยน (~2-5 วินาที)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. User ดูข้อมูล PR บนเว็บ                                 │
│     → เห็นสถานะ PR และความคืบหน้า                           │
│     → PR ที่ยังไม่มี PO จะแสดง 0% progress                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Admin อนุมัติ PR ใน SAP → สร้าง PO                      │
│     (การอนุมัติทำใน SAP เท่านั้น)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. ระบบซิงค์ข้อมูล PO ใหม่                                 │
│     → EXISTS check จับ PR ที่มี PO ใหม่                     │
│     → ดึงข้อมูล PO และไฟล์แนบ                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  6. User เห็น PO บนเว็บ                                      │
│     → Progress bar เปลี่ยนเป็น 50%, 100%                    │
│     → คลิกดู PO detail และดาวน์โหลดไฟล์แนบ                  │
└─────────────────────────────────────────────────────────────┘
```

### ความสัมพันธ์ PR-PO

- **1 PR : 0 PO** = PR ที่ยังไม่มี PO (รอดำเนินการ) - Progress 0%
- **1 PR : 1 PO** = PR ที่มี PO ครบ - Progress 100%
- **1 PR : N PO** = PR ที่มีหลาย PO (แยกซื้อหลายครั้ง) - Progress 50%, 75%, etc.

## 📝 หมายเหตุสำคัญ

- ✅ SQL Server (SAP B1) เป็น **read-only** - แก้ไขข้อมูลใน SAP เท่านั้น
- ✅ PostgreSQL เป็น **read-only copy** สำหรับแสดงผลและรายงาน
- ✅ Network share auto-mount: `\\xxxxxxxxxxxxxxxxxxxxxxxxxxx\b1_shr` (สำหรับไฟล์แนบ)
- ✅ ไม่มีการแก้ไขข้อมูลผ่านเว็บ - เป็น **view-only system**
- ✅ Source of truth คือ **SAP B1 เท่านั้น**

## ❓ FAQ (คำถามที่พบบ่อย)

### Q1: ทำไมมีตารางอื่นๆ (User, Account, Session) ด้วย?
**A:** เป็นตารางที่มากับ NextAuth.js (authentication) โดย default ไม่ต้องลบ ไม่กระทบการทำงาน

### Q2: Incremental Sync vs Full Sync ต่างกันอย่างไร?
**A:**
- **Incremental Sync**: ดึงเฉพาะข้อมูลที่เปลี่ยนแปลงตั้งแต่ครั้งล่าสุด (เร็ว ~2-5 วินาที)
- **Full Sync**: ดึงข้อมูลทั้งหมดใหม่ (ช้ากว่า ~60-90 วินาที)
- ระบบจะ auto-switch เป็น Full Sync ทุกเที่ยงคืน เพื่อความแน่ใจ

### Q3: ข้อมูลจะไม่ซ้ำใช่ไหม?
**A:** ใช่ ระบบใช้ UPSERT (Update + Insert):
- ถ้ามี PR อยู่แล้ว → อัพเดตข้อมูล
- ถ้ายังไม่มี → สร้างใหม่
- ไม่มีทางซ้ำ

### Q4: PR 1 อันมีหลาย PO จัดการยังไง?
**A:**
- ในตาราง `pr_po_link` จะมีหลาย rows สำหรับ PR เดียวกัน
- แต่ละ PO line จะมี 1 record
- Progress bar จะคำนวณ % จากจำนวน lines ที่มี PO

### Q5: ถ้าต้องการข้อมูล realtime ทำยังไง?
**A:** ระบบมี 2 วิธี:
1. **Auto-sync** - รันอัตโนมัติทุก 2 ชั่วโมง
2. **Manual sync** - กดปุ่ม "ซิงค์ข้อมูลจาก SAP" ในเว็บ

หรือตั้ง scheduler ให้รัน sync บ่อยขึ้น (เช่น ทุก 15 นาที)

### Q6: ทำไมไม่แก้ไขข้อมูลใน PostgreSQL แล้ว sync กลับไป SQL Server?
**A:** เพราะ SQL Server (SAP B1) เป็น **source of truth**
- การแก้ไขต้องทำใน SAP เท่านั้น
- PostgreSQL เป็นแค่ read-only copy สำหรับ view/reporting
- ป้องกันข้อมูลไม่ตรงกันระหว่าง 2 ระบบ

### Q7: ไฟล์แนบอยู่ที่ไหน?
**A:** ไฟล์แนบอยู่บน **network share**: `\\10.1.1.199\b1_shr`
- ระบบจะ auto-mount เมื่อเริ่มต้น
- ถ้า mount ไม่ได้ ต้อง mount manual ด้วย:
  ```cmd
  net use "\\10.1.1.199\b1_shr" /user:B1admin On33rp /persistent:yes
  ```

### Q8: ตรวจสอบว่า sync ทำงานหรือไม่ได้อย่างไร?
**A:** ไปที่หน้า `/sync-history`:
- ดูประวัติ sync ล่าสุด
- เช็ค status (SUCCESS/FAILED)
- ดูจำนวน records ที่ประมวลผล
- ดู change log รายละเอียด

### Q9: Materialized View คืออะไร? ควรใช้ไหม?
**A:** Materialized View เป็น "ตารางพิเศษ" ที่เก็บผลลัพธ์ query ไว้ล่วงหน้า
- **ใช้เมื่อ**: ต้องการ query ซับซ้อน (aggregation, grouping)
- **ข้อดี**: Query เร็วมาก
- **ข้อเสีย**: ต้อง refresh เมื่อข้อมูลเปลี่ยน

**สำหรับโปรเจคนี้**: ระบบมี `mv_pr_summary` สำหรับสรุป PR

### Q10: ต้อง refresh Materialized View บ่อยแค่ไหน?
**A:** ขึ้นอยู่กับความต้องการ:
- **Realtime**: Auto-refresh หลัง sync ทุกครั้ง (ใช้เวลา 2-3 วินาที)
- **Daily**: Refresh วันละครั้ง
- **On-demand**: Refresh เมื่อต้องการดู report

โปรเจคนี้ใช้ direct query จาก tables หลัก ไม่ต้อง refresh MV บ่อย

## 🚨 Troubleshooting

### ปัญหา 1: Port 2025 ถูกใช้งานแล้ว
```bash
# Windows - ค้นหา process ที่ใช้ port 2025
netstat -ano | findstr :2025

# ปิด process (เปลี่ยน [PID] เป็นเลข PID ที่ได้)
taskkill /PID [PID] /F

# หรือเปลี่ยน port ในไฟล์ server.ts
# ค้นหา: const port = 2025
# เปลี่ยนเป็น: const port = 3000
```

### ปัญหา 2: Database Connection Error
```bash
# 1. ตรวจสอบว่า PostgreSQL ทำงานอยู่
# Windows: Services → PostgreSQL
# หรือ: psql -U postgres -c "SELECT 1;"

# 2. ตรวจสอบ DATABASE_URL ในไฟล์ .env
# ตัวอย่าง: postgresql://postgres:1234@localhost:5432/PR_PO

# 3. ทดสอบเชื่อมต่อ
psql -h localhost -U postgres -d PR_PO

# 4. ถ้ายังไม่ได้ ให้สร้าง database ใหม่
psql -U postgres
CREATE DATABASE "PR_PO";
\q
```

### ปัญหา 3: ไม่แสดงข้อมูล / เว็บว่างเปล่า
```bash
# 1. ตรวจสอบว่ามีข้อมูลใน database
npm run db:studio
# ดูตาราง pr_master → ควรมีข้อมูล

# 2. ถ้าไม่มีข้อมูล ให้ sync ใหม่
# วิธีที่ 1: กดปุ่ม "ซิงค์ข้อมูลจาก SAP" ในเว็บ
# วิธีที่ 2: Manual trigger API
curl http://localhost:2025/api/sync-pr-data

# 3. ตรวจสอบ sync history
# ไปที่ http://localhost:2025/sync-history

# 4. Restart server
# Ctrl+C → npm run dev
```

### ปัญหา 4: Sync ล้มเหลว / Connection Error
```bash
# 1. ตรวจสอบการเชื่อมต่อ SQL Server (SAP B1)
# ตรวจสอบว่า MSSQL_* variables ในไฟล์ .env ถูกต้อง

# 2. ดู error message ในหน้า /sync-history
# จะบอกสาเหตุที่ sync ล้มเหลว

# 3. ตรวจสอบว่า SQL Server ทำงานอยู่
# และ user มีสิทธิ์ read ตาราง OPRQ, PRQ1, OPOR, POR1

# 4. ดู logs ใน console
# จะมี error message รายละเอียด
```

### ปัญหา 5: UntrustedHost Error
```
[auth][error] UntrustedHost: Host must be trusted.
URL was: http://localhost:2025/api/auth/session
```

**วิธีแก้:**
1. เพิ่มใน `.env`:
```env
NEXTAUTH_URL="http://localhost:2025"
AUTH_URL="http://localhost:2025"
AUTH_TRUST_HOST="true"
```

2. Restart server:
```bash
# Ctrl+C
npm run dev
```

### ปัญหา 6: ไฟล์แนบไม่แสดง / ดาวน์โหลดไม่ได้
```bash
# 1. ตรวจสอบว่า network share mount แล้วหรือยัง
net use | findstr "10.1.1.199"

# 2. ถ้ายัง ให้ mount manual
net use "\\10.1.1.199\b1_shr" /user:B1admin On33rp /persistent:yes

# 3. ตรวจสอบว่าไฟล์มีอยู่จริงใน network share
dir "\\10.1.1.199\b1_shr\Attachments"

# 4. Sync attachments ใหม่
# กด "Sync Attachments" ในหน้า /attachments
```

### ปัญหา 7: Database Schema ไม่ตรง / Migration Error
```bash
# 1. Reset database schema
npm run db:push

# 2. ถ้ายังไม่ได้ ให้ลบตารางทั้งหมดและสร้างใหม่
# ⚠️ คำเตือน: จะลบข้อมูลทั้งหมด!
psql -U postgres -d PR_PO
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

npm run db:push

# 3. Sync ข้อมูลใหม่
# กดปุ่ม "ซิงค์ข้อมูลจาก SAP" ในเว็บ
```

### ปัญหา 8: Build Error / TypeScript Error
```bash
# 1. ลบ cache ทั้งหมด
npm run clean
# หรือ
rm -rf .next node_modules/.cache

# 2. ติดตั้ง dependencies ใหม่
npm install

# 3. Generate Prisma Client ใหม่
npm run db:generate

# 4. Build ใหม่
npm run build
```

### ปัญหา 9: Slow Performance / Query ช้า
```bash
# 1. ตรวจสอบจำนวนข้อมูล
npm run db:studio
# ดูตาราง pr_master, pr_lines

# 2. ใช้ Materialized View สำหรับ aggregate queries
# (ถ้ามี query ที่ช้า)

# 3. เพิ่ม index ในตารางที่ query บ่อย
# (ปกติ Prisma จะสร้าง index ให้อัตโนมัติ)

# 4. ลด filter range ให้เล็กลง
# กรองเฉพาะช่วงเวลาที่ต้องการ
```

## 📦 Deployment

### สำหรับ Development

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า .env (development)
NEXTAUTH_URL="http://localhost:2025"
DATABASE_URL="postgresql://postgres:1234@localhost:5432/PR_PO"

# 3. สร้าง schema และ sync ข้อมูล
npm run db:push

# 4. รันเซิร์ฟเวอร์
npm run dev
```

### สำหรับ Production (Windows Server)

#### Option 1: Direct Run (แนะนำสำหรับ Shared Folder)

```bash
# 1. คัดลอกโฟลเดอร์ไปยัง shared folder / network drive
# เช่น: \\server\shared\pr-po-app\

# 2. ติดตั้ง dependencies
cd \\server\shared\pr-po-app
npm install --production

# 3. ตั้งค่า .env (production)
NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_URL="http://dev.tmkpalmoil.com:2025"
DATABASE_URL="postgresql://xxxxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxx@192.168.1.3:5432/PR_PO"

# 4. Build
npm run build

# 5. รัน production server
npm start

# หรือใช้ PM2 (แนะนำ)
npm install -g pm2
pm2 start npm --name "pr-po-app" -- start
pm2 startup
pm2 save
```

#### Option 2: Windows Service (แนะนำสำหรับ Production)

```bash
# 1. ติดตั้ง node-windows
npm install -g node-windows

# 2. สร้างไฟล์ install-service.js
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'PR-PO Tracking System',
  description: 'Purchase Request and Purchase Order Tracking System',
  script: 'D:\\path\\to\\app\\server.ts',
  nodeOptions: [
    '--loader=tsx'
  ],
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', function(){
  svc.start();
});

svc.install();

# 3. รัน script เพื่อติดตั้ง service
node install-service.js

# 4. จัดการ service
# Services → "PR-PO Tracking System" → Start/Stop/Restart
```

#### Option 3: Windows Task Scheduler (สำหรับ Auto-start)

1. เปิด **Task Scheduler**
2. สร้าง Basic Task ใหม่:
   - **Name**: PR-PO Web Server
   - **Trigger**: At startup
   - **Action**: Start a program
     - Program: `C:\Program Files\nodejs\node.exe`
     - Arguments: `D:\path\to\app\server.ts`
     - Start in: `D:\path\to\app`
3. **Settings**:
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges

### Environment Variables สำหรับ Production

```env
# =====================================================
# Production Configuration
# =====================================================
NODE_ENV="production"

# Next Auth (⚠️ เปลี่ยน URL ให้ตรงกับ production!)
AUTH_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_TRUST_HOST="true"

# Auth Provider
AUTH_DISCORD_ID="dummy"
AUTH_DISCORD_SECRET="dummy"

# Database (⚠️ ใช้ IP แทน hostname ใน production!)
DATABASE_URL="postgresql://xxxxxxxxxxxx:xxxxxxxx@192.168.1.3:5432/PR_PO"

# SQL Server (SAP B1)
MSSQL_SERVER="xxxxxxxxx"
MSSQL_DATABASE="xxxxxxxx"
MSSQL_USER="xxxxxxxxxxx"
MSSQL_PASSWORD="xxxxxxxxxx*"
MSSQL_PORT=1433
MSSQL_TRUST_SERVER_CERTIFICATE=true

# Network Share
NETWORK_SHARE_PATH="\\\\10.1.1.199\\b1_shr"
NETWORK_SHARE_USER="xxxxxxxxx"
NETWORK_SHARE_PASSWORD="xxxxxxxx"
```

**⚠️ สำคัญ:**
- ถ้าแก้ไข `.env` ใน production ต้อง **rebuild** ทุกครั้ง:
  ```bash
  npm run build
  pm2 restart pr-po-app
  ```

### Auto-sync Schedule (Production)

ระบบมี built-in schedulers อยู่แล้ว:
- ✅ Auto-sync ทุก 2 ชั่วโมง
- ✅ Attachment sync ทุก 2 ชั่วโมง
- ✅ Full sync ทุกเที่ยงคืน

ถ้าต้องการ custom schedule:

```javascript
// แก้ไขใน src/server/auto-sync-scheduler.ts
const cronExpression = '0 */2 * * *';  // ทุก 2 ชั่วโมง
// หรือ
const cronExpression = '*/15 * * * *'; // ทุก 15 นาที
```

### Monitoring และ Logging

#### PM2 Monitoring

```bash
# ดูสถานะ
pm2 status

# ดู logs
pm2 logs pr-po-app

# ดู logs realtime
pm2 logs pr-po-app --lines 100

# ดู error logs เท่านั้น
pm2 logs pr-po-app --err

# Monitor CPU/Memory
pm2 monit
```

#### Application Logs

- **Sync History**: ดูที่ `/sync-history` ในเว็บ
- **Activity Trail**: บันทึกการเข้าใช้งานใน database
- **Console Logs**: ดูใน PM2 logs หรือ console

### Backup และ Restore

#### Backup Database

```bash
# Backup PostgreSQL database
pg_dump -U postgres -d PR_PO -F c -f backup_$(date +%Y%m%d).dump

# หรือ backup เฉพาะ schema
pg_dump -U postgres -d PR_PO --schema-only -f schema_backup.sql

# หรือ backup เฉพาะ data
pg_dump -U postgres -d PR_PO --data-only -f data_backup.sql
```

#### Restore Database

```bash
# Restore จาก .dump file
pg_restore -U postgres -d PR_PO backup_20251125.dump

# Restore จาก .sql file
psql -U postgres -d PR_PO -f backup.sql
```

**หมายเหตุ:** ไม่จำเป็นต้อง backup บ่อย เพราะข้อมูลสามารถ sync ใหม่จาก SAP ได้

### Security Checklist

- ✅ ใช้ strong `AUTH_SECRET` (random 32+ characters)
- ✅ ตั้งค่า `AUTH_TRUST_HOST="true"` ใน .env
- ✅ ใช้ HTTPS ใน production (ถ้าเป็นไปได้)
- ✅ จำกัดสิทธิ์ SQL Server user เป็น read-only
- ✅ เก็บ `.env` ไว้นอก git repository
- ✅ ตั้งรหัสผ่าน PostgreSQL ที่แข็งแรง
- ✅ จำกัดการเข้าถึง network share

### Performance Optimization

1. **Database Indexing** - Prisma สร้าง indexes อัตโนมัติ
2. **Incremental Sync** - ลดเวลา sync จาก 90s → 2-5s
3. **Connection Pooling** - Prisma จัดการ connection pool อัตโนมัติ
4. **Materialized Views** - สำหรับ complex queries (optional)
5. **Caching** - React Query cache ใน frontend

### Troubleshooting Production Issues

```bash
# 1. ตรวจสอบ service ทำงานหรือไม่
pm2 status

# 2. ดู logs
pm2 logs pr-po-app --lines 50

# 3. Restart service
pm2 restart pr-po-app

# 4. ตรวจสอบ database connection
psql -U postgres -d PR_PO -c "SELECT COUNT(*) FROM pr_master;"

# 5. ตรวจสอบ port
netstat -ano | findstr :2025

# 6. Test sync manually
curl http://dev.tmkpalmoil.com:2025/api/sync-pr-data
```

## 📚 เอกสารเพิ่มเติม

### เอกสารโปรเจกต์
- `README_PR_TRACKING_V2.md` - แผน v2.0 (ยังไม่ implement)
- `SYNC_STRATEGIES.md` - กลยุทธ์การซิงค์ต่างๆ
- `SYNC_HISTORY.md` - Sync History & Change Tracking
- `AUDIT_TRAIL.md` - ระบบ Audit Trail
- `RECEIVE_GOODS.md` - ระบบรับของและ WO Sync
- `LOGIN_SYSTEM.md` - ระบบ Login และ User Management
- `PROJECT_SUMMARY.md` - สรุปโปรเจกต์โดยละเอียด

### Scripts สำหรับ Development
- `scripts/` - Scripts ต่างๆ สำหรับทดสอบและจัดการ

### การพัฒนาต่อยอด
ถ้าต้องการพัฒนาฟีเจอร์เพิ่มเติม:

1. **Frontend**: แก้ไขใน `src/pages/` และ `src/components/`
2. **Backend API**: แก้ไขใน `src/server/api/routers/`
3. **Database Schema**: แก้ไขใน `prisma/schema.prisma` แล้วรัน `npm run db:push`
4. **Sync Logic**: แก้ไขใน `src/server/auto-sync-scheduler.ts`

## 🔗 T3 Stack Resources

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js](https://nextjs.org) - React Framework
- [Prisma](https://prisma.io) - ORM
- [tRPC](https://trpc.io) - Type-safe API
- [NextAuth.js](https://next-auth.js.org) - Authentication
- [Tailwind CSS](https://tailwindcss.com) - CSS Framework

## 📄 License

This project is private and proprietary.

---

## 📌 Version Information

**Current Version**: 4.0
**Port**: 2025
**Database**: PostgreSQL
**Source**: SAP B1 (SQL Server)
**Last Updated**: 2026-01-31

### Version History

**v4.0** (2026-01-31) - PR Approval Workflow, Audit Trail & Security
- ✅ PR Approval Workflow (Line + Cost Center Approvers)
- ✅ Telegram Notifications
- ✅ Comprehensive Audit Trail System
- ✅ User Management with bcrypt hashing
- ✅ Warehouse Receive Goods module
- ✅ Role-based access (PR, Manager, Approval, Admin)

**v3.0** (2025-11-25) - Comprehensive Documentation
- ✅ รายละเอียด README แบบครบถ้วน
- ✅ FAQ 10 ข้อ
- ✅ Troubleshooting 9 ปัญหา
- ✅ Deployment guides (3 options)

**v2.x** (Previous)
- ✅ Incremental Sync with PO Check
- ✅ Attachment Management
- ✅ Sync History & Change Tracking
- ✅ Activity Trail
- ✅ Priority 1 Fixes & Security Enhancements

**v1.x** (Initial)
- ✅ PR-PO Tracking System
- ✅ Card Layout UI
- ✅ Filter System
- ✅ Auto-sync Schedulers

---

**สร้างด้วย ❤️ โดยทีมพัฒนา TMK**
