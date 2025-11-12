# Scripts

โฟลเดอร์นี้เก็บ scripts สำหรับรันงานต่างๆ ของระบบ PR-PO

## daily-sync.js

Script สำหรับรัน Full Sync จาก SAP B1 ไปยัง PostgreSQL โดยตรง

### การใช้งาน

```bash
# รันด้วย Node.js โดยตรง
node scripts/daily-sync.js

# หรือใช้ npm script
npm run sync:full
```

### คุณสมบัติ

- รัน Full Sync ทั้งหมดจาก SAP B1
- ไม่ต้องเปิด web server
- ไม่ต้องใช้ authentication
- บันทึก log ลงใน `sync_log` table
- แสดง progress ใน console

### ตัวอย่าง Output

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

### การตั้ง Schedule

ดูรายละเอียดในไฟล์ [CRON_SETUP.md](../CRON_SETUP.md)

สรุป:
- **Windows**: ใช้ Task Scheduler รัน `node scripts/daily-sync.js` ตอนตี 1
- **Linux/Mac**: ใช้ cron `0 1 * * * cd /path/to/app && node scripts/daily-sync.js`

### Error Handling

ถ้า script เกิด error:
- บันทึก error ลงใน `sync_log` table (status = 'error')
- แสดง error message ใน console
- Exit code = 1 (สำหรับให้ Task Scheduler/cron รู้ว่า fail)

### ข้อกำหนด

- Node.js ต้องติดตั้งแล้ว
- ต้องมีการตั้งค่า `.env` ถูกต้อง (DATABASE_URL)
- ต้องเข้าถึง SAP B1 database ได้ (10.1.1.199)
- ต้องเข้าถึง PostgreSQL database ได้
