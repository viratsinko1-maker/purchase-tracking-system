# Telegram Notification System - Implementation Plan

## วัตถุประสงค์
สร้างระบบแจ้งเตือนผ่าน Telegram เมื่อมีการบันทึกข้อมูลการติดตาม PR, การตอบกลับ PR, และสถานะการส่งของ PO

---

## ขั้นตอนการทำงาน

### Phase 1: Setup Telegram Bot (ต้องทำก่อน)
1. สร้าง Telegram Bot ผ่าน @BotFather
   - ได้ Bot Token (เก็บไว้ใน .env)
2. สร้าง Telegram Group
   - เพิ่ม Bot เข้า Group
   - ตั้ง Bot เป็น Admin (ถ้าจำเป็น)
   - หา Chat ID ของ Group (เก็บไว้ใน .env)

### Phase 2: Backend Implementation
1. สร้าง Telegram service (`src/server/services/telegram.ts`)
   - Function สำหรับส่ง message
   - Message formatter สำหรับแต่ละประเภท
2. เพิ่ม environment variables ใน `.env`
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```
3. แก้ไข API endpoints เพื่อเรียกใช้ Telegram service:
   - `src/server/api/routers/prpo.ts` → `createTracking` mutation
   - `src/server/api/routers/prpo.ts` → `createTrackingResponse` mutation
   - `src/server/api/routers/po.ts` → `createDeliveryTracking` mutation

### Phase 3: Testing
1. ทดสอบส่ง message แต่ละประเภท
2. ตรวจสอบ format และข้อมูลที่แสดง
3. ทดสอบ error handling

---

## Message Formats

### 1. การติดตาม PR
```
📝 การติดตาม PR
PR #251010106

📋 ข้อมูล PR:
🏗️ โครงการ: [job_name]
💬 หมายเหตุ: [pr_remarks]
👤 ผู้ขอ PR: [req_name]
🏢 แผนก: [department_name]

⚡ การติดตาม:
[icon] ความเร่งด่วน: [urgency_level]
💬 การติดตาม: [note]
👤 ผู้ติดตาม: [tracked_by]
🕐 เวลา: [tracked_at]
```

**Icon สำหรับความเร่งด่วน:**
- 🔴 ด่วนที่สุด
- 🟠 ด่วน
- 🔵 ปกติ

---

### 2. การตอบกลับการติดตาม PR
```
💬 การตอบกลับการติดตาม PR
PR #[pr_no]

📋 ข้อมูล PR:
🏗️ โครงการ: [job_name]
💬 หมายเหตุ: [pr_remarks]
👤 ผู้ขอ PR: [req_name]
🏢 แผนก: [department_name]

📝 การติดตามเดิม:
[icon] ความเร่งด่วน: [urgency_level]
💬 การติดตาม: [tracking_note]
👤 ผู้ติดตาม: [tracker_name]
🕐 เวลาติดตาม: [tracked_at]

✅ การตอบกลับ:
💬 ตอบกลับ: [response_note]
👤 ผู้ตอบกลับ: [responded_by]
🕐 เวลาตอบกลับ: [responded_at]
```

---

### 3. สถานะการส่งของ PO
```
📦 สถานะการส่งของ PO
PO #[po_no]

📋 ข้อมูล PO:
📅 วันที่สร้าง: [doc_date]
📅 วันครบกำหนด: [doc_due_date]
📊 สถานะ PO: [doc_status]
🔗 จาก PR: [pr_numbers]

🚦 การติดตามการส่งของ:
[icon] สถานะ: [delivery_status]
💬 หมายเหตุ: [note]
👤 ผู้บันทึก: [tracked_by]
🕐 เวลา: [tracked_at]
```

**Icon สำหรับสถานะการส่งของ:**
- 🟢 ปกติ
- 🔴 ไม่ปกติ
- ⚪ อื่นๆ

---

## Data Requirements

### PR Tracking (createTracking)
- PR Number
- Job Name (โครงการ)
- PR Remarks (หมายเหตุเดิม)
- Requester Name (ผู้ขอ PR)
- Department Name (แผนก)
- Urgency Level (ความเร่งด่วน)
- Tracking Note (การติดตาม)
- Tracked By (ผู้ติดตาม)
- Tracked At (เวลา)

### PR Tracking Response (createTrackingResponse)
- ข้อมูลเดียวกับ PR Tracking
- Response Note (ตอบกลับ)
- Responded By (ผู้ตอบกลับ)
- Responded At (เวลาตอบกลับ)

### PO Delivery Tracking (createDeliveryTracking)
- PO Number
- Doc Date (วันที่สร้าง)
- Doc Due Date (วันครบกำหนด)
- Doc Status (สถานะ PO: Open/Closed)
- PR Numbers (จาก PR)
- Delivery Status (สถานะการส่งของ)
- Note (หมายเหตุ)
- Tracked By (ผู้บันทึก)
- Tracked At (เวลา)

---

## Technical Notes

### Telegram API
- Endpoint: `https://api.telegram.org/bot<TOKEN>/sendMessage`
- Method: POST
- Body:
  ```json
  {
    "chat_id": "CHAT_ID",
    "text": "MESSAGE",
    "parse_mode": "HTML" // or "Markdown"
  }
  ```

### Error Handling
- ใช้ try-catch ห่อการส่ง Telegram
- ไม่ให้ error จาก Telegram ทำให้ mutation ล้มเหลว
- Log error เพื่อติดตาม

### Environment Variables
```env
# .env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

---

## Implementation Checklist

### Phase 1: Setup
- [ ] สร้าง Telegram Bot
- [ ] สร้าง Telegram Group
- [ ] เพิ่ม Bot เข้า Group
- [ ] หา Chat ID
- [ ] เพิ่ม environment variables

### Phase 2: Code
- [ ] สร้าง `src/server/services/telegram.ts`
- [ ] สร้าง message formatter functions
- [ ] แก้ไข `prpo.ts` - `createTracking`
- [ ] แก้ไข `prpo.ts` - `createTrackingResponse`
- [ ] แก้ไข `po.ts` - `createDeliveryTracking`

### Phase 3: Testing
- [ ] ทดสอบการติดตาม PR
- [ ] ทดสอบการตอบกลับ PR
- [ ] ทดสอบสถานะการส่งของ PO
- [ ] ทดสอบ error handling

---

## Status: PLANNED (ยังไม่เริ่มทำ)

### Next Step:
**ผู้ใช้ต้องทำก่อน:**
1. สร้าง Telegram Bot ผ่าน @BotFather → ได้ Bot Token
2. สร้าง Telegram Group และเพิ่ม Bot เข้าไป
3. หา Chat ID ของ Group
4. ส่ง Bot Token และ Chat ID มาให้

**หลังจากนั้น Developer จะ:**
1. เพิ่ม environment variables
2. สร้าง Telegram service
3. Integrate กับ API endpoints
4. ทดสอบระบบ
