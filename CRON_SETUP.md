# การตั้ง Schedule สำหรับ Full Sync ตอนตี 1 ทุกวัน

มี 2 วิธีในการรัน Full Sync อัตโนมัติ:

1. **Script แบบ Direct** (แนะนำ) - รันผ่าน Node.js script โดยตรง ไม่ต้องเปิด web server
2. **API Endpoint** - เรียกผ่าน HTTP API (ต้องเปิด web server)

---

## 🎯 วิธีที่ 1: ใช้ Node.js Script (แนะนำ)

### ข้อดี:
- ไม่ต้องเปิด web server
- ไม่ต้องกังวลเรื่อง authentication
- รันเร็วกว่า ไม่ต้องผ่าน HTTP overhead
- จัดการ error ได้ง่ายกว่า

### 1.1 ใช้ Windows Task Scheduler (สำหรับ Windows Server)

1. เปิด Task Scheduler
2. สร้าง Task ใหม่:
   - **Name**: PR-PO Daily Full Sync
   - **Trigger**: Daily at 01:00:00
   - **Action**: Start a program
   - **Program/script**: `node`
   - **Add arguments**: `scripts/daily-sync.js`
   - **Start in**: `D:\VS\network\VS\PR_PO\my-t3-app`

**หรือสร้างด้วย PowerShell:**
```powershell
$action = New-ScheduledTaskAction -Execute "node" -Argument "scripts/daily-sync.js" -WorkingDirectory "D:\VS\network\VS\PR_PO\my-t3-app"
$trigger = New-ScheduledTaskTrigger -Daily -At 1:00AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -TaskName "PR-PO Daily Full Sync" -Description "Daily full sync of PR-PO data from SAP to PostgreSQL"
```

### 1.2 ใช้ Cron (สำหรับ Linux/Mac)

เพิ่มใน crontab:
```bash
# แก้ไข crontab
crontab -e

# เพิ่มบรรทัดนี้ (ทำงานทุกวันตอนตี 1)
0 1 * * * cd /path/to/my-t3-app && node scripts/daily-sync.js >> /var/log/pr-po-sync.log 2>&1
```

### 1.3 ทดสอบ Script

รันด้วยมือเพื่อทดสอบ:
```bash
# วิธีที่ 1: ใช้ npm script (แนะนำ)
npm run sync:full

# วิธีที่ 2: รันด้วย Node.js โดยตรง
# Windows
cd D:\VS\network\VS\PR_PO\my-t3-app
node scripts/daily-sync.js

# Linux/Mac
cd /path/to/my-t3-app
node scripts/daily-sync.js
```

ควรเห็น output:
```
[SYNC] Starting daily full sync at 2025-10-27T01:00:00.000Z
[SYNC] Connected to SAP database
[SYNC] Fetching data from SAP...
[SYNC] Fetched 23866 records from SAP
[SYNC] Processing data...
[SYNC] Processing 1234 PR masters, 5678 lines, 2345 PO links
[SYNC] Upserting data to PostgreSQL...
[SYNC] Refreshing materialized view...
[SYNC] ✅ Full sync completed successfully
[SYNC] Duration: 53 seconds
[SYNC] Updated: 1234 PRs, 5678 lines, 2345 PO links
```

---

## 🌐 วิธีที่ 2: ใช้ API Endpoint (ต้องเปิด web server)

### ข้อดี:
- เรียกได้จากที่ไหนก็ได้ผ่าน HTTP
- ใช้กับ online cron services ได้

### ข้อเสีย:
- ต้องเปิด web server ตลอดเวลา
- ต้องตั้ง authentication token
- ช้ากว่าแบบ direct script

API endpoint: `/api/cron/daily-sync`

### 2.1 ใช้ Windows Task Scheduler (สำหรับ Windows Server)

1. เปิด Task Scheduler
2. สร้าง Task ใหม่:
   - **Name**: PR-PO Daily Full Sync (API)
   - **Trigger**: Daily at 01:00:00
   - **Action**: Start a program
   - **Program/script**: `curl`
   - **Add arguments**:
     ```
     -X POST http://localhost:2025/api/cron/daily-sync -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_SECRET_TOKEN"
     ```

### 2.2 ใช้ Cron (สำหรับ Linux/Mac)

เพิ่มใน crontab:
```bash
# แก้ไข crontab
crontab -e

# เพิ่มบรรทัดนี้ (ทำงานทุกวันตอนตี 1)
0 1 * * * curl -X POST http://localhost:2025/api/cron/daily-sync -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

### 2.3 ใช้บริการ Cron Online

- **cron-job.org** (ฟรี): https://cron-job.org
- **EasyCron**: https://www.easycron.com
- **Vercel Cron Jobs**: https://vercel.com/docs/cron-jobs

ตั้งค่า:
- URL: `https://your-domain.com/api/cron/daily-sync`
- Method: POST
- Headers:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_SECRET_TOKEN
  ```
- Schedule: `0 1 * * *` (ทุกวันตอนตี 1)

### 2.4 ตั้งค่า Environment Variable (สำหรับ API Endpoint)

เพิ่มในไฟล์ `.env`:
```
CRON_SECRET_TOKEN=your-very-secret-token-here
```

**สำคัญ**: เปลี่ยน `YOUR_SECRET_TOKEN` เป็น token ที่ปลอดภัย

สร้าง token ได้ด้วย:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 2.5 ทดสอบ API Endpoint

ทดสอบด้วยคำสั่ง curl:
```bash
curl -X POST http://localhost:2025/api/cron/daily-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

ควรได้ response:
```json
{
  "success": true,
  "sync_type": "FULL",
  "records_fetched": 23866,
  "duration_seconds": 53,
  "pr_master_updated": 1234,
  "pr_lines_updated": 5678,
  "po_links_updated": 2345,
  "message": "[FULL] Synced 1234 PRs, 5678 lines, 2345 PO links in 53s"
}
```

---

## 📊 การตรวจสอบ Log

### 1. ดู Log ผ่าน Web Interface

ดู log ของ Full Sync ที่หน้า Sync History:
- URL: http://localhost:2025/sync-history
- ดู sync_log ที่ sync_type = 'FULL'
- ดูรายละเอียดการเปลี่ยนแปลง (แบบ expand/collapse)

### 2. ดู Log ผ่าน Database

```sql
-- ดู sync log ล่าสุด 10 รายการ
SELECT
  sync_date,
  sync_type,
  status,
  records_processed,
  duration_seconds,
  error_message
FROM sync_log
ORDER BY sync_date DESC
LIMIT 10;

-- ดู error logs เฉพาะ
SELECT * FROM sync_log
WHERE status = 'error'
ORDER BY sync_date DESC;
```

### 3. ดู Log ไฟล์ (ถ้าใช้ script method)

ถ้าใช้ cron แบบ redirect output:
```bash
# ดู log file
tail -f /var/log/pr-po-sync.log

# หรือบน Windows (ถ้าใช้ Task Scheduler)
# ดูที่ Task Scheduler > History
```

---

## 📝 หมายเหตุ

### การทำงานของ Full Sync

1. **Full Sync จะทำงานโดยอัตโนมัติเมื่อ:**
   - Scheduled task รันตอนตี 1 (จาก Task Scheduler หรือ cron)
   - หรือเมื่อผู้ใช้กดซิงค์ด้วยตนเองในช่วงตี 1-2 น.

2. **Incremental Sync จะทำงานเมื่อ:**
   - ผู้ใช้กดปุ่มซิงค์นอกช่วงเวลาตี 1-2 น.
   - จะดึงเฉพาะข้อมูลที่เปลี่ยนแปลงตั้งแต่ sync ครั้งล่าสุด (ตาม date เท่านั้น ไม่สนใจเวลา)

### การป้องกัน Duplicate Logs

ระบบมีการป้องกัน log ซ้ำดังนี้:

1. **PR_NEW**: ตรวจสอบว่าเคยบันทึก PR ใหม่นี้ไปแล้วหรือยัง
2. **PR_UPDATED**: ตรวจสอบว่าเคยบันทึกใน sync session นี้ไปแล้วหรือยัง
3. **PR_STATUS_CHANGED**: ตรวจสอบว่าเคยบันทึกการเปลี่ยนสถานะนี้ไปแล้วหรือยัง
4. **PO_LINKED**: ตรวจสอบว่าเคย link PO นี้กับ PR นี้ไปแล้วหรือยัง

### การจัดประเภท PR

- **PR ใหม่ (สีเขียว)**: วันที่เปิด PR = วันที่อัพเดต หรือ ไม่เคยมีใน database
- **PR อัพเดต (สีน้ำเงิน)**: วันที่เปิด PR ≠ วันที่อัพเดต
- **เปลี่ยนสถานะ (สีเหลือง)**: สถานะ PR เปลี่ยนจาก O → C หรือ C → O
- **PO เชื่อมโยง (สีม่วง)**: มี PO ใหม่เชื่อมโยงกับ PR

---

## 🔧 แก้ปัญหา (Troubleshooting)

### Script ไม่ทำงาน

1. **ตรวจสอบ Node.js path:**
   ```bash
   which node  # Linux/Mac
   where node  # Windows
   ```

2. **ตรวจสอบว่า script รันได้:**
   ```bash
   cd D:\VS\network\VS\PR_PO\my-t3-app
   node scripts/daily-sync.js
   ```

3. **ตรวจสอบ database connection:**
   - เช็คว่า PostgreSQL ทำงานอยู่
   - เช็คว่า SAP B1 database เข้าถึงได้
   - ดู error ใน console output

### Task Scheduler ไม่รัน

1. **เช็ค Task History:**
   - เปิด Task Scheduler
   - คลิกขวาที่ task → View History
   - ดู error messages

2. **ตรวจสอบ permissions:**
   - Task ต้องรันด้วย account ที่มีสิทธิ์เข้าถึง database
   - ใช้ "Run with highest privileges"

3. **ตรวจสอบ working directory:**
   - ต้องตั้ง "Start in" เป็น path โปรเจค
   - Example: `D:\VS\network\VS\PR_PO\my-t3-app`

---

## 📦 สรุปไฟล์ที่เกี่ยวข้อง

- **scripts/daily-sync.js** - Script สำหรับรัน Full Sync โดยตรง (แนะนำ)
- **src/pages/api/cron/daily-sync.ts** - API endpoint สำหรับเรียกผ่าน HTTP
- **CRON_SETUP.md** - เอกสารนี้
- **.env** - ตั้งค่า CRON_SECRET_TOKEN (สำหรับ API method เท่านั้น)
