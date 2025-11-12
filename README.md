# PR-PO Data Sync System

โปรเจคสำหรับซิงค์ข้อมูล Purchase Request (PR) และ Purchase Order (PO) จาก SQL Server (SAP B1) ไปยัง PostgreSQL พร้อมแสดงผลผ่าน Web Application

สร้างด้วย [T3 Stack](https://create.t3.gg/) - Next.js 15, tRPC 11, Prisma 6, Tailwind CSS 4

---

## 🚀 Quick Start

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. สร้าง database schema
npm run db:push

# 3. ซิงค์ข้อมูล (แนะนำ - เร็วที่สุด)
node sync-pr-po-data.js

# 4. รัน web application
npm run dev

# เสร็จแล้ว! เข้าใช้งานที่ http://localhost:2025
```

## ภาพรวมระบบ

ระบบนี้ทำการดึงข้อมูล Purchase Request (PR) และ Purchase Order (PO) จาก SQL Server (SAP Business One) แล้วนำเข้าสู่ PostgreSQL เพื่อให้สามารถ query และวิเคราะห์ข้อมูลได้รวดเร็วยิ่งขึ้น

### ข้อมูลที่ซิงค์
- ข้อมูล PR (Purchase Request)
- ข้อมูล PO (Purchase Order)
- ความสัมพันธ์ระหว่าง PR และ PO
- ข้อมูลผู้เปิด PR และหน่วยงาน
- สถานะและรายละเอียดต่างๆ

## การตั้งค่าฐานข้อมูล

### PostgreSQL
```
Host: localhost
Port: 5432
Database: postgres
Username: postgres
Password: 1234
```

### SQL Server (Read-only)
```
Server: SAPSERVERTMK
Database: TMK_PRD
Username: powerquery_hq
Password: @Tmk963*
```

**หมายเหตุ**: SQL Server เป็น read-only เท่านั้น ไม่มีการแก้ไขหรือเขียนข้อมูลลงไป

## การใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
ไฟล์ `.env` ต้องมี configuration ดังนี้:

```env
# Next Auth
AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="

# URL Configuration
NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_TRUST_HOST="true"

# Next Auth Discord Provider (required by schema)
AUTH_DISCORD_ID="dummy"
AUTH_DISCORD_SECRET="dummy"

# Database
DATABASE_URL="postgresql://sa:@12345@192.168.1.3:5432/PR_PO"
```

**สำคัญ:**
- `NEXTAUTH_URL` และ `AUTH_URL` ต้องตรงกับ URL ที่ใช้งานจริง
- สำหรับ development: `http://localhost:2025`
- สำหรับ production: `http://dev.tmkpalmoil.com:2025`

### 3. สร้าง Database Schema
```bash
npm run db:push
```

### 4. ซิงค์ข้อมูลจาก SQL Server

**🚀 Incremental Sync + PO Check (แนะนำ - ใช้ใน Production)** ⭐⭐⭐
- **ดึงเฉพาะข้อมูลที่เปลี่ยนแปลง** ตั้งแต่ครั้งล่าสุด
- **เวลา:** ~2-5 วินาที (เร็วกว่า Full Sync 10-100 เท่า!)
- **Full Sync อัตโนมัติ:** ทุกวันอาทิตย์ เวลา 17:00 น.
- **PO Check:** จับ PR ที่มี PO ใหม่ (แม้ PR.UpdateDate ไม่เปลี่ยน)
- **วิธีใช้:** กดปุ่ม "ซิงค์ข้อมูลจาก SAP" ในหน้า PR Tracking

**ตัวอย่างผลลัพธ์:**
```
ครั้งที่ 1 (FULL sync):     31 วินาที, 23,856 รายการ
ครั้งที่ 2 (INCREMENTAL):   3 วินาที,  0 รายการ (ไม่มีการเปลี่ยนแปลง)
ครั้งที่ 3 (INCREMENTAL):   4 วินาที,  15 รายการ (มีการเปลี่ยน)
```

**ทำงานอย่างไร:**
1. ครั้งแรก → Full Sync (ดึงทุกอย่าง)
2. ครั้งต่อไป → Incremental Sync:
   - เช็ค `PR.UpdateDate > last_sync_date` (PR ที่ถูกแก้ไข)
   - เช็ค `EXISTS(PO.DocDate > last_sync_date)` (PR ที่มี PO ใหม่)
   - ดึงครบทุก line ของ PR (รวม line ที่ไม่มี PO)
3. วันอาทิตย์ 17:00 → Full Sync (เพื่อความแน่ใจ)

---

**📜 วิธีการ Sync แบบอื่นๆ (สำหรับ Development):**

**วิธีที่ 1: Truncate & Reload Script**
```bash
node sync-pr-po-data.js
```
- ลบข้อมูลเก่าทั้งหมด แล้วดึงใหม่ 100%
- ใช้เวลา 1-2 นาที

**วิธีที่ 2: Materialized View Refresh**
```bash
psql -h localhost -U postgres -d postgres -f create-materialized-view.sql
node refresh-materialized-view.js
```
- สำหรับ Reporting / Analytics

📖 **อ่านเพิ่มเติม**: [SYNC_STRATEGIES.md](./SYNC_STRATEGIES.md) - เปรียบเทียบวิธีการซิงค์แบบละเอียด

## Database Schema

### ตาราง: PurchaseRequestPO

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key (auto increment) |
| prDocEntry | Int | PR Document Entry |
| prNo | Int | หมายเลข PR |
| prDate | DateTime | วันที่เปิด PR |
| prDueDate | DateTime | วันที่ครบกำหนด |
| seriesName | String | ชื่อ Series |
| prRequester | String | ผู้เปิด PR |
| prDepartment | String | หน่วยงานผู้เปิด PR |
| prJobName | String | ชื่องาน PR |
| prRemarks | Text | หมายเหตุ |
| prStatus | String | สถานะ PR |
| poNo | Int | หมายเลข PO |
| poDescription | Text | คำอธิบาย PO |
| poQuantity | Decimal | จำนวน |
| poUnit | String | หน่วย |
| poLineNum | Int | หมายเลขบรรทัด PO |
| createdAt | DateTime | วันที่สร้างใน PostgreSQL |
| updatedAt | DateTime | วันที่อัพเดตล่าสุด |

## 📜 สคริปต์ทั้งหมด

### Sync Scripts (ซิงค์ข้อมูล)
| สคริปต์ | คำสั่ง | คำอธิบาย | เวลา | แนะนำ |
|---------|--------|----------|------|-------|
| **Truncate & Reload** | `node sync-pr-po-data.js` | ลบข้อมูลเก่าทั้งหมด แล้วดึงใหม่ | 1-2 นาที | ⭐ **แนะนำ** |
| **Upsert** | `node sync-pr-po-upsert.js` | Insert/Update เฉพาะที่เปลี่ยน | 5-10 นาที | สำหรับข้อมูลเยอะ |
| **Schema v2.0** | `node sync-pr-po-new.js` | Sync สำหรับ schema v2.0 | 1-2 นาที | ใช้ในอนาคต |

### Database Scripts (จัดการฐานข้อมูล)
| สคริปต์ | คำสั่ง | คำอธิบาย |
|---------|--------|----------|
| **Test SQL Server** | `node test-sqlserver.js` | ทดสอบเชื่อมต่อ SQL Server |
| **Test PostgreSQL** | `node test-db-connection.js` | ทดสอบเชื่อมต่อ PostgreSQL |
| **Drop All Tables** | `node drop-all-tables.js` | ลบตารางทั้งหมดใน PostgreSQL |
| **Drop Old Schema** | `node drop-old-schema.js` | ลบ schema v1.0 (เตรียมอัพเกรด v2.0) |
| **Create Schema** | `node create-schema.js` | สร้าง database schema |

### Materialized View Scripts (เพิ่มประสิทธิภาพ Query)
| สคริปต์ | คำสั่ง | คำอธิบาย | เวลา |
|---------|--------|----------|------|
| **Create MV** | `psql -f create-materialized-view.sql` | สร้าง materialized view | 2-3 วิ |
| **Refresh MV** | `node refresh-materialized-view.js` | Refresh materialized view | 2-3 วิ |
| **Update MV** | `node update-mv-pr-summary.js` | อัพเดต mv_pr_summary | 2-3 วิ |
| **Fix Refresh Func** | `node fix-refresh-function.js` | แก้ไข refresh function | ทันที |

### Web Application Scripts
| สคริปต์ | คำสั่ง | คำอธิบาย |
|---------|--------|----------|
| **Development** | `npm run dev` | รัน dev server (port 2025) |
| **Build** | `npm run build` | Build production |
| **Start** | `npm run start` | รัน production server |
| **DB Push** | `npm run db:push` | Push Prisma schema ไปยัง DB |
| **DB Studio** | `npm run db:studio` | เปิด Prisma Studio |

### ไฟล์เสริม
- `create-materialized-view.sql` - SQL สำหรับสร้าง Materialized View (v1.0)
- `create_pr_tracking_schema.sql` - SQL สำหรับสร้าง Schema v2.0
- `SYNC_STRATEGIES.md` - เอกสารเปรียบเทียบกลยุทธ์การซิงค์
- `SYNC_HISTORY.md` - เอกสาร Sync History & Change Tracking ⭐ NEW
- `PROJECT_SUMMARY.md` - สรุปโปรเจกต์โดยละเอียด

## สถิติข้อมูล

- **จำนวนรายการทั้งหมด**: 34,349 รายการ
- **แหล่งข้อมูล**: SQL Server (SAP Business One - TMK_PRD)
- **ปลายทาง**: PostgreSQL (localhost)
- **ตาราง**: PurchaseRequestPO

### ความสัมพันธ์ PR-PO
- **1 PR : 0 PO** = PR ที่ยังไม่มี PO (รอดำเนินการ)
- **1 PR : 1 PO** = PR ที่มี PO เดียว
- **1 PR : N PO** = PR ที่มีหลาย PO (แยกซื้อหลายครั้ง)

ในตาราง `PurchaseRequestPO`:
- PR เดียวกันที่มีหลาย PO จะมี**หลาย rows** (แต่ละ PO line 1 row)
- ดูรวมได้จาก Materialized View `pr_po_summary` (group by PR)

## Use Cases

### 1. เว็บแสดงข้อมูล PR-PO (View Only)
- แสดงรายการ PR ทั้งหมด
- แสดงสถานะ PR (เปิด/ปิด/รอ)
- แสดง PO ที่เกี่ยวข้องกับแต่ละ PR
- กรองข้อมูลตามวันที่, ผู้เปิด PR, หน่วยงาน
- **ไม่มีการแก้ไขข้อมูล** (แก้ไขใน SAP เท่านั้น)

### 2. Dashboard และ Reporting
- สรุปจำนวน PR แยกตามสถานะ
- สรุปจำนวน PO แยกตามเดือน
- แสดง PR ที่ยังไม่มี PO
- แสดง PR ที่มีหลาย PO
- วิเคราะห์เวลาตั้งแต่เปิด PR จนได้ PO

### 3. Workflow ทั่วไป
```
1. User เปิด PR ใน SAP
   ↓
2. ระบบซิงค์ข้อมูลจาก SQL Server ไปยัง PostgreSQL
   ↓
3. User ดูข้อมูล PR บนเว็บ
   ↓
4. Admin อนุมัติ PR ใน SAP → สร้าง PO
   ↓
5. ระบบซิงค์ข้อมูล PO ใหม่
   ↓
6. User เห็น PO ที่เกี่ยวข้องบนเว็บ
```

## Tech Stack

- **Frontend**: Next.js 15 + React 19
- **Backend**: tRPC + NextAuth.js
- **Database**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS
- **SQL Server Client**: mssql

## FAQ

### Q: ทำไมมีตารางอื่นๆ (User, Account, Session) ด้วย?
A: เป็นตารางที่มากับ NextAuth.js (authentication) โดย default ไม่ต้องลบ ไม่กระทบการทำงาน

### Q: วิธีไหนเหมาะกับโปรเจคนี้ที่สุด?
A: **Truncate & Reload** (วิธีที่ 1) เพราะข้อมูล 34k รายการ sync แค่ 1-2 นาที ไม่จำเป็นต้องใช้วิธีซับซ้อน

### Q: ข้อมูลจะไม่ซ้ำใช่ไหม?
A: ใช่ ถ้าใช้ Truncate & Reload จะลบข้อมูลเก่าทิ้งก่อน แล้วดึงใหม่ทั้งหมด ไม่มีทางซ้อน

### Q: PR 1 อันมีหลาย PO จัดการยังไง?
A: ในตาราง `PurchaseRequestPO` จะมีหลาย rows สำหรับ PR เดียวกัน (แต่ละ PO line 1 row) หรือจะดูแบบ summary จาก Materialized View `pr_po_summary` (group by PR)

### Q: ถ้าต้องการ realtime data ทำยังไง?
A: ตั้ง scheduled task (เช่น Windows Task Scheduler หรือ cron) ให้รันสคริปต์ `sync-pr-po-data.js` ทุกๆ 5-15 นาที

### Q: ทำไมไม่แก้ไขข้อมูลใน PostgreSQL แล้ว sync กลับไป SQL Server?
A: เพราะ SQL Server เป็น source of truth (SAP Business One) การแก้ไขต้องทำใน SAP เท่านั้น PostgreSQL เป็นแค่ read-only copy สำหรับ view/reporting

### Q: ควรใช้ Materialized View หรือไม่?
A: ใช้เมื่อต้องการ:
- Query ที่ซับซ้อน (aggregation, grouping)
- Dashboard/Reporting ที่ไม่ต้องการข้อมูล realtime
- ความเร็วในการ query สูงสุด

### Q: ต้อง refresh Materialized View บ่อยแค่ไหน?
A: ขึ้นอยู่กับความต้องการ:
- **Realtime**: refresh หลัง sync ทุกครั้ง (ใช้เวลา 2-3 วินาที)
- **Daily**: refresh วันละครั้ง
- **On-demand**: refresh เมื่อต้องการดู report

---

## 🚨 Troubleshooting

### ปัญหา: UntrustedHost Error
```
[auth][error] UntrustedHost: Host must be trusted. URL was: http://localhost:2025/api/auth/session
```

**แก้ไข:**
1. เพิ่ม `NEXTAUTH_URL` และ `AUTH_URL` ในไฟล์ `.env`:
   ```env
   NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
   AUTH_URL="http://dev.tmkpalmoil.com:2025"
   AUTH_TRUST_HOST="true"
   ```
2. Build ใหม่:
   ```bash
   npm run build
   npm start
   ```

### ปัญหา: Sync ล้มเหลว / Connection Error
```bash
# ตรวจสอบการเชื่อมต่อ SQL Server
node test-sqlserver.js

# ตรวจสอบการเชื่อมต่อ PostgreSQL
node test-db-connection.js
```

### ปัญหา: Web ไม่แสดงข้อมูล
```bash
# 1. ตรวจสอบว่ามีข้อมูลใน database หรือไม่
npm run db:studio

# 2. ลองซิงค์ข้อมูลใหม่
node sync-pr-po-data.js

# 3. Restart web server
npm run dev
```

### ปัญหา: Port 2025 ถูกใช้งานแล้ว
```bash
# Windows - ค้นหาและปิด process
netstat -ano | findstr :2025
taskkill /PID [PID] /F

# หรือเปลี่ยน port ในไฟล์ package.json
# "dev": "next dev -p 3000"
```

### ปัญหา: Database Schema ไม่ตรง
```bash
# ลบตารางทั้งหมดและสร้างใหม่
node drop-all-tables.js
npm run db:push
node sync-pr-po-data.js
```

---

## 📦 Deployment

### สำหรับ Shared Folder / Network Drive

1. **คัดลอกโฟลเดอร์ my-t3-app ทั้งหมด**
   ```
   \\server\shared\pr-po-app\
   ```

2. **ติดตั้ง dependencies บน server**
   ```bash
   cd \\server\shared\pr-po-app
   npm install --production
   ```

3. **ตั้งค่า .env บน server**
   ```env
   # Next Auth
   AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="

   # Production URL (ต้องตั้งให้ตรงกับ domain/IP ที่ใช้งานจริง)
   NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
   AUTH_URL="http://dev.tmkpalmoil.com:2025"
   AUTH_TRUST_HOST="true"

   # Auth Provider (required)
   AUTH_DISCORD_ID="dummy"
   AUTH_DISCORD_SECRET="dummy"

   # Database
   DATABASE_URL="postgresql://sa:@12345@192.168.1.3:5432/PR_PO"
   ```

   **⚠️ หมายเหตุ:** ถ้าแก้ไข `.env` ต้อง `npm run build` ใหม่ทุกครั้ง

4. **สร้าง schema และ sync ข้อมูล**
   ```bash
   npm run db:push
   node sync-pr-po-data.js
   ```

5. **Build และรัน production**
   ```bash
   npm run build
   npm run start
   ```

6. **ตั้ง Windows Task Scheduler (Auto Sync)**
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `sync-pr-po-data.js`
   - Start in: `\\server\shared\pr-po-app`
   - Trigger: ทุก 15 นาที (หรือตามต้องการ)

### สำหรับ Production Server (PM2)

```bash
# ติดตั้ง PM2
npm install -g pm2

# Build และรัน
npm run build
pm2 start npm --name "pr-po-app" -- start

# ตั้งให้รันอัตโนมัติเมื่อ restart server
pm2 startup
pm2 save

# ดู logs
pm2 logs pr-po-app

# Restart
pm2 restart pr-po-app
```

---

## 📋 Version & Updates

**Current Version**: v1.2.0 ✅ Production Ready
**Schema**: Schema v2.0 (pr_master, pr_lines, pr_po_link, mv_pr_summary)
**Port**: 2025
**Production URL**: http://dev.tmkpalmoil.com:2025/pr-tracking
**Last Updated**: 2025-10-24
**Build**: Production build completed

### v1.2.0 Updates (2025-10-24) - PO Check 🎯
- ✅ **EXISTS-based PO Check** - จับ PR ที่มี PO ใหม่ (แม้ PR.UpdateDate ไม่เปลี่ยน)
- ✅ **Complete Line Fetch** - ดึงครบทุก line ของ PR (รวม line ที่ไม่มี PO)
- ✅ **Edge Case Handling** - เปิด PR + สร้าง PO วันเดียวกัน
- ✅ **100% Accuracy** - ไม่พลาดข้อมูล

**ตัวอย่าง:**
- เช้า: เปิด PR-001 (6 lines, UpdateDate = 2025-10-24)
- บ่าย: สร้าง PO-001 (5 lines มี PO, 1 line ไม่มี PO)
- ✅ **EXISTS จับได้ → ดึงทั้ง 6 lines ครบ!**

### v1.1.0 Updates (2025-10-24) - Incremental Sync 🚀
- ✅ **Incremental Sync Implementation** - ดึงเฉพาะข้อมูลที่เปลี่ยนแปลง
- ✅ **Auto Full Sync** - ทุกวันอาทิตย์ เวลา 17:00 น.
- ✅ **ประสิทธิภาพเพิ่มขึ้น 10-100 เท่า** - จาก 30s → 2-5s
- ✅ **Sync Logging** - บันทึกประวัติ sync ทุกครั้ง (sync_type, duration, records_processed)
- ✅ **Smart Detection** - ตรวจสอบ UpdateDate จาก SAP B1 อัตโนมัติ

**Performance:**
- FULL sync: ~30 วินาที (23,000+ รายการ)
- INCREMENTAL sync: ~3 วินาที (0-100 รายการโดยเฉลี่ย)
- ประหยัดเวลา: **90%+**

### 🚀 v1.1.0 Features (2025-10-25)
- ✅ **Smart Sync Strategy** - Auto switch Full/Incremental Sync
  - 🌙 Full Sync ทุกวันตีหนึ่ง (01:00-01:59)
  - ⚡ Incremental Sync เวลาอื่นๆ (เร็วกว่า 30-50 เท่า)
- ✅ **Sync History & Change Tracking**
  - 📊 หน้า `/sync-history` - ดูประวัติการ sync
  - 🔍 Date filter - กรองตามช่วงวันที่
  - 📝 Detailed logs - รายละเอียดทุกการเปลี่ยนแปลง
  - 🟢 PR_NEW, 🔵 PR_UPDATED, 🟡 PR_STATUS_CHANGED, 🟣 PO_LINKED
- ✅ **Database Tables**
  - `sync_log` - บันทึก sync sessions
  - `sync_change_log` - บันทึก changes (Incremental only)
- ✅ **tRPC APIs**
  - `pr.getSyncHistory` - ดึง sync history พร้อม changes
  - `pr.getSyncChanges` - ดึง changes ของ sync session
- ✅ **Performance**: Incremental Sync 2-5 วินาที (vs Full Sync 60-90 วินาที)

### v1.0.1 Updates (2025-10-24)
- ✅ เพิ่ม NextAuth URL configuration ใน .env
- ✅ แก้ไข UntrustedHost error
- ✅ อัพเดท documentation สำหรับ production deployment
- ✅ เปลี่ยน Database URL จาก server name เป็น IP address

### ✨ v1.0.0 Features (2025-10-24)
- ✅ PR Card View with Progress Bar
- ✅ PR Detail View with Lines and PO
- ✅ Filter System (Date range, Status, Search)
- ✅ Sticky Filter Bar
- ✅ Statistics Cards (based on date range)
- ✅ SAP B1 Data Sync
- ✅ Materialized View for Performance
- ✅ Auto-redirect from `/` to `/pr-tracking`

### 📝 Rollback Information
See [CHANGELOG.md](./CHANGELOG.md) for rollback instructions and version history.

**Previous Versions**:
- v0.x: Single table schema (deprecated)

**Deployment**:
```bash
npm run build  # Production build ✅
npm start      # Start production server
```

---

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
