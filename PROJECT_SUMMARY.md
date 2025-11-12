# PR-PO Management System

## ภาพรวมโปรเจค
ระบบจัดการ Purchase Request (PR) และ Purchase Order (PO) ที่ดึงข้อมูลจาก SQL Server (SAP B1) และแสดงผลผ่าน Web Application

**วัตถุประสงค์หลัก:**
- ดึงข้อมูล PR-PO จาก SAP Business One (SQL Server) มาเก็บใน PostgreSQL
- แสดงผลข้อมูลผ่าน Web Application ที่ใช้งานง่าย responsive และรวดเร็ว
- ติดตามสถานะ PR และ PO แบบ real-time
- รองรับการ filter และค้นหาข้อมูลแบบละเอียด

## เทคโนโลยีที่ใช้
- **Frontend**: Next.js 15.2.3, React 19, TypeScript, Tailwind CSS 4
- **Backend**: tRPC 11, Next.js API Routes
- **Database**:
  - PostgreSQL (localhost:5432) - สำหรับเก็บข้อมูลที่ sync มา
  - SQL Server (SAPSERVERTMK/TMK_PRD) - Source ข้อมูลหลัก (Read-only)
- **ORM**: Prisma 6.5.0
- **SQL Server Client**: mssql (สำหรับ sync scripts)
- **Authentication**: ไม่มี (ปิดการใช้งาน NextAuth - ใช้งานภายในองค์กร)

## การเชื่อมต่อฐานข้อมูล

### PostgreSQL
```
Host: localhost
Port: 5432
Database: postgres
Username: postgres
Password: 1234
```

### SQL Server (SAP)
```
Server: SAPSERVERTMK
Database: TMK_PRD
User: powerquery_hq
Password: @Tmk963*
```

## โครงสร้างข้อมูล (Prisma Schema)

```prisma
model PurchaseRequestPO {
  id                   Int       @id @default(autoincrement())
  prDocEntry           Int
  prNo                 Int
  prDate               DateTime
  prDueDate            DateTime
  seriesName           String?
  prRequester          String?
  prDepartment         String?
  prJobName            String?
  prRemarks            String?   @db.Text
  prStatus             String
  poNo                 Int?
  poDescription        String?   @db.Text
  poQuantity           Decimal?  @db.Decimal(19, 6)
  poUnit               String?
  poLineNum            Int?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([prDocEntry])
  @@index([prNo])
  @@index([poNo])
  @@index([prDate])
}
```

## Features

### 1. ระบบค้นหาและกรองข้อมูล
- **วันที่เปิด PR (จาก-ถึง)**: กรองตามช่วงวันที่ (required, default = เดือนปัจจุบัน)
- **Series**: PR, PM, PMA, WA, WC, WO, WR
- **สถานะ**: Open, Closed
- **ค้นหา**: PR No, PO No, ชื่อผู้เปิด, หน่วยงาน, ชื่องาน

### 2. Lazy Loading Pattern
- ไม่โหลดข้อมูลทันทีเมื่อเปิดหน้าเว็บ
- ต้องเลือกวันที่และกดปุ่ม "ค้นหา" ก่อน
- ป้องกันการ query ข้อมูลขนาดใหญ่โดยไม่จำเป็น

### 3. การซิงค์ข้อมูล
- **Strategy**: Truncate & Reload (ลบข้อมูลเก่าทั้งหมด แล้วดึงใหม่)
- **แหล่งข้อมูล**: SQL Server (SAP)
- **เวลาประมวลผล**: ~1-2 นาที (34,000+ records)
- **Loading Overlay**: แสดงสถานะการซิงค์และป้องกันการกดซ้ำ

### 4. ตารางข้อมูล
- **รูปแบบ**: Table แบบ Fixed Layout (พอดีหน้าจอ ไม่ต้อง scroll ซ้ายขวา)
- **Sticky Header**: หัวตารางติดด้านบนเมื่อ scroll
- **คอลัมน์ที่แสดง**: 13 คอลัมน์
  - PR No (16px)
  - Series (16px)
  - วันที่ (20px)
  - Due Date (20px)
  - ผู้เปิด (32px)
  - หน่วยงาน (24px)
  - ชื่องาน (28px)
  - หมายเหตุ (32px)
  - สถานะ (14px)
  - PO No (16px)
  - รายละเอียด PO (28px)
  - จำนวน (16px)
  - หน่วย (12px)
- **Text Size**: 10-12px (เพื่อให้พอดีกับหน้าจอ)
- **Truncate**: ข้อความยาวจะถูกตัดและแสดง title tooltip

### 5. Detail Modal
- คลิกที่แถวเพื่อดูรายละเอียดเต็ม
- แสดงข้อมูล PR และ PO แบบครบถ้วน
- ข้อความยาวแสดงแบบ multiline
- ปิดได้ 3 วิธี: ปุ่ม X, ปุ่ม "ปิด", คลิกนอก modal

### 6. การเรียงข้อมูล
- เรียงตามวันที่เปิด PR จากเก่าไปใหม่ (ASC)
- แสดงทุกรายการที่ค้นพบ (ไม่มี pagination)

## SQL Query ที่ใช้ sync ข้อมูล

```sql
SELECT
    T0.DocEntry AS "PR_DocEntry",
    T0.DocNum AS "PR_No",
    T0.DocDate AS "PR_Date",
    T0.DocDueDate AS "PR_DueDate",
    T5.SeriesName AS "SeriesName",
    T0.ReqName AS "PR_Requester",
    T4.Remarks AS "PR_Department",
    T0.U_U_PR_FOR AS "PR_JobName",
    T0.Comments AS "PR_Remarks",
    T0.DocStatus AS "PR_Status",
    T3.DocNum AS "PO_No",
    T1.Dscription AS "PO_Description",
    T1.Quantity AS "PO_Quantity",
    T1.unitMsr AS "PO_Unit",
    T1.LineNum AS "PO_LineNum"
FROM
    OPRQ T0
    LEFT JOIN POR1 T1 ON T1.BaseRef = T0.DocNum
    LEFT JOIN OPOR T3 ON T3.DocEntry = T1.DocEntry
    LEFT JOIN OUDP T4 ON T0.Department = T4.Code
    LEFT JOIN NNM1 T5 ON T0.Series = T5.Series
ORDER BY
    T0.DocDate ASC
```

## API Endpoints (tRPC)

### 1. `prpo.getAll`
**Input:**
```typescript
{
  search?: string,
  status?: string,
  series?: string,
  dateFrom?: string,
  dateTo?: string
}
```
**Output:**
```typescript
{
  data: PurchaseRequestPO[],
  total: number
}
```

### 2. `prpo.getByPRNo`
**Input:**
```typescript
{
  prNo: number
}
```
**Output:**
```typescript
PurchaseRequestPO[]
```

### 3. `prpo.getStats`
**Output:**
```typescript
{
  totalRecords: number,
  prWithoutPO: number,
  statuses: Array<{ status: string, count: number }>,
  lastSync: Date | null
}
```

### 4. `prpo.sync`
**Output:**
```typescript
{
  success: boolean,
  recordsImported: number,
  message: string
}
```

## การติดตั้งและรันโปรเจค

### 1. ติดตั้ง Dependencies
```bash
cd my-t3-app
npm install
```

### 2. ตั้งค่า Environment Variables
ไฟล์: `.env`
```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/postgres"
AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="
AUTH_DISCORD_ID="dummy"
AUTH_DISCORD_SECRET="dummy"
```

### 3. สร้าง Database Schema
```bash
npm run db:push
```

### 4. รัน Development Server
```bash
npm run dev
```
เว็บจะรันที่: http://localhost:2025

## Scripts ที่สำคัญ

### NPM Scripts
```json
{
  "dev": "next dev -p 2025",
  "build": "next build",
  "start": "next start -p 2025",
  "db:push": "prisma db push",
  "db:generate": "prisma generate",
  "db:studio": "prisma studio"
}
```

### Sync Scripts
| Script | คำสั่ง | คำอธิบาย | เวลา |
|--------|--------|----------|------|
| **Truncate & Reload** | `node sync-pr-po-data.js` | ลบข้อมูลเก่า แล้วดึงใหม่ทั้งหมด | 1-2 นาที |
| **Upsert** | `node sync-pr-po-upsert.js` | Insert/Update เฉพาะที่เปลี่ยน | 5-10 นาที |
| **Schema v2.0** | `node sync-pr-po-new.js` | Sync ข้อมูลสำหรับ schema v2.0 | 1-2 นาที |

### Database Scripts
| Script | คำสั่ง | คำอธิบาย |
|--------|--------|----------|
| **Test SQL Server** | `node test-sqlserver.js` | ทดสอบเชื่อมต่อ SQL Server |
| **Test DB Connection** | `node test-db-connection.js` | ทดสอบเชื่อมต่อ PostgreSQL |
| **Drop All Tables** | `node drop-all-tables.js` | ลบตารางทั้งหมดใน PostgreSQL |
| **Drop Old Schema** | `node drop-old-schema.js` | ลบ schema v1.0 (PurchaseRequestPO) |
| **Create Schema** | `node create-schema.js` | สร้าง schema ใหม่ |

### Materialized View Scripts
| Script | คำสั่ง | คำอธิบาย |
|--------|--------|----------|
| **Create MV** | `psql -f create-materialized-view.sql` | สร้าง materialized view (v1.0) |
| **Refresh MV** | `node refresh-materialized-view.js` | Refresh materialized view |
| **Update MV** | `node update-mv-pr-summary.js` | อัพเดต mv_pr_summary |
| **Fix Refresh Function** | `node fix-refresh-function.js` | แก้ไข refresh function |

### Schema v2.0 Scripts (สำหรับอัพเกรด)
| Script | คำสั่ง | คำอธิบาย |
|--------|--------|----------|
| **Create Schema v2.0** | `psql -f create_pr_tracking_schema.sql` | สร้าง schema v2.0 (pr_master, pr_lines, pr_po_link) |
| **Sync v2.0** | `node sync-pr-po-new.js` | Sync ข้อมูลสำหรับ schema v2.0 |

## ไฟล์สำคัญ

```
my-t3-app/
├── src/
│   ├── pages/
│   │   └── index.tsx              # หน้าหลัก (ตาราง PR-PO)
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/
│   │   │   │   └── prpo.ts        # tRPC Router
│   │   │   ├── root.ts            # Root Router
│   │   │   └── trpc.ts            # tRPC Setup (ไม่มี Auth)
│   │   └── db.ts                  # Prisma Client
│   ├── env.js                     # Environment Validation
│   └── utils/
│       └── api.ts                 # tRPC Client
├── prisma/
│   └── schema.prisma              # Database Schema
├── .env                           # Environment Variables
└── package.json
```

## สถิติข้อมูล

- **จำนวนข้อมูลทั้งหมด**: ~34,000+ records
- **Series Types**: 7 ประเภท (PM, PMA, PR, WA, WC, WO, WR)
- **ช่วงเวลาข้อมูล**: 2022-2025

## ปัญหาที่เคยเจอและแก้ไขแล้ว

### 1. NextAuth + Turbopack Compatibility Issue
**ปัญหา**: HTTP 500 error, "Cannot find module 'next/server'"
**แก้ไข**: ปิดการใช้งาน Turbopack (ลบ `--turbo` flag) และ disable NextAuth

### 2. Performance Issue - Initial Load
**ปัญหา**: โหลดช้า เพราะ query ข้อมูล 34k records ทันที
**แก้ไข**: Lazy Loading Pattern (ไม่โหลดจนกว่าจะกดค้นหา)

### 3. Table Horizontal Scroll
**ปัญหา**: ต้อง scroll ซ้ายขวาเพื่อดูคอลัมน์ทั้งหมด
**แก้ไข**: ใช้ table-fixed, ลดขนาดตัวอักษร, กำหนดความกว้างคอลัมน์แน่นอน

## การพัฒนาต่อ (Future Enhancements)

### เสร็จแล้ว ✅
1. ✅ Advanced Filtering (Multiple Series, Date Range)
2. ✅ Detail View Modal
3. ✅ Lazy Loading Pattern
4. ✅ Sync ข้อมูลผ่าน Web UI
5. ✅ Loading Overlay และ Progress Indicator
6. ✅ Sticky Header สำหรับตาราง
7. ✅ Responsive Design

### กำลังพัฒนา 🚧
1. 🚧 Schema v2.0 (Normalized) - เตรียมไฟล์ไว้แล้ว
2. 🚧 Card Layout UI - สำหรับ v2.0
3. 🚧 Real-time Stats Dashboard

### แผนในอนาคต 📋
1. 📋 Export ข้อมูลเป็น Excel/CSV
2. 📋 Pagination หรือ Virtual Scrolling
3. 📋 Real-time Update (WebSocket)
4. 📋 User Authentication & Authorization (ถ้าจำเป็น)
5. 📋 Email Notification สำหรับ PR ที่ครบกำหนด
6. 📋 Dashboard แสดงสถิติแบบกราฟ

## Technical Decisions

### ทำไมเลือก Truncate & Reload?
- ข้อมูลมีขนาดไม่ใหญ่มาก (<100k records)
- Implementation ง่ายและ reliable
- Sync time ยอมรับได้ (1-2 นาที)
- ไม่มีปัญหา Data Consistency

### ทำไมไม่ใช้ Upsert?
- ต้องตรวจสอบ unique key ทุกรายการ
- Performance ช้ากว่า Truncate & Reload
- Logic ซับซ้อนกว่า

### ทำไมปิด NextAuth?
- ไม่มีความจำเป็นต้องใช้ Authentication
- เป็นระบบภายในองค์กร
- หลีกเลี่ยงปัญหา Compatibility กับ Next.js 15

## Version History

### v1.0 (Current) - Schema v1.0
- ✅ Database Schema: `PurchaseRequestPO` (single table)
- ✅ Sync Methods: Truncate & Reload, Upsert
- ✅ Web UI: Table Layout with Filters
- ✅ Features: Lazy Loading, Detail Modal, Sync Button
- ✅ Port: 2025
- ✅ Status: **Production Ready**

### v2.0 (Planned) - Schema v2.0
- 📋 Database Schema: Normalized (pr_master, pr_lines, pr_po_link)
- 📋 Sync Methods: UPSERT with Transaction
- 📋 Web UI: Card Layout + Detail Pages
- 📋 Features: Real-time Stats, Progress Indicators
- 📋 Status: **In Development** (ไฟล์เตรียมไว้แล้ว)

## Deployment Notes

### สำหรับ Shared Folder Deployment

1. **คัดลอกไฟล์ทั้งหมดไปยัง Shared Folder**
   ```
   - โฟลเดอร์ my-t3-app ทั้งหมด
   - รวม node_modules (หรือรัน npm install ที่ server)
   ```

2. **ตั้งค่า Environment Variables บน Server**
   ```env
   DATABASE_URL="postgresql://user:password@server:5432/database"
   AUTH_SECRET="..."
   ```

3. **สร้าง Database Schema บน Server**
   ```bash
   npm run db:push
   ```

4. **Sync ข้อมูลครั้งแรก**
   ```bash
   node sync-pr-po-data.js
   ```

5. **รัน Production Server**
   ```bash
   npm run build
   npm run start
   ```
   หรือใช้ PM2:
   ```bash
   pm2 start npm --name "pr-po-app" -- start
   pm2 save
   ```

6. **ตั้งค่า Scheduled Sync (Windows Task Scheduler)**
   - Program: `node.exe`
   - Arguments: `sync-pr-po-data.js`
   - Start in: `C:\path\to\my-t3-app`
   - Schedule: ทุก 15 นาที (หรือตามต้องการ)

### ข้อควรระวัง
- ⚠️ ตรวจสอบ firewall สำหรับ port 2025
- ⚠️ ตรวจสอบ SQL Server connection จาก server
- ⚠️ Backup database ก่อน deploy
- ⚠️ ทดสอบ sync script บน server ก่อนตั้ง scheduled task

## Contact & Support

สำหรับคำถามหรือปัญหา กรุณาติดต่อ IT Department

---

**Last Updated**: 2025-01-23
**Current Version**: 1.0
**Next.js Version**: 15.2.3
**Database**: PostgreSQL + SQL Server (SAP B1)
