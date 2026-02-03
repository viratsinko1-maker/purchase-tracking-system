# Features Documentation

เอกสารอธิบาย Features หลักของระบบ PR-PO Tracking

---

## Table of Contents

1. [W-Series (Work Order Management)](#1-w-series-work-order-management)
2. [Force Logout & Session Management](#2-force-logout--session-management)
3. [KPI Tracking System](#3-kpi-tracking-system)
4. [Usage Analytics](#4-usage-analytics)

---

## 1. W-Series (Work Order Management)

### Overview

ระบบ W-Series เป็นระบบติดตาม Work Order จาก SAP ผ่าน 4 สถานะหลัก:

```
WO (Work Order) → WR (Work Response) → WA (Work Action) → WC (Work Complete)
```

### หน้าที่มี

| Path | ชื่อ | คำอธิบาย |
|------|------|----------|
| `/w-series/wo` | Work Order | รายการใบสั่งงาน |
| `/w-series/wr` | Work Response | การตอบรับงาน |
| `/w-series/wa` | Work Action | การดำเนินงาน |
| `/w-series/wc` | Work Complete | การปิดงาน |

### Flow การทำงาน

```
1. WO (Work Order)
   - สร้างใบสั่งงานจาก SAP
   - ระบุ: ผู้ร้องขอ, แผนก, เครื่องจักร, รายละเอียดงาน
   - กำหนดวันเริ่มต้น, วันกำหนดเสร็จ

2. WR (Work Response)
   - ผู้รับผิดชอบตอบรับงาน
   - สถานะ: "รอดำเนินการ" → "รับงานแล้ว"

3. WA (Work Action)
   - บันทึกการทำงานจริง
   - Track เวลา: เริ่มงาน, จบงาน
   - Track เครื่องจักร: หยุดเครื่อง (mc_stop), เปิดเครื่อง (mc_start)
   - สถานะ: "รอดำเนินการ" → "กำลังทำ" → "เสร็จแล้ว"

4. WC (Work Complete)
   - ปิดงานพร้อมเหตุผล
   - บันทึก: สาเหตุปิดงาน, หมายเหตุ
   - คำนวณ: ชั่วโมงเครื่องหยุด (due_mc_stop)
```

### Database Model

```prisma
model wo_summary {
  id               Int       @id @default(autoincrement())

  // Work Order
  wo_doc_num       Int?
  wo_series_name   String?
  wo_order_1       String?      // รายละเอียดงาน
  wo_respond_by    String?      // ผู้รับผิดชอบ
  wo_u_date        DateTime?    // วันเริ่ม
  wo_u_finish      DateTime?    // วันกำหนดเสร็จ
  wo_close_date    DateTime?

  // Work Response
  wr_doc_num       Int?
  wr_series_name   String?
  wr_close_date    DateTime?

  // Work Action
  wa_doc_num       Int?
  wa_series_name   String?
  wa_plan_to_work  String?      // แผนการทำงาน
  wa_start_work    DateTime?    // เริ่มทำงานจริง
  wa_finish_date   DateTime?
  wa_mc_stop       DateTime?    // เครื่องหยุด
  wa_mc_start      DateTime?    // เครื่องเริ่ม

  // Work Complete
  wc_doc_num       Int?
  wc_series_name   String?
  wc_reason_1      String?      // สาเหตุปิดงาน
  wc_work_commit_1 String?      // หมายเหตุ
  due_mc_stop      Decimal?     // ชั่วโมงเครื่องหยุด

  // Common
  pr_mac           String?      // รหัสเครื่อง
  item_name        String?
  req_name         String?      // ผู้ร้องขอ
  department       String?
  dept_name        String?
}
```

### Permission ที่ใช้

| Permission Code | คำอธิบาย |
|-----------------|----------|
| `w_series_wo.read` | ดูหน้า Work Order |
| `w_series_wr.read` | ดูหน้า Work Response |
| `w_series_wa.read` | ดูหน้า Work Action |
| `w_series_wc.read` | ดูหน้า Work Complete |

### Files ที่เกี่ยวข้อง

| File | คำอธิบาย |
|------|----------|
| `src/pages/w-series/*.tsx` | หน้า UI ทั้ง 4 หน้า |
| `src/server/api/routers/w-series.ts` | API Router |
| `src/components/WSeriesSidebar.tsx` | Sidebar เฉพาะ W-Series |
| `prisma/schema.prisma` | Model `wo_summary` |

---

## 2. Force Logout & Session Management

### Overview

ระบบจัดการ Session และ Auto-logout เพื่อความปลอดภัย:

- **Single Session**: แต่ละ user login ได้ทีละ 1 session
- **Heartbeat**: ส่ง heartbeat ทุก 60 วินาที
- **Auto Logout**: Logout อัตโนมัติเมื่อไม่ใช้งาน 15 นาที
- **Server Cleanup**: ลบ session ที่ไม่มี heartbeat 3 นาที

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGIN                                │
│                            ↓                                     │
│              login.ts สร้าง active_session                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AuthGuard Renders:                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ HeartbeatSender │  │ AutoLogoutTimer │  │   Page Content  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↓                        ↓
    ทุก 60 วินาที          Monitor กิจกรรม
         ↓                        ↓
┌─────────────────┐      ┌─────────────────────────────────────┐
│  POST /api/     │      │  0-7 นาที: ตรวจ mouse/keyboard      │
│  auth/heartbeat │      │  7 นาที: แสดง Warning Modal         │
│       ↓         │      │  7-15 นาที: Countdown               │
│  Update         │      │  15 นาที: Auto Logout               │
│  last_heartbeat │      └─────────────────────────────────────┘
└─────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              Session Cleanup Scheduler (ทุก 2 นาที)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ หา session ที่ last_heartbeat > 3 นาที                    │   │
│  │ → สร้าง Audit Log (LOGOUT)                                │   │
│  │ → ลบ session                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Database Model

```prisma
model active_session {
  id             Int       @id @default(autoincrement())
  user_id        String    @unique              // 1 user = 1 session
  user_name      String?
  ip_address     String?
  computer_name  String?
  last_heartbeat DateTime  @default(now())      // ใช้ตรวจ session หมดอายุ
  session_start  DateTime  @default(now())
  created_at     DateTime  @default(now())

  @@index([last_heartbeat])
  @@index([user_id])
}
```

### Configuration

| Parameter | ค่า | คำอธิบาย |
|-----------|-----|----------|
| HEARTBEAT_INTERVAL | 60 sec | ส่ง heartbeat ทุก 60 วินาที |
| CHECK_INTERVAL | 120 sec | Scheduler ตรวจ session ทุก 2 นาที |
| SESSION_TIMEOUT | 180 sec | Session หมดอายุถ้าไม่มี heartbeat 3 นาที |
| IDLE_TIMEOUT | 15 min | Logout ถ้าไม่ใช้งาน 15 นาที |
| WARNING_AT | 7 min | แสดง warning หลังไม่ใช้งาน 7 นาที |

### Components

#### HeartbeatSender (`src/components/HeartbeatSender.tsx`)
- ส่ง heartbeat ทุก 60 วินาที
- Update `last_heartbeat` ใน database
- บันทึก IP address และ computer name

#### AutoLogoutTimer (`src/components/AutoLogoutTimer.tsx`)
- ตรวจจับกิจกรรม: mousedown, mousemove, keypress, scroll, touchstart, click
- แสดง Warning Modal พร้อม countdown
- Auto logout เมื่อหมดเวลา

### Warning Modal UI

```
┌─────────────────────────────────────────┐
│    ⚠️ ระบบจะออกจากระบบอัตโนมัติ         │
│                                         │
│    เนื่องจากไม่มีการใช้งานเป็นเวลานาน   │
│                                         │
│              [ 7:45 ]                   │
│                                         │
│      [ ตกลง - ใช้งานต่อ ]               │
└─────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | คำอธิบาย |
|----------|--------|----------|
| `/api/auth/heartbeat` | POST | Update heartbeat |
| `/api/auth/logout` | POST | Logout และลบ session |
| `/api/auth/login` | POST | สร้าง session ใหม่ |

### Audit Trail

ระบบบันทึก audit log สำหรับ:
- LOGIN: เมื่อ login สำเร็จ
- LOGOUT: เมื่อ logout (manual หรือ auto)
- Logout reason: `manual` หรือ `auto_logout_idle`

### Session History (Usage Analytics)

เมื่อ user logout (manual หรือ timeout) ระบบจะบันทึกลง `session_history` เพื่อใช้ในการคำนวณ Usage Analytics:
- `session_start` - เวลาเริ่ม session
- `session_end` - เวลาสิ้นสุด session
- `duration_seconds` / `duration_minutes` - ระยะเวลาใช้งาน
- `logout_type` - "manual" หรือ "timeout"

ดูรายละเอียดเพิ่มเติมที่ [Usage Analytics](#4-usage-analytics)

### Files ที่เกี่ยวข้อง

| File | คำอธิบาย |
|------|----------|
| `src/components/HeartbeatSender.tsx` | Heartbeat component |
| `src/components/AutoLogoutTimer.tsx` | Auto logout + warning |
| `src/components/AuthGuard.tsx` | รวม Heartbeat + AutoLogout |
| `src/pages/api/auth/heartbeat.ts` | Heartbeat API |
| `src/pages/api/auth/logout.ts` | Logout API |
| `src/pages/api/auth/login.ts` | Login API |
| `src/server/session-cleanup-scheduler.ts` | Server-side cleanup |
| `src/server/db.ts` | เริ่ม scheduler |
| `src/hooks/useAuth.ts` | Auth hook |

---

## 3. KPI Tracking System

### Overview

ระบบติดตาม KPI สำหรับ:
1. **Approval KPI**: วัดเวลาที่ใช้ในการ approve PR แต่ละ stage
2. **Receive Confirm KPI**: วัดเวลาที่ใช้ในการยืนยันรับของ

### Approval Flow (5 Stages)

```
  Requester → Line → Cost Center → Procurement → VP-C
     ↓          ↓          ↓            ↓           ↓
   บันทึก    บันทึก     บันทึก       บันทึก      บันทึก
    KPI       KPI        KPI          KPI         KPI
```

### Receive Confirm Flow

```
  รับของ (Receive) → ยืนยัน (Confirm)
         ↓                  ↓
     received_at       confirmed_at
                           ↓
                       บันทึก KPI
```

### Database Models

#### approval_kpi_metric
```prisma
model approval_kpi_metric {
  id                 Int       @id @default(autoincrement())
  pr_doc_num         Int                          // PR number
  approval_stage     String                       // "requester"|"line"|"cost_center"|"procurement"|"vpc"
  user_id            String                       // ผู้ approve
  user_name          String
  previous_stage_at  DateTime?                    // เวลา stage ก่อนหน้า
  approved_at        DateTime                     // เวลาที่ approve
  duration_seconds   Int                          // เวลาที่ใช้ (วินาที)
  duration_minutes   Decimal                      // เวลาที่ใช้ (นาที)
  sla_target_minutes Int?                         // SLA target
  is_on_time         Boolean?                     // ตรงเวลาหรือไม่
  ocr_code2          String?                      // รหัสแผนก
  created_at         DateTime  @default(now())

  @@index([user_id])
  @@index([approval_stage])
  @@index([pr_doc_num])
  @@index([created_at])
  @@index([is_on_time])
}
```

#### receive_confirm_kpi_metric
```prisma
model receive_confirm_kpi_metric {
  id                 Int       @id @default(autoincrement())
  pr_doc_num         Int
  batch_key          String                       // Group items ที่รับพร้อมกัน
  user_id            String
  user_name          String
  received_at        DateTime                     // เวลารับของ
  confirmed_at       DateTime                     // เวลายืนยัน
  duration_seconds   Int
  duration_minutes   Decimal
  sla_target_minutes Int?
  is_on_time         Boolean?
  confirm_status     String                       // "confirmed"|"rejected"
  items_count        Int                          // จำนวน items
  created_at         DateTime  @default(now())

  @@index([user_id])
  @@index([pr_doc_num])
  @@index([created_at])
  @@index([is_on_time])
  @@index([batch_key])
}
```

#### kpi_sla_config
```prisma
model kpi_sla_config {
  id             Int       @id @default(autoincrement())
  kpi_type       String                           // "approval"|"receive_confirm"
  stage          String?                          // สำหรับ approval: stage เฉพาะ (null = ทุก stage)
  target_minutes Int                              // SLA target (นาที)
  target_hours   Decimal?                         // = target_minutes / 60
  description    String?
  is_active      Boolean   @default(true)
  created_at     DateTime  @default(now())
  updated_at     DateTime  @default(now())
  created_by     String?

  @@unique([kpi_type, stage])
}
```

### SLA Configuration

#### Priority Rules
```
1. หา SLA config ที่ตรงกับ kpi_type และ stage
2. ถ้าไม่เจอ → ใช้ SLA config ที่ stage = null (default)
3. ถ้าไม่มี config เลย → is_on_time = null
```

#### ตัวอย่าง SLA Config

| kpi_type | stage | target_minutes | คำอธิบาย |
|----------|-------|----------------|----------|
| approval | null | 60 | Default ทุก stage = 60 นาที |
| approval | vpc | 120 | VP-C ได้ 120 นาที |
| receive_confirm | null | 30 | ยืนยันรับของภายใน 30 นาที |

### On-time Rate Calculation

```typescript
// คำนวณ is_on_time
is_on_time = (duration_minutes <= sla_target_minutes)

// คำนวณ On-time Rate (%)
onTimeRate = (onTimeCount / totalCount) * 100

// สี
- Green: onTimeRate >= 80%
- Yellow: onTimeRate >= 50% && < 80%
- Red: onTimeRate < 50%
```

### UI Pages

#### Personal KPI (`/my-kpi`)
- เข้าถึง: กดชื่อที่ TopBar → "KPI ของฉัน"
- แสดง KPI ส่วนตัวของ user ที่ login

**Features:**
- Filter: 7 วัน, 30 วัน, 90 วัน, ทั้งหมด
- **Usage Stats Cards**: จำนวนครั้งเข้าใช้, เวลาใช้งานรวม, เฉลี่ยต่อครั้ง, วิธีออกจากระบบ + ประวัติล่าสุด
- Approval KPI Table: Stage, จำนวน, เวลาเฉลี่ย, ตรงเวลา, เกินเวลา, On-time Rate
- Receive Confirm KPI Cards: จำนวน, เวลาเฉลี่ย, On-time Rate, ยืนยัน/ปฏิเสธ
- Trend Data (placeholder)

#### Admin KPI Dashboard (`/admin/kpi-dashboard`)
- เข้าถึง: Admin Panel → "KPI Dashboard"
- ดู KPI ของทุกคน + ตั้งค่า SLA

**3 Tabs:**
1. **Approval KPI**: ตารางแสดง User, Stage, Metrics
2. **Receive Confirm KPI**: ตารางแสดง User, Batch Count, Metrics
3. **SLA Config**: Form เพิ่ม/แก้ไข + ตาราง SLA

### API Endpoints (tRPC)

#### Personal KPI
| Endpoint | คำอธิบาย |
|----------|----------|
| `kpi.getMyApprovalKPI` | KPI approval ของตัวเอง |
| `kpi.getMyReceiveConfirmKPI` | KPI receive confirm ของตัวเอง |
| `kpi.getMyKPITrend` | Trend data รายวัน |

#### Admin KPI
| Endpoint | คำอธิบาย |
|----------|----------|
| `kpi.getAllApprovalKPI` | KPI approval ทุกคน |
| `kpi.getAllReceiveConfirmKPI` | KPI receive confirm ทุกคน |

#### SLA Config
| Endpoint | คำอธิบาย |
|----------|----------|
| `kpi.getSLAConfigs` | ดู SLA configs |
| `kpi.upsertSLAConfig` | เพิ่ม/แก้ SLA |
| `kpi.deleteSLAConfig` | ลบ SLA |
| `kpi.toggleSLAConfigActive` | เปิด/ปิด SLA |

### KPI Recording Logic

#### ใน pr-approval.ts (หลัง approve)
```typescript
// 1. หา timestamp ของ stage ก่อนหน้า
const previousStageMap = {
  requester: null,           // ไม่มี stage ก่อนหน้า (ใช้ receipt_datetime)
  line: 'requester_approval_at',
  cost_center: 'line_approval_at',
  procurement: 'cost_center_approval_at',
  vpc: 'procurement_approval_at',
};

// 2. คำนวณ duration
const durationSeconds = (approved_at - previous_stage_at) / 1000;

// 3. หา SLA config
const slaConfig = await db.kpi_sla_config.findFirst({
  where: { kpi_type: 'approval', is_active: true },
  orderBy: { stage: 'desc' }  // specific stage > null
});

// 4. ตรวจ on-time
const isOnTime = (durationSeconds / 60) <= slaTargetMinutes;

// 5. บันทึก KPI
await db.approval_kpi_metric.create({ ... });
```

#### ใน pr-warehouse.ts (หลัง confirm)
```typescript
// 1. Group items by batch_key
// 2. คำนวณ duration = confirmed_at - received_at
// 3. หา SLA config (kpi_type = 'receive_confirm')
// 4. ตรวจ on-time
// 5. บันทึก KPI per batch
```

### Permission

| Permission Code | คำอธิบาย | Default |
|-----------------|----------|---------|
| `my_kpi.read` | ดู KPI ส่วนตัว | ทุก role |
| `admin_kpi.read` | ดู Admin KPI Dashboard | Admin only |
| `admin_kpi.update` | ตั้งค่า SLA | Admin only |

### Files ที่เกี่ยวข้อง

| File | คำอธิบาย |
|------|----------|
| `src/pages/my-kpi.tsx` | Personal KPI page |
| `src/pages/admin/kpi-dashboard.tsx` | Admin KPI Dashboard |
| `src/server/api/routers/kpi.ts` | KPI API Router |
| `src/server/api/routers/pr/pr-approval.ts` | บันทึก approval KPI |
| `src/server/api/routers/pr/pr-warehouse.ts` | บันทึก receive confirm KPI |
| `src/components/TopBar.tsx` | Dropdown menu → "KPI ของฉัน" |
| `src/components/AdminSidebar.tsx` | Menu → "KPI Dashboard" |
| `prisma/schema.prisma` | 3 KPI models |
| `prisma/seed-permissions.ts` | KPI permissions |

### Stage Names (Thai)

| Stage | ชื่อภาษาไทย |
|-------|-------------|
| requester | ผู้ขอซื้อ |
| line | ผู้อนุมัติตามสายงาน |
| cost_center | ผู้อนุมัติตาม Cost Center |
| procurement | งานจัดซื้อพัสดุ |
| vpc | VP-C |

---

## 4. Usage Analytics

### Overview

ระบบติดตามสถิติการใช้งานระบบ (Login/Logout) ของผู้ใช้ โดยเก็บข้อมูลจาก Heartbeat System

### Flow Diagram

```
  User Login          Heartbeat (ทุก 30 วิ)         Logout
       ↓                      ↓                       ↓
  active_session  →→→  last_heartbeat update  →→→  session_history
       ↓                                              ↓
  session_start                                 session_end + duration
```

### Database Model

#### session_history
```prisma
model session_history {
  id               Int       @id @default(autoincrement())
  user_id          String    @db.VarChar(255)
  user_name        String?   @db.VarChar(255)
  ip_address       String?   @db.VarChar(50)
  computer_name    String?   @db.VarChar(255)
  session_start    DateTime  @db.Timestamp(6)
  session_end      DateTime  @db.Timestamp(6)
  duration_seconds Int
  duration_minutes Decimal   @db.Decimal(10, 2)
  logout_type      String    @db.VarChar(20)  // "manual" | "timeout"
  created_at       DateTime  @default(now()) @db.Timestamp(6)

  @@index([user_id])
  @@index([session_start])
  @@index([session_end])
  @@index([created_at])
}
```

### การบันทึก Session History

Session history ถูกบันทึกเมื่อ:
1. **Manual Logout** - ผู้ใช้กดออกจากระบบ (`/api/auth/logout`)
2. **Timeout** - Session cleanup scheduler ลบ session ที่ไม่มี heartbeat 3 นาที

### UI Pages

#### Admin Usage Analytics (`/admin/usage-analytics`)

เข้าถึง: Admin Panel → "สถิติการใช้งาน"

**5 Tabs:**

| Tab | คำอธิบาย |
|-----|----------|
| ภาพรวม | Summary cards (จำนวนครั้ง, จำนวน Users, เวลารวม, เฉลี่ย) + วิธี logout + Active sessions |
| รายวัน | แต่ละวัน → คลิกดูว่าใครเข้าใช้บ้าง |
| รายสัปดาห์ | จันทร์-อาทิตย์ → คลิกดูรายคน |
| รายเดือน | ม.ค., ก.พ., มี.ค... → คลิกดูรายคน |
| รายคน | สถิติแต่ละคน + คลิกดูประวัติ session |

**Filters:** 7 วัน, 30 วัน, 90 วัน, ทั้งหมด

#### Personal Usage Stats (ใน `/my-kpi`)

ทุกคนสามารถดูสถิติการเข้าใช้งานของตัวเองได้ใน `/my-kpi`:
- จำนวนครั้งเข้าใช้
- เวลาใช้งานรวม (ชั่วโมง)
- เฉลี่ยต่อครั้ง (นาที)
- วิธีออกจากระบบ (กดออก / หมดเวลา)
- ประวัติการเข้าใช้งานล่าสุด 10 รายการ

### API Endpoints (tRPC)

#### Admin Usage
| Endpoint | คำอธิบาย |
|----------|----------|
| `kpi.getUsageSummary` | Summary รวม (sessions, users, time) |
| `kpi.getDailyUsageWithUsers` | รายวัน + รายคนที่เข้าใช้ |
| `kpi.getWeeklyUsageStats` | รายสัปดาห์ + รายคน |
| `kpi.getMonthlyUsageStats` | รายเดือน + รายคน |
| `kpi.getUserUsageStats` | สถิติรายคน |
| `kpi.getUserSessionHistory` | ประวัติ session ของ user |

#### Personal Usage
| Endpoint | คำอธิบาย |
|----------|----------|
| `kpi.getMyUsageStats` | สถิติการใช้งานของตัวเอง |

### Columns Explanation

| Column | คำอธิบาย | ตัวอย่าง |
|--------|----------|----------|
| เวลารวม | ผลรวมเวลาทุก session | 3 ครั้ง x 30 นาที = 90 นาที |
| เฉลี่ย | เวลารวม ÷ จำนวนครั้ง | 90 ÷ 3 = 30 นาที/ครั้ง |
| กดออก | Logout แบบ manual | ผู้ใช้กดปุ่มออกจากระบบ |
| หมดเวลา | Logout แบบ timeout | ไม่มี heartbeat 3 นาที หรือ idle 15 นาที |

### Permission

| Permission Code | คำอธิบาย | Default |
|-----------------|----------|---------|
| `admin_usage.read` | ดู Usage Analytics (Admin) | Admin only |
| `my_kpi.read` | ดูสถิติส่วนตัว (รวมใน /my-kpi) | ทุก role |

### Files ที่เกี่ยวข้อง

| File | คำอธิบาย |
|------|----------|
| `src/pages/admin/usage-analytics.tsx` | Admin Usage Analytics page |
| `src/pages/my-kpi.tsx` | Personal KPI + Usage Stats |
| `src/server/api/routers/kpi.ts` | Usage Analytics API |
| `src/pages/api/auth/logout.ts` | บันทึก session_history (manual) |
| `src/server/session-cleanup-scheduler.ts` | บันทึก session_history (timeout) |
| `src/components/AdminSidebar.tsx` | Menu → "สถิติการใช้งาน" |
| `prisma/schema.prisma` | Model `session_history` |

---

## Summary

| Feature | คำอธิบาย | หน้าหลัก |
|---------|----------|----------|
| W-Series | ติดตาม Work Order (WO→WR→WA→WC) | `/w-series/*` |
| Force Logout | Session management + Auto logout | (Background) |
| KPI Tracking | วัดเวลา Approval + Receive Confirm | `/my-kpi`, `/admin/kpi-dashboard` |
| Usage Analytics | สถิติการเข้าใช้งาน (Login/Logout) | `/my-kpi`, `/admin/usage-analytics` |

---

*Last Updated: February 2026*
