# การปรับปรุงระบบ Sync Log

เอกสารนี้สรุปการปรับปรุงระบบ Sync Log ทั้งหมด

## 📋 สรุปการแก้ไข

### 1. ✅ แก้ปัญหา Log ซ้ำ

**ปัญหา:**
- Log แสดงซ้ำเมื่อกด sync หลายครั้ง
- เนื่องจาก SAP เก็บเวลาเป็นเที่ยงคืนเสมอ ทำให้ incremental sync ดึงข้อมูลเดิมมาซ้ำ

**วิธีแก้:**
- เพิ่มการตรวจสอบ `sync_change_log` ก่อนบันทึกทุกครั้ง
- ตรวจสอบแต่ละ change type:
  - **PR_NEW**: เช็คว่าเคยบันทึก PR นี้ไปแล้วหรือยัง
  - **PR_UPDATED**: เช็คว่าเคยบันทึกใน sync_log_id นี้ไปแล้วหรือยัง
  - **PR_STATUS_CHANGED**: เช็คว่าเคยบันทึกการเปลี่ยนสถานะนี้ไปแล้วหรือยัง
  - **PO_LINKED**: เช็คว่าเคย link PO นี้กับ PR นี้ไปแล้วหรือยัง

**ไฟล์ที่แก้:** `src/server/api/routers/pr.ts` (บรรทัด 533-652)

### 2. ✅ แก้ไขการจัดประเภท PR ใหม่ vs PR อัพเดต

**ปัญหา:**
- PR ที่เพิ่งเปิดใหม่ (วันที่เปิด = วันที่อัพเดต) แสดงเป็น "PR อัพเดท" แทนที่จะเป็น "PR ใหม่"

**วิธีแก้:**
- เพิ่มการตรวจสอบ `doc_date === update_date`
- ถ้าตรงกัน → แสดงเป็น **PR ใหม่** (สีเขียว)
- ถ้าไม่ตรง → แสดงเป็น **PR อัพเดต** (สีน้ำเงิน)

```typescript
const docDate = prMaster.doc_date ? new Date(prMaster.doc_date).toISOString().split('T')[0] : null;
const updateDate = prMaster.update_date ? new Date(prMaster.update_date).toISOString().split('T')[0] : null;
const isJustCreated = docDate && updateDate && docDate === updateDate;
```

**ไฟล์ที่แก้:** `src/server/api/routers/pr.ts` (บรรทัด 561-564)

### 3. ✅ เพิ่ม UI Expand/Collapse

**คุณสมบัติใหม่:**
- แสดงเฉพาะ header โดยปริยาย (collapsed)
- คลิกที่ header เพื่อดูรายละเอียด (expand)
- แสดงไอคอน ▶ (collapsed) และ ▼ (expanded)
- แสดงข้อความ "คลิกเพื่อดูรายละเอียด X รายการ" เมื่อ collapsed

**การใช้งาน:**
```tsx
const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());

const toggleSession = (sessionId: number) => {
  setExpandedSessions(prev => {
    const newSet = new Set(prev);
    if (newSet.has(sessionId)) {
      newSet.delete(sessionId);
    } else {
      newSet.add(sessionId);
    }
    return newSet;
  });
};
```

**ไฟล์ที่แก้:** `src/pages/sync-history.tsx`

### 4. ✅ เพิ่มการแสดงสรุปจำนวนใน Header

**คุณสมบัติใหม่:**
- แสดง badge สรุปแยกตามประเภท:
  - ✨ **PR ใหม่**: สีเขียว (bg-green-100)
  - 🔄 **PR อัพเดต**: สีน้ำเงิน (bg-blue-100)
  - ⚠️ **เปลี่ยนสถานะ**: สีเหลือง (bg-yellow-100)
  - 🔗 **PO เชื่อมโยง**: สีม่วง (bg-purple-100)
- แต่ละ badge แสดงจำนวนพร้อม

```tsx
const getSessionSummary = (changes: any[]): SessionSummary => {
  return {
    newPRs: changes.filter(c => c.change_type === 'PR_NEW').length,
    updatedPRs: changes.filter(c => c.change_type === 'PR_UPDATED').length,
    statusChangedPRs: changes.filter(c => c.change_type === 'PR_STATUS_CHANGED').length,
    linkedPOs: changes.filter(c => c.change_type === 'PO_LINKED').length,
  };
};
```

**ไฟล์ที่แก้:** `src/pages/sync-history.tsx`

### 5. ✅ ตั้ง Schedule สำหรับ Full Sync ตอนตี 1

**วิธีที่ 1: Script แบบ Direct (แนะนำ)**

สร้าง Node.js script สำหรับรัน Full Sync โดยตรง:

**ไฟล์ใหม่:**
- `scripts/daily-sync.js` - Script สำหรับรัน Full Sync
- `scripts/README.md` - เอกสาร scripts

**คุณสมบัติ:**
- รันโดยตรงผ่าน Node.js ไม่ต้องเปิด web server
- ไม่ต้องใช้ authentication
- รันเร็วกว่า API endpoint
- บันทึก log ลงใน `sync_log` table

**การใช้งาน:**
```bash
npm run sync:full
```

**ตั้ง Schedule:**
- **Windows Task Scheduler**: รัน `node scripts/daily-sync.js` ตอนตี 1
- **Linux/Mac cron**: `0 1 * * * cd /path/to/app && node scripts/daily-sync.js`

**วิธีที่ 2: API Endpoint**

สำหรับกรณีที่ต้องเรียกผ่าน HTTP:

**ไฟล์ใหม่:**
- `src/pages/api/cron/daily-sync.ts` - API endpoint
- `.env.example` - เพิ่ม CRON_SECRET_TOKEN

**การใช้งาน:**
```bash
curl -X POST http://localhost:2025/api/cron/daily-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

**เอกสาร:**
- `CRON_SETUP.md` - คู่มือการตั้ง schedule แบบละเอียด

### 6. ✅ อัพเดต pr.sync() ให้รองรับ Daily Full Sync

**การทำงาน:**
- ตรวจสอบเวลา: ถ้าอยู่ในช่วงตี 1 (01:00-01:59) → Full Sync
- นอกเหนือจากนั้น → Incremental Sync

```typescript
const hour = now.getHours();
const isDailyFullSync = hour === 1;
const isFullSync = !lastSyncDate || isDailyFullSync;
```

**ไฟล์ที่แก้:** `src/server/api/routers/pr.ts` (บรรทัด 307-314)

---

## 📁 สรุปไฟล์ที่แก้ไข/เพิ่ม

### แก้ไข:
1. `src/server/api/routers/pr.ts` - แก้ sync logic และ change log detection
2. `src/pages/sync-history.tsx` - เพิ่ม UI expand/collapse และสรุปจำนวน
3. `package.json` - เพิ่ม script `sync:full`
4. `.env.example` - เพิ่ม CRON_SECRET_TOKEN

### สร้างใหม่:
1. `scripts/daily-sync.js` - Script สำหรับรัน Full Sync โดยตรง
2. `scripts/README.md` - เอกสาร scripts
3. `src/pages/api/cron/daily-sync.ts` - API endpoint สำหรับ cron
4. `CRON_SETUP.md` - คู่มือการตั้ง schedule
5. `SYNC_IMPROVEMENTS.md` - เอกสารนี้

---

## 🧪 การทดสอบ

### 1. ทดสอบ Script

```bash
npm run sync:full
```

ควรเห็น output:
```
[SYNC] Starting daily full sync at 2025-10-27T01:00:00.000Z
[SYNC] Connected to SAP database
[SYNC] Fetching data from SAP...
[SYNC] Fetched 23866 records from SAP
...
[SYNC] ✅ Full sync completed successfully
```

### 2. ทดสอบ UI

1. เปิด http://localhost:2025/sync-history
2. คลิก header เพื่อ expand/collapse
3. ตรวจสอบว่า badge สรุปแสดงถูกต้อง
4. ตรวจสอบว่า PR ใหม่แสดงเป็นสีเขียว

### 3. ทดสอบ Log ไม่ซ้ำ

1. กดปุ่ม sync หลายครั้ง
2. ดูที่หน้า sync-history
3. ตรวจสอบว่าไม่มี log ซ้ำ

### 4. ทดสอบการจัดประเภท PR

1. ดู PR ที่เพิ่งเปิดใหม่ → ต้องแสดงเป็น "PR ใหม่" (สีเขียว)
2. ดู PR ที่มีการอัพเดต → ต้องแสดงเป็น "PR อัพเดต" (สีน้ำเงิน)

---

## 🔍 การตรวจสอบ Log

### Web Interface
http://localhost:2025/sync-history

### Database Query
```sql
SELECT
  sync_date,
  sync_type,
  status,
  records_processed,
  duration_seconds
FROM sync_log
ORDER BY sync_date DESC
LIMIT 10;
```

### Log File (ถ้าใช้ cron)
```bash
tail -f /var/log/pr-po-sync.log
```

---

## 📝 หมายเหตุสำคัญ

### การป้องกัน Duplicate Logs

ระบบตรวจสอบก่อนบันทึกทุกครั้ง:
- PR_NEW: เช็คว่ามี PR นี้ใน change_log แล้วหรือยัง
- PR_UPDATED: เช็คว่ามีใน sync_log_id นี้แล้วหรือยัง
- PR_STATUS_CHANGED: เช็คว่ามีการเปลี่ยนสถานะนี้แล้วหรือยัง
- PO_LINKED: เช็คว่าเคย link แล้วหรือยัง

### การจัดประเภท Change Type

- **PR ใหม่**: วันที่เปิด = วันที่อัพเดต หรือ ไม่เคยมีใน database
- **PR อัพเดต**: วันที่เปิด ≠ วันที่อัพเดต และมีใน database แล้ว
- **เปลี่ยนสถานะ**: สถานะเปลี่ยน (O → C หรือ C → O)
- **PO เชื่อมโยง**: มี PO ใหม่เชื่อมโยงกับ PR

### การทำงานของ Sync

- **Full Sync**: ทุกวันตี 1 หรือเมื่อกดปุ่มในช่วงตี 1-2 น.
- **Incremental Sync**: เมื่อกดปุ่มนอกช่วงเวลาตี 1-2 น.

---

## 🎯 แนะนำการใช้งาน

### สำหรับ Production

1. **ตั้ง Schedule**: ใช้ Windows Task Scheduler หรือ cron
   ```bash
   # Windows
   Program: node
   Arguments: scripts/daily-sync.js
   Start in: D:\VS\network\VS\PR_PO\my-t3-app
   Trigger: Daily at 01:00
   ```

2. **ตรวจสอบ Log**: เข้า http://localhost:2025/sync-history ทุกเช้า

3. **Monitoring**: ตั้ง alert ถ้า sync fail
   ```sql
   SELECT * FROM sync_log
   WHERE status = 'error'
   AND sync_date >= NOW() - INTERVAL '1 day';
   ```

### สำหรับ Development

1. **ทดสอบ Script**: `npm run sync:full`
2. **ดู Log Real-time**: เปิด console ระหว่าง sync
3. **ตรวจสอบ Database**: ใช้ Prisma Studio หรือ SQL client

---

## 📚 เอกสารเพิ่มเติม

- [CRON_SETUP.md](./CRON_SETUP.md) - คู่มือการตั้ง schedule
- [scripts/README.md](./scripts/README.md) - เอกสาร scripts
- [TROUBLESHOOTING.md](./CRON_SETUP.md#-troubleshooting) - แก้ปัญหา
