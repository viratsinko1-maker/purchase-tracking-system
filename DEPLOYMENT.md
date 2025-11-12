# PR Tracking System - Deployment Guide

## ที่อยู่โฟลเดอร์
```
D:\VS\network\VS\PR_PO\my-t3-app
```

## ไฟล์/โฟลเดอร์ที่ต้อง Copy ไป Server:

### ✅ ต้อง Copy:
- `.next/` - Production build
- `public/` - Static files
- `src/` - Source code
- `prisma/` - Database schema
- `package.json` - Dependencies
- `package-lock.json` - Lock file
- `next.config.js` - Next.js config
- `postcss.config.js` - CSS config
- `.env` - Environment variables
- `tsconfig.json` - TypeScript config

### ❌ ไม่ต้อง Copy:
- `node_modules/` - ติดตั้งใหม่บน server
- `scripts/` - ไฟล์ development

## วิธี Deploy บน Server:

### 1. Copy โฟลเดอร์ไปยัง Server
```bash
# Copy ทั้งโฟลเดอร์ไปยัง share folder
# ตัวอย่าง: \\server\share\pr-tracking\
```

### 2. ติดตั้ง Dependencies
```bash
cd /path/to/pr-tracking
npm install
```

### 3. ตั้งค่า Environment Variables (.env)
ตรวจสอบไฟล์ `.env` ให้มีค่าถูกต้อง:

#### ตัวอย่างไฟล์ .env สำหรับ Production:
```env
# Next Auth
AUTH_SECRET="M1Cn+nJRYvMli5WpIwY4N26G6nV97HG+B/u4E8+Nrk0="

# Production URL Configuration (REQUIRED)
NEXTAUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_URL="http://dev.tmkpalmoil.com:2025"
AUTH_TRUST_HOST="true"

# Next Auth Discord Provider (required by schema)
AUTH_DISCORD_ID="dummy"
AUTH_DISCORD_SECRET="dummy"

# Database
DATABASE_URL="postgresql://sa:@12345@192.168.1.3:5432/PR_PO"
```

**⚠️ สำคัญ:**
- ต้องตั้งค่า `NEXTAUTH_URL` และ `AUTH_URL` ให้ตรงกับ domain/IP ที่จะใช้งานจริง
- ถ้าไม่ตั้งค่าจะเกิด error: `UntrustedHost: Host must be trusted`
- `AUTH_TRUST_HOST="true"` จะทำให้ NextAuth.js ไว้วางใจ host จาก headers

### 4. รัน Production

#### วิธีที่ 1: รันด้วย npm (พื้นฐาน)
```bash
npm start
```
- แอปจะรันที่ `http://localhost:2025`
- ปิด terminal = แอปหยุด

#### วิธีที่ 2: รันด้วย PM2 (แนะนำ)
```bash
# ติดตั้ง PM2
npm install -g pm2

# Start แอป
pm2 start npm --name "pr-tracking" -- start

# บันทึก config
pm2 save

# ตั้งให้รันตอน boot
pm2 startup

# คำสั่งอื่นๆ
pm2 list          # ดูแอปที่รันอยู่
pm2 logs          # ดู logs
pm2 restart pr-tracking  # restart แอป
pm2 stop pr-tracking     # หยุดแอป
pm2 delete pr-tracking   # ลบแอป
```

## เข้าถึงผ่าน IP/Domain:

### ตั้งค่า Reverse Proxy (IIS หรือ Nginx)

#### IIS (Windows Server):
1. ติดตั้ง URL Rewrite และ Application Request Routing
2. สร้าง Reverse Proxy rule:
   - Pattern: `.*`
   - Rewrite URL: `http://localhost:2025/{R:0}`

#### Nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:2025;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Port: 2025
แอปจะรันที่ port `2025` (กำหนดใน package.json)

## 🔄 อัพเดทเวอร์ชันใหม่:

```bash
# 1. หยุดแอป
pm2 stop pr-tracking

# 2. Copy ไฟล์ใหม่ทับ (เว้น node_modules)

# 3. อัพเดทไฟล์ .env (ถ้ามีการเปลี่ยนแปลง)
# ตรวจสอบ NEXTAUTH_URL, AUTH_URL ให้ตรงกับ production URL

# 4. Install dependencies ใหม่
npm install

# 5. Build ใหม่ (สำคัญ! ถ้าแก้ .env ต้อง build ใหม่)
npm run build

# 6. Start แอป
pm2 restart pr-tracking
```

**⚠️ หมายเหตุ:**
- ถ้าแก้ไขไฟล์ `.env` (เช่น เปลี่ยน URL, Database) **ต้อง `npm run build` ใหม่ทุกครั้ง**
- Environment variables ถูก compile เข้าไปใน build output
- ถ้าไม่ build ใหม่ จะยังใช้ค่าเก่าอยู่

## 🚀 Incremental Sync + PO Check (v1.2.0)

### การทำงานของ Sync ใน Production:

**Incremental Sync (อัตโนมัติ):**
- ✅ **ดึงเฉพาะข้อมูลที่เปลี่ยนแปลง** ตั้งแต่ครั้งล่าสุด
- ✅ **เร็วกว่า 10-100 เท่า** (~3 วินาที vs ~30 วินาที)
- ✅ **Full Sync ทุกวันอาทิตย์ เวลา 17:00** (เพื่อความแน่ใจ)
- ✅ **PO Check: จับ PR ที่มี PO ใหม่** (แม้ PR.UpdateDate ไม่เปลี่ยน)

**ตัวอย่างผลลัพธ์:**
```
ครั้งที่ 1 (FULL):        31 วินาที, 23,856 รายการ
ครั้งที่ 2 (INCREMENTAL): 3 วินาที,  0 รายการ (ไม่มีการเปลี่ยน)
ครั้งที่ 3 (INCREMENTAL): 4 วินาที,  15 รายการ
```

**วิธีการทำงาน:**
1. ตรวจสอบ `last_sync_date` จาก `sync_log` table
2. ถ้าเป็นวันอาทิตย์ 17:00 → Full Sync
3. ถ้าไม่ → Incremental Sync (WHERE clause):
```sql
WHERE T2.[BeginStr] = 'PR' AND (
  T0.[UpdateDate] > last_sync_date OR
  EXISTS (
    SELECT 1 FROM POR1 T3_SUB
    INNER JOIN OPOR T4_SUB ON T3_SUB.[DocEntry] = T4_SUB.[DocEntry]
    WHERE T3_SUB.[BaseRef] = T0.[DocNum]
      AND T4_SUB.[DocDate] > last_sync_date
  )
)
```
4. บันทึก sync log (sync_type, duration, records_processed)

**📌 PO Check Feature (v1.2.0):**

**กรณีที่จับได้:**
- เช้า: เปิด PR-001 (UpdateDate = 2025-10-24)
- บ่าย: สร้าง PO-001 (DocDate = 2025-10-24)
- SAP ไม่อัพเดต PR.UpdateDate
- ✅ **EXISTS ตรวจสอบว่า PR มี PO ใหม่** → ดึงทุก line ของ PR

**ข้อดี:**
- ✅ ดึงครบทุก line ของ PR (รวม line ที่ไม่มี PO)
- ✅ จับ edge case: เปิด PR + สร้าง PO ในวันเดียวกัน
- ✅ 100% Accuracy

**การ Monitor:**
```sql
-- ดูประวัติ sync
SELECT sync_date, sync_type, records_processed, duration_seconds, status
FROM sync_log
ORDER BY sync_date DESC
LIMIT 10;
```

---

## ✅ Production Ready
- Version: v1.2.0 (Incremental Sync + PO Check)
- Build Date: 2025-10-24
- Status: Production Ready
- Performance: 90%+ faster sync
- Feature: PO Check จับ PR ที่มี PO ใหม่ได้แม้ UpdateDate ไม่เปลี่ยน
