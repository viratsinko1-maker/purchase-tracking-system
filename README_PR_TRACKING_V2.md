# PR Tracking System v2.0 (PLANNED)

> ⚠️ **สถานะ**: เอกสารนี้เป็นแผนสำหรับ v2.0 ซึ่ง**ยังไม่ได้ implement**
>
> **เวอร์ชันปัจจุบัน**: v1.0 (ใช้ schema PurchaseRequestPO)
>
> **ไฟล์เตรียมไว้แล้ว**:
> - `create_pr_tracking_schema.sql` - Schema v2.0
> - `sync-pr-po-new.js` - Sync script สำหรับ v2.0
> - `drop-old-schema.js` - สคริปต์ลบ schema v1.0

ระบบติดตามสถานะ Purchase Request (PR) และ Purchase Order (PO) จาก SAP B1 (เวอร์ชันอัพเกรด)

---

## 🎯 ภาพรวมระบบ v2.0

ระบบนี้ดึงข้อมูล PR-PO จาก SAP B1 (SQL Server) มาเก็บใน PostgreSQL แล้วแสดงผลผ่าน Web Application ที่สร้างด้วย Next.js + tRPC + Prisma

### ✨ Features ใหม่ในแผน v2.0

- 📋 **UPSERT แทน TRUNCATE**: ประสิทธิภาพดีขึ้น ไม่ต้องลบข้อมูลทั้งหมดทุกครั้ง
- 📋 **Transaction Safety**: ใช้ ACID Transaction ป้องกันข้อมูลเสียหาย
- 📋 **Normalized Schema**: แยก tables เป็น pr_master, pr_lines, pr_po_link
- 📋 **Materialized View**: Query เร็วขึ้นด้วย mv_pr_summary
- 📋 **Card Layout UI**: แสดงผล PR เป็น cards แทน table (อ่านง่ายกว่า)
- 📋 **Detail Page**: หน้ารายละเอียด PR แต่ละใบแยกจากหน้าหลัก
- 📋 **Real-time Stats**: แสดงสถิติ PR ทั้งหมด, เปิดอยู่, ยังไม่ครบ

### 🔄 ความแตกต่างจาก v1.0

| Feature | v1.0 (Current) | v2.0 (Planned) |
|---------|----------------|----------------|
| **Schema** | Single table (PurchaseRequestPO) | Normalized (pr_master, pr_lines, pr_po_link) |
| **Sync** | Truncate & Reload | UPSERT with Transaction |
| **UI** | Table Layout | Card Layout + Detail Pages |
| **Stats** | Basic | Real-time Dashboard |
| **Performance** | Good | Better (normalized + indexed) |
| **Status** | ✅ Production | 📋 Planned |

---

## 📋 ขั้นตอนการติดตั้ง

### 1. ลบ Schema เก่า

```bash
node drop-old-schema.js
```

หรือใช้ SQL โดยตรง:
```sql
DROP TABLE IF EXISTS "PurchaseRequestPO" CASCADE;
DROP MATERIALIZED VIEW IF EXISTS pr_po_summary CASCADE;
```

### 2. สร้าง Schema ใหม่

ใช้ไฟล์ `create_pr_tracking_schema.sql`

**วิธีที่ 1: ใช้ psql**
```bash
psql -U your_user -d your_database -f create_pr_tracking_schema.sql
```

**วิธีที่ 2: ใช้ pgAdmin**
1. เปิด pgAdmin
2. เชื่อมต่อ database
3. คลิกขวาที่ database > Query Tool
4. เปิดไฟล์ `create_pr_tracking_schema.sql`
5. กด Execute (F5)

**วิธีที่ 3: ใช้ DBeaver**
1. เปิด DBeaver
2. เชื่อมต่อ database
3. SQL Editor > เปิดไฟล์
4. Execute SQL Script

### 3. Sync ข้อมูลจาก SAP

**อัปเดต config ใน `sync-pr-po-new.js`:**
```javascript
const pgPool = new Pool({
  host: 'localhost',           // หรือ IP ของ PostgreSQL server
  port: 5432,
  database: 'your_database',   // ชื่อ database
  user: 'your_user',           // username
  password: 'your_password',   // password
});
```

**รัน sync script:**
```bash
node sync-pr-po-new.js
```

**ผลลัพธ์ที่คาดหวัง:**
```
🔄 เริ่มการซิงค์ข้อมูล PR-PO (Schema v2.0)...
📡 กำลังเชื่อมต่อ SQL Server (SAP B1)...
✓ เชื่อมต่อ SQL Server สำเร็จ
📥 กำลังดึงข้อมูลจาก SAP...
✓ ดึงข้อมูลได้ 1,234 รายการ
🔄 กำลังแปลงข้อมูลเป็น JSON format...
✓ แปลงข้อมูลเสร็จสิ้น:
  - PR Master: 456 รายการ
  - PR Lines: 789 รายการ
  - PO Links: 234 รายการ
💾 กำลัง UPSERT ข้อมูลเข้า PostgreSQL...
✓ UPSERT เสร็จสิ้น (ใช้เวลา 5.23 วินาที)
📊 สรุปผลการ UPSERT:
  - PR Master: 456 รายการ
  - PR Lines: 789 รายการ
  - PO Links: 234 รายการ
  - สถานะ: SUCCESS
🔄 กำลัง Refresh Materialized View...
✓ Refreshed successfully in 2.15 seconds
✅ การซิงค์ข้อมูลเสร็จสมบูรณ์!
```

### 4. ตั้งค่า Web Application

**อัปเดต `.env`:**
```env
# PostgreSQL (สำหรับ Prisma และ raw queries)
DATABASE_URL="postgresql://user:password@localhost:5432/database?schema=public"

# สำหรับ sync script
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your_database
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
```

**ติดตั้ง dependencies:**
```bash
npm install
```

**รัน development server:**
```bash
npm run dev
```

**เปิด browser:**
```
http://localhost:3000/pr-tracking
```

---

## 🗂️ โครงสร้าง Database Schema v2.0

### Tables

#### 1. `pr_master` (ข้อมูลหลักของ PR)
```sql
- doc_num (INTEGER, UNIQUE)     -- เลขที่ PR
- req_name (VARCHAR)            -- ชื่อผู้เปิด PR
- department_name (VARCHAR)     -- หน่วยงาน
- doc_date (DATE)               -- วันที่เปิด PR
- doc_due_date (DATE)           -- วันที่ครบกำหนด
- doc_status (VARCHAR)          -- สถานะ (O=Open, C=Closed)
- ...และอื่นๆ
```

#### 2. `pr_lines` (รายละเอียดแต่ละ line ของ PR)
```sql
- pr_doc_num (INTEGER)          -- เลขที่ PR (FK)
- line_num (INTEGER)            -- เลขบรรทัด (0, 1, 2, ...)
- item_code (VARCHAR)           -- รหัสสินค้า
- description (TEXT)            -- ชื่อสินค้า/รายการ
- quantity (NUMERIC)            -- จำนวนที่ขอ
- has_po (BOOLEAN)              -- Flag: มี PO แล้วหรือยัง
- ...และอื่นๆ
```

#### 3. `pr_po_link` (ความสัมพันธ์ PR-PO)
```sql
- pr_doc_num (INTEGER)          -- เลขที่ PR (FK)
- pr_line_description (TEXT)    -- รายละเอียดสินค้า (PR)
- po_doc_num (INTEGER)          -- เลขที่ PO
- po_quantity (NUMERIC)         -- จำนวนใน PO
- ...และอื่นๆ
```

#### 4. `sync_log` (บันทึกประวัติการ sync)
```sql
- sync_date (TIMESTAMP)         -- วันที่ sync
- pr_updated (INTEGER)          -- จำนวน PR ที่อัปเดต
- duration_seconds (NUMERIC)    -- เวลาที่ใช้
- status (VARCHAR)              -- สถานะ (SUCCESS, FAILED)
```

### Views

#### 1. `vw_pr_detail` (รายละเอียด PR พร้อม PO)
```sql
SELECT * FROM vw_pr_detail WHERE pr_doc_num = 1234;
```

#### 2. `vw_pr_pending` (PR ที่ยังไม่ครบทุก line)
```sql
SELECT * FROM vw_pr_pending ORDER BY pr_date ASC;
```

#### 3. `vw_po_summary` (สรุป PO แต่ละใบ)
```sql
SELECT * FROM vw_po_summary WHERE po_doc_num = 5678;
```

### Materialized View

#### `mv_pr_summary` (สรุป PR ทั้งหมด - สำหรับแสดงผลหน้าหลัก)
```sql
SELECT * FROM mv_pr_summary
WHERE doc_status = 'O' AND is_complete = FALSE
ORDER BY doc_date DESC;
```

**Refresh Materialized View:**
```sql
-- วิธีที่ 1: ใช้ function
SELECT quick_refresh_view();

-- วิธีที่ 2: SQL โดยตรง
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;
```

---

## 🔧 การใช้งาน

### 1. หน้า PR Tracking (`/pr-tracking`)

**ฟีเจอร์:**
- 📊 แสดงสถิติ: PR ทั้งหมด, เปิดอยู่, ยังไม่ครบ, Lines ที่ยังไม่มี PO
- 🔍 Filter: วันที่, Series, สถานะ, ค้นหาชื่อ/หน่วยงาน
- ☑️ เฉพาะ PR ที่ยังไม่ครบ (checkbox)
- 🔄 ปุ่ม Sync ข้อมูลจาก SAP
- 📇 แสดง PR เป็น cards (ไม่ใช่ table)
- 📈 แสดง progress bar (% ของ lines ที่มี PO แล้ว)

**วิธีใช้:**
1. เลือกช่วงวันที่ (จาก-ถึง)
2. กดปุ่ม "🔍 ค้นหา"
3. คลิกที่ PR card เพื่อดูรายละเอียด

### 2. หน้า PR Detail (`/pr-detail/[prNo]`)

**ฟีเจอร์:**
- 📋 แสดงข้อมูล PR หลัก
- 📑 แสดงรายการ Lines ทั้งหมด
- 🔗 แสดง PO ที่ผูกกับแต่ละ line
- ✅ สถานะ: มี PO แล้ว / ยังไม่มี PO
- 📊 แสดงรายละเอียด PO (เลขที่, จำนวน, หน่วย, ครบกำหนด)

**วิธีใช้:**
1. จากหน้า PR Tracking คลิกที่ PR card
2. หรือเข้า URL โดยตรง: `/pr-detail/1234`

### 3. การ Sync ข้อมูล

**วิธีที่ 1: ผ่าน Web App**
```
1. เข้าหน้า /pr-tracking
2. กดปุ่ม "🔄 ซิงค์ข้อมูล"
3. รอประมาณ 10-30 วินาที
```

**วิธีที่ 2: ผ่าน Command Line**
```bash
node sync-pr-po-new.js
```

**วิธีที่ 3: ตั้งเวลา (Cron Job)**
```bash
# Linux/Mac
crontab -e

# เพิ่มบรรทัดนี้ (sync ทุกวันเวลา 02:00)
0 2 * * * cd /path/to/my-t3-app && node sync-pr-po-new.js >> sync.log 2>&1

# Windows (Task Scheduler)
# สร้าง Scheduled Task ให้รัน: node sync-pr-po-new.js
```

---

## 📊 Database Performance

### ประมาณการเวลา Sync

| จำนวน PR | จำนวน Records | เวลา Sync | เวลา Refresh View |
|----------|---------------|-----------|-------------------|
| 1,000    | ~5,000        | 2-5 วิ    | 1-2 วิ            |
| 10,000   | ~50,000       | 10-20 วิ  | 3-5 วิ            |
| 50,000   | ~250,000      | 50-90 วิ  | 10-15 วิ          |

### Query Performance

```sql
-- ❌ ช้า (query จาก raw tables)
SELECT * FROM pr_master pm
LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
WHERE pm.doc_status = 'O';

-- ✅ เร็ว (query จาก materialized view)
SELECT * FROM mv_pr_summary
WHERE doc_status = 'O';
```

### Maintenance Commands

```sql
-- ✅ Vacuum และ Analyze (ควรรันเป็นประจำ)
VACUUM ANALYZE pr_master;
VACUUM ANALYZE pr_lines;
VACUUM ANALYZE pr_po_link;

-- ✅ Reindex (ถ้า query ช้าลง)
REINDEX TABLE pr_master;
REINDEX TABLE pr_lines;

-- ✅ ดู Table Size
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔍 Query ตัวอย่าง

### 1. ดู PR ที่ยังไม่ครบทุก line

```sql
SELECT * FROM vw_pr_pending
ORDER BY doc_date ASC;
```

### 2. ดูรายละเอียด PR เฉพาะใบ

```sql
SELECT * FROM vw_pr_detail
WHERE pr_doc_num = 1234
ORDER BY pr_line_num ASC;
```

### 3. ดู PR ที่ยังไม่มี PO เลย

```sql
SELECT * FROM mv_pr_summary
WHERE total_lines > 0
AND lines_with_po = 0
AND doc_status = 'O';
```

### 4. ดูสถิติรายเดือน

```sql
SELECT
    DATE_TRUNC('month', doc_date) AS month,
    COUNT(*) AS total_pr,
    COUNT(*) FILTER (WHERE is_complete = TRUE) AS completed_pr,
    COUNT(*) FILTER (WHERE is_complete = FALSE) AS pending_pr
FROM mv_pr_summary
WHERE doc_date >= '2025-01-01'
GROUP BY month
ORDER BY month DESC;
```

### 5. ดู PR ที่ครบกำหนดใน 7 วันข้างหน้า

```sql
SELECT * FROM mv_pr_summary
WHERE doc_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
AND is_complete = FALSE
AND doc_status = 'O'
ORDER BY doc_due_date ASC;
```

### 6. ดู Sync Log

```sql
SELECT
    sync_date,
    sync_type,
    pr_updated,
    pr_lines_updated,
    po_links_updated,
    ROUND(duration_seconds, 2) AS duration_sec,
    status
FROM sync_log
ORDER BY sync_date DESC
LIMIT 10;
```

---

## 🛠️ Troubleshooting

### ปัญหา 1: Sync ล้มเหลว

**Error:** `UPSERT failed: ...`

**วิธีแก้:**
1. ตรวจสอบ sync_log:
```sql
SELECT * FROM sync_log WHERE status = 'FAILED' ORDER BY sync_date DESC LIMIT 1;
```

2. ดู error_message และแก้ไข
3. ลองรัน sync อีกครั้ง

### ปัญหา 2: Materialized View ไม่อัปเดต

**วิธีแก้:**
```sql
-- Refresh แบบ manual
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;

-- หรือใช้ function
SELECT quick_refresh_view();
```

### ปัญหา 3: Query ช้า

**วิธีแก้:**
```sql
-- ตรวจสอบ query plan
EXPLAIN ANALYZE
SELECT * FROM mv_pr_summary WHERE doc_status = 'O';

-- ถ้าไม่ใช้ index ให้ REINDEX
REINDEX TABLE pr_master;

-- Vacuum และ Analyze
VACUUM ANALYZE pr_master;
VACUUM ANALYZE pr_lines;
VACUUM ANALYZE pr_po_link;
```

### ปัญหา 4: Connection Pool Error

**Error:** `remaining connection slots are reserved`

**วิธีแก้:**
```javascript
// ใน sync-pr-po-new.js
const pgPool = new Pool({
  // ... config
  max: 10,          // เพิ่มจำนวน connection
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### ปัญหา 5: Web App ไม่แสดงข้อมูล

**วิธีตรวจสอบ:**
1. ตรวจสอบ DATABASE_URL ใน `.env`
2. ตรวจสอบว่ามี schema ใหม่หรือยัง:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

3. ตรวจสอบว่ามีข้อมูลหรือไม่:
```sql
SELECT COUNT(*) FROM mv_pr_summary;
```

---

## 📝 คำแนะนำเพิ่มเติม (สำหรับ v2.0)

### 1. Backup Database

```bash
# Backup
pg_dump -U user -d database -F c -b -v -f pr_backup.dump

# Restore
pg_restore -U user -d database -v pr_backup.dump
```

### 2. Monitor Performance

```sql
-- ดู active queries
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY query_start;

-- ดู slow queries
SELECT calls, total_exec_time, mean_exec_time, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 3. Optimize Settings (postgresql.conf)

```conf
shared_buffers = 256MB              # 25% ของ RAM
effective_cache_size = 1GB          # 50% ของ RAM
maintenance_work_mem = 64MB
work_mem = 16MB
max_connections = 100
```

---

## 🚀 Migration Path (v1.0 → v2.0)

### ขั้นตอนการอัพเกรด (เมื่อพร้อม implement)

1. **Backup ข้อมูล v1.0**
   ```bash
   pg_dump -U postgres -d postgres -F c -f backup_v1.dump
   ```

2. **ลบ schema เก่า**
   ```bash
   node drop-old-schema.js
   ```

3. **สร้าง schema v2.0**
   ```bash
   psql -U postgres -d postgres -f create_pr_tracking_schema.sql
   ```

4. **Sync ข้อมูลแรก**
   ```bash
   node sync-pr-po-new.js
   ```

5. **ตรวจสอบข้อมูล**
   ```sql
   SELECT COUNT(*) FROM pr_master;
   SELECT COUNT(*) FROM pr_lines;
   SELECT COUNT(*) FROM pr_po_link;
   SELECT COUNT(*) FROM mv_pr_summary;
   ```

6. **อัพเดต Web App** (ถ้ามีการเปลี่ยน UI)
   ```bash
   npm install
   npm run build
   npm run start
   ```

---

## ⚠️ สถานะปัจจุบัน

**สถานะ**: 📋 **PLANNED** (ยังไม่ได้ implement)

**ไฟล์ที่เตรียมไว้**:
- ✅ `create_pr_tracking_schema.sql` - SQL schema v2.0
- ✅ `sync-pr-po-new.js` - Sync script
- ✅ `drop-old-schema.js` - Drop v1.0 script
- ✅ `README_PR_TRACKING_V2.md` - เอกสารนี้

**สิ่งที่ต้องทำเพื่อ implement v2.0**:
1. 📋 อัพเดต Prisma schema ให้รองรับ tables ใหม่
2. 📋 อัพเดต tRPC routers สำหรับ schema v2.0
3. 📋 สร้าง UI แบบ Card Layout
4. 📋 สร้างหน้า Detail Page
5. 📋 ทดสอบ sync script
6. 📋 ทดสอบ web application
7. 📋 Migration plan และ rollback plan

**แนะนำ**: ใช้ v1.0 ต่อไปจนกว่าจะมีความจำเป็นต้องอัพเกรดหรือข้อมูลโตเกิน 100k records

---

## 👥 ทีมพัฒนา

- **Database Schema**: v2.0 (Normalized + Materialized View) - Planned
- **Backend**: Next.js + tRPC + Prisma
- **Frontend**: React + TailwindCSS
- **Database**: PostgreSQL 14+

---

## 📄 License

Internal Use Only - TMK Company

---

## 🔗 Links

- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [README.md](./README.md) - เอกสารสำหรับ v1.0 (Current)
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - สรุปโปรเจกต์โดยรวม

---

**สร้างเมื่อ**: 2025-01-23
**เวอร์ชัน**: 2.0 (PLANNED)
**สถานะ**: 📋 In Planning
**Current Production**: v1.0
