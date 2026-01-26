# PR Tracking System - Deployment Guide

> 📚 **หมายเหตุ**: เอกสารนี้เป็น deployment guide แบบย่อ
>
> สำหรับข้อมูลครบถ้วน กรุณาดูที่ [README.md - Deployment Section](./README.md#-deployment)

---

## 📦 Quick Deployment

### Development

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า .env
NEXTAUTH_URL="http://localhost:2025"
DATABASE_URL="postgresql://postgres:1234@localhost:5432/PR_PO"

# 3. สร้าง schema
npm run db:push

# 4. รันเซิร์ฟเวอร์
npm run dev
```

### Production (3 Options)

#### Option 1: PM2 (แนะนำ) ⭐

```bash
# ติดตั้ง PM2
npm install -g pm2

# Build & Start
npm run build
pm2 start npm --name "pr-po-app" -- start

# Auto-start on boot
pm2 startup
pm2 save

# Commands
pm2 status         # ดูสถานะ
pm2 logs pr-po-app # ดู logs
pm2 restart pr-po-app
```

#### Option 2: Windows Service

```bash
# 1. ติดตั้ง node-windows
npm install -g node-windows

# 2. สร้าง install-service.js (ดูตัวอย่างใน README.md)

# 3. รัน script
node install-service.js

# 4. จัดการผ่าน Windows Services
```

#### Option 3: Task Scheduler

1. เปิด Task Scheduler
2. สร้าง Basic Task
3. ตั้งค่า:
   - **Trigger**: At startup
   - **Program**: `C:\Program Files\nodejs\node.exe`
   - **Arguments**: `server.ts`
   - **Start in**: `D:\path\to\app`

---

## 🔧 Environment Variables

### Development

```env
# Next Auth
AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="
NEXTAUTH_URL="http://localhost:2025"
AUTH_URL="http://localhost:2025"
AUTH_TRUST_HOST="true"

# Database
DATABASE_URL="postgresql://postgres:1234@localhost:5432/PR_PO"

# Auth Provider (required)
AUTH_DISCORD_ID="dummy"
AUTH_DISCORD_SECRET="dummy"
```

### Production

```env
# Next Auth (⚠️ เปลี่ยน URL ให้ตรงกับ production!)
AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="
NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_TRUST_HOST="true"

# Database (⚠️ ใช้ IP แทน hostname!)
DATABASE_URL="postgresql://sa:@12345@192.168.1.3:5432/PR_PO"

# SQL Server (SAP B1)
MSSQL_SERVER="SAPSERVERTMK"
MSSQL_DATABASE="TMK_PRD"
MSSQL_USER="powerquery_hq"
MSSQL_PASSWORD="@Tmk963*"
MSSQL_PORT=1433
MSSQL_TRUST_SERVER_CERTIFICATE=true

# Network Share
NETWORK_SHARE_PATH="\\\\10.1.1.199\\b1_shr"
NETWORK_SHARE_USER="B1admin"
NETWORK_SHARE_PASSWORD="On33rp"
```

**⚠️ สำคัญ:**
- ถ้าแก้ไข `.env` ต้อง rebuild: `npm run build`
- ระบบมี auto-sync schedulers อยู่แล้ว

---

## 📁 ไฟล์ที่ต้อง Deploy

### ✅ ต้อง Copy:
- `.next/` - Production build
- `src/` - Source code
- `prisma/` - Database schema
- `public/` - Static files
- `package.json`, `package-lock.json`
- `next.config.js`, `postcss.config.js`, `tsconfig.json`
- `.env` - Environment variables
- `server.ts` - Custom server

### ❌ ไม่ต้อง Copy:
- `node_modules/` - ติดตั้งใหม่บน server
- `scripts/` - Development scripts
- `.git/` - Git repository

---

## 🚀 Deployment Steps (Production Server)

### 1. Copy Files

```bash
# Copy โฟลเดอร์ไปยัง server
# ตัวอย่าง: \\server\share\pr-po-app\
```

### 2. Install Dependencies

```bash
cd /path/to/pr-po-app
npm install --production
```

### 3. Setup Environment

```bash
# แก้ไข .env ให้ตรงกับ production environment
notepad .env
```

### 4. Build & Run

```bash
# Build
npm run build

# Start (เลือก 1 วิธี)
npm start                              # Direct run
pm2 start npm --name "pr-po-app" -- start  # PM2
node install-service.js                # Windows Service
```

### 5. Verify

```bash
# ตรวจสอบว่าทำงาน
curl http://localhost:2025

# ดู logs
pm2 logs pr-po-app  # ถ้าใช้ PM2
```

---

## 📊 Monitoring

### PM2 Commands

```bash
pm2 status                    # ดูสถานะ
pm2 logs pr-po-app           # ดู logs (realtime)
pm2 logs pr-po-app --lines 100  # ดู 100 บรรทัดล่าสุด
pm2 logs pr-po-app --err     # ดู error logs เท่านั้น
pm2 monit                    # Monitor CPU/Memory
pm2 restart pr-po-app        # Restart
pm2 stop pr-po-app           # Stop
pm2 delete pr-po-app         # Remove
```

### Application Logs

- **Sync History**: `/sync-history` ในเว็บ
- **Activity Trail**: บันทึกใน database
- **Console Logs**: PM2 logs หรือ console

---

## 💾 Backup & Restore

### Backup Database

```bash
# Full backup
pg_dump -U postgres -d PR_PO -F c -f backup_$(date +%Y%m%d).dump

# Schema only
pg_dump -U postgres -d PR_PO --schema-only -f schema_backup.sql

# Data only
pg_dump -U postgres -d PR_PO --data-only -f data_backup.sql
```

### Restore Database

```bash
# From .dump file
pg_restore -U postgres -d PR_PO backup_20251125.dump

# From .sql file
psql -U postgres -d PR_PO -f backup.sql
```

**หมายเหตุ:** ไม่จำเป็นต้อง backup บ่อย เพราะข้อมูลสามารถ sync ใหม่จาก SAP ได้

---

## 🔒 Security Checklist

- [ ] ใช้ strong `AUTH_SECRET` (random 32+ characters)
- [ ] ตั้งค่า `AUTH_TRUST_HOST="true"` ใน .env
- [ ] ใช้ HTTPS ใน production (ถ้าเป็นไปได้)
- [ ] จำกัดสิทธิ์ SQL Server user เป็น read-only
- [ ] เก็บ `.env` ไว้นอก git repository
- [ ] ตั้งรหัสผ่าน PostgreSQL ที่แข็งแรง
- [ ] จำกัดการเข้าถึง network share

---

## ⚡ Performance Optimization

1. **Database Indexing** - Prisma สร้าง indexes อัตโนมัติ
2. **Incremental Sync** - ลดเวลา sync จาก 90s → 2-5s
3. **Connection Pooling** - Prisma จัดการอัตโนมัติ
4. **Materialized Views** - สำหรับ complex queries (optional)
5. **Caching** - React Query cache ใน frontend

---

## 🚨 Troubleshooting (Quick Reference)

### Port ถูกใช้งานแล้ว
```bash
netstat -ano | findstr :2025
taskkill /PID [PID] /F
```

### Database Connection Error
```bash
psql -U postgres -d PR_PO -c "SELECT 1;"
```

### ไม่แสดงข้อมูล
```bash
npm run db:studio  # ตรวจสอบข้อมูล
curl http://localhost:2025/api/sync-pr-data  # Sync ใหม่
```

### Service ไม่ทำงาน (PM2)
```bash
pm2 restart pr-po-app
pm2 logs pr-po-app --lines 50
```

**ดู troubleshooting ครบถ้วนที่**: [README.md - Troubleshooting](./README.md#-troubleshooting)

---

## 📚 เอกสารเพิ่มเติม

| เอกสาร | คำอธิบาย |
|--------|----------|
| [README.md](./README.md) | เอกสารหลัก - ครบถ้วนที่สุด ⭐ |
| [CHANGELOG.md](./CHANGELOG.md) | ประวัติการเปลี่ยนแปลง |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | สรุปโปรเจกต์ |

---

## 📞 Support

หากพบปัญหา:

1. ดู [README.md - FAQ](./README.md#-faq-คำถามที่พบบ่อย)
2. ดู [README.md - Troubleshooting](./README.md#-troubleshooting)
3. ตรวจสอบ [CHANGELOG.md](./CHANGELOG.md)

---

**Current Version**: 3.0
**Port**: 2025
**Last Updated**: 2025-11-25

**⚠️ สำหรับข้อมูลครบถ้วน กรุณาดู [README.md](./README.md)**
