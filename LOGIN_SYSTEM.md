# ระบบล็อกอิน (Login System)

> **Version**: v4.0
> **Last Updated**: 2026-01-31
> **Status**: Production Ready

## ภาพรวม

ระบบล็อกอินรองรับผู้ใช้ 2 ประเภท:
1. **User (Local)** - ผู้ใช้ภายในระบบ (password เป็น plain text)
2. **User_production** - ผู้ใช้จาก TMK_PDPJ01 (password เป็น bcrypt hash)

---

## ข้อมูลในฐานข้อมูล

### ตาราง User (Local Users)

```prisma
model User {
  id            String    @id @default(uuid())
  userId        String?   @unique
  username      String?   @unique
  name          String?
  password      String?   // Plain text
  email         String?   @unique
  role          String    @default("PR")
  isActive      Boolean   @default(true)
}
```

### ตาราง User_production (Production Users)

```prisma
model User_production {
  id              String    @id
  email           String    @unique
  userId          String?
  username        String?
  name            String?
  password        String?   // bcrypt hashed
  role            String    @default("PR")
  isActive        Boolean   @default(true)
  sourceId        String?   // ID จาก TMK_PDPJ01
  telegramChatId  String?   // สำหรับแจ้งเตือน Telegram
  lastSyncAt      DateTime?
}
```

---

## ระบบ Role

| Role | สิทธิ์การใช้งาน |
|------|---------------|
| `PR` | ดู PR, ติดตาม PR, รับของ |
| `Manager` | เหมือน PR + อนุมัติ (งานจัดซื้อพัสดุ) |
| `Approval` | เหมือน PR + อนุมัติ (VP-C) |
| `Admin` | ทุกสิทธิ์ + จัดการผู้ใช้ + ล้างการอนุมัติ |

---

## การเข้ารหัสรหัสผ่าน

### Local Users
- รหัสผ่านเป็น **plain text** (สำหรับ admin accounts ภายใน)

### Production Users
- รหัสผ่านเข้ารหัสด้วย **bcrypt** (10 salt rounds)
- รหัสผ่านเริ่มต้นเมื่อ sync จาก TMK: `1234`

```typescript
import bcrypt from "bcrypt";
const SALT_ROUNDS = 10;

// Hash password
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

---

## การ Sync ผู้ใช้จาก TMK

ผู้ใช้จาก TMK_PDPJ01 สามารถ sync เข้าระบบได้:

```
Admin → จัดการผู้ใช้ → Tab "ผู้ใช้ Production" → ปุ่ม "Sync จาก TMK"
```

**การทำงาน:**
1. ดึงผู้ใช้จาก TMK_PDPJ01 (PostgreSQL 192.168.1.3)
2. สร้างผู้ใช้ใหม่ด้วยรหัสผ่านเริ่มต้น `1234`
3. อัพเดทข้อมูล name/username สำหรับผู้ใช้เดิม
4. ปิดใช้งานผู้ใช้ที่ไม่มีใน TMK แล้ว

---

## Audit Trail

ทุกการกระทำเกี่ยวกับการเข้าสู่ระบบจะถูกบันทึก:

| Action | รายละเอียด |
|--------|------------|
| `LOGIN` | เข้าสู่ระบบสำเร็จ |
| `LOGOUT` | ออกจากระบบ |
| `UPDATE` | เปลี่ยนรหัสผ่าน |
| `CREATE` | สร้างผู้ใช้ใหม่ |
| `DELETE` | ลบผู้ใช้ |
| `SYNC_DATA` | Sync ผู้ใช้จาก TMK |

**ข้อมูลที่บันทึก:**
- user_id, user_name
- action, table_name, record_id
- old_values, new_values (JSON)
- ip_address, computer_name
- timestamp

ดูเพิ่มเติมที่ [AUDIT_TRAIL.md](./AUDIT_TRAIL.md)

---

## ไฟล์ที่เกี่ยวข้อง

### API Routes
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/pages/api/auth/login.ts` | API สำหรับล็อกอิน |
| `src/pages/api/auth/logout.ts` | API สำหรับออกจากระบบ |
| `src/pages/api/auth/change-password.ts` | API เปลี่ยนรหัสผ่าน |
| `src/pages/api/admin/users.ts` | จัดการผู้ใช้ Local |
| `src/pages/api/admin/users-production.ts` | จัดการผู้ใช้ Production |

### Pages
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/pages/login.tsx` | หน้าล็อกอิน |
| `src/pages/admin/users.tsx` | หน้าจัดการผู้ใช้ |

### Components
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/components/TopBar.tsx` | แถบบนแสดงชื่อผู้ใช้ |
| `src/components/AuthGuard.tsx` | ป้องกันการเข้าถึงหน้าต่างๆ |

### Hooks & Utils
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/hooks/useAuth.ts` | Custom hook สำหรับ authentication |
| `src/server/api/utils/auditLog.ts` | Helper สำหรับ audit logging |

---

## การใช้งาน

### หน้าล็อกอิน
1. เข้าที่ `/login`
2. ใส่ `User ID`, `Email` หรือ `Username`
3. ใส่ `Password`
4. กดปุ่ม "เข้าสู่ระบบ"

### การออกจากระบบ
- คลิกปุ่ม "ออกจากระบบ" ที่ TopBar (มุมขวาบน)

### การเปลี่ยนรหัสผ่าน
- คลิกที่ชื่อผู้ใช้ → เปลี่ยนรหัสผ่าน
- หรือ Admin เปลี่ยนให้ในหน้าจัดการผู้ใช้

---

## การจัดเก็บข้อมูล Session

- ใช้ `localStorage` เก็บข้อมูลผู้ใช้ที่ล็อกอินอยู่
- ข้อมูลจะหายเมื่อ clear browser cache หรือออกจากระบบ

```typescript
{
  id: string,
  userId: string,
  username: string,
  name: string,
  role: string,      // PR, Manager, Approval, Admin
  isActive: boolean,
  source: "local" | "production"
}
```

---

## สิ่งที่ปรับปรุงจาก v1.0

- [x] เข้ารหัส password ด้วย bcrypt (Production users)
- [x] เพิ่ม role system (PR, Manager, Approval, Admin)
- [x] สร้างหน้า Admin จัดการผู้ใช้
- [x] Sync ผู้ใช้จาก TMK_PDPJ01
- [x] Audit Trail สำหรับ login/logout และทุกการกระทำ
- [ ] JWT Token แทน localStorage (อนาคต)
- [ ] Session timeout (อนาคต)
- [ ] Remember me feature (อนาคต)

---

**Last Updated**: 2026-01-31
**Version**: v4.0
