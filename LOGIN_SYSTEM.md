# ระบบล็อกอิน (Login System)

## ภาพรวม
ระบบล็อกอินแบบง่าย สำหรับป้องกันการเข้าถึงหน้าต่างๆ ในระบบ

## ข้อมูลในฐานข้อมูล

### ตาราง User
มีการเพิ่มฟิลด์ใหม่ในตาราง `User`:
- `userId` - รหัสผู้ใช้ (ใช้สำหรับล็อกอิน)
- `username` - ชื่อผู้ใช้ (ใช้สำหรับล็อกอิน)
- `password` - รหัสผ่าน (ยังไม่เข้ารหัส ตั้งไว้ที่ "1" ก่อน)

## ผู้ใช้ Admin (สำหรับทดสอบ)
- **User ID**: `Admin`
- **Username**: `กำลังทดสอบ`
- **Password**: `1`
- **ชื่อ**: `กำลังทดสอบ`

## การใช้งาน

### หน้าล็อกอิน
- เข้าที่ `/login`
- สามารถใส่ `User ID` หรือ `Username` ก็ได้
- ใส่ `Password`
- กดปุ่ม "เข้าสู่ระบบ"

### การออกจากระบบ
- คลิกปุ่ม "ออกจากระบบ" ที่ TopBar (มุมขวาบน)

### TopBar
- แสดงข้อความ "Welcome : [ชื่อผู้ใช้]" ที่มุมซ้ายบน
- แสดงในทุกหน้า ยกเว้นหน้าล็อกอิน

## ไฟล์ที่เกี่ยวข้อง

### API Routes
- `src/pages/api/auth/login.ts` - API สำหรับล็อกอิน
- `src/pages/api/auth/logout.ts` - API สำหรับออกจากระบบ

### Pages
- `src/pages/login.tsx` - หน้าล็อกอิน

### Components
- `src/components/TopBar.tsx` - แถบบนแสดงชื่อผู้ใช้
- `src/components/AuthGuard.tsx` - ป้องกันการเข้าถึงหน้าต่างๆ

### Hooks
- `src/hooks/useAuth.ts` - Custom hook สำหรับจัดการ authentication

### Configuration
- `src/pages/_app.tsx` - เพิ่ม AuthGuard wrapper

## การจัดเก็บข้อมูล
- ใช้ `localStorage` เก็บข้อมูลผู้ใช้ที่ล็อกอินอยู่
- ข้อมูลจะหายเมื่อ clear browser cache หรือออกจากระบบ

## สิ่งที่ต้องทำในอนาคต
1. เข้ารหัส password (bcrypt หรือ argon2)
2. เพิ่มฟิลด์ `role` และ `active` สำหรับจัดการสิทธิ์
3. สร้างหน้า Admin สำหรับจัดการผู้ใช้
4. นำเข้าข้อมูลผู้ใช้จาก Excel
5. ลบผู้ใช้ admin ที่สร้างไว้เมื่อมีผู้ใช้จริงแล้ว
6. ใช้ JWT Token แทน localStorage (ปลอดภัยกว่า)
7. เพิ่ม session timeout
8. เพิ่ม remember me feature

## หมายเหตุ
- รหัสผ่านยังไม่ได้เข้ารหัส ห้ามใช้ในระบบจริง (production)
- เป็นระบบพื้นฐานเพื่อทดสอบก่อน จะพัฒนาต่อทีหลัง
