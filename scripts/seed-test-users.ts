/**
 * Seed 5 Test Users สำหรับทดสอบระบบ Approval 5 ขั้น
 *
 * Usage: npx tsx scripts/seed-test-users.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const db = new PrismaClient();
const SALT_ROUNDS = 10;

const TEST_USERS = [
  { id: "test-user-1", email: "1@1", name: "ผู้ขอซื้อ (Test)", role: "PR" },
  { id: "test-user-2", email: "2@2", name: "ผู้อนุมัติสายงาน (Test)", role: "PR" },
  { id: "test-user-3", email: "3@3", name: "ผู้อนุมัติ CC (Test)", role: "PR" },
  { id: "test-user-4", email: "4@4", name: "งานจัดซื้อพัสดุ (Test)", role: "Manager" },
  { id: "test-user-5", email: "5@5", name: "VP-C (Test)", role: "Approval" },
];

async function main() {
  console.log("=== Seed 5 Test Users ===\n");

  const hashedPassword = await bcrypt.hash("1234", SALT_ROUNDS);

  for (const u of TEST_USERS) {
    const existing = await db.user_production.findUnique({ where: { email: u.email } });

    if (existing) {
      console.log(`⚠️  ${u.email} มีอยู่แล้ว - ข้าม`);
      continue;
    }

    // Check id conflict
    const existingId = await db.user_production.findUnique({ where: { id: u.id } });
    if (existingId) {
      console.log(`⚠️  ID ${u.id} มีอยู่แล้ว - ข้าม`);
      continue;
    }

    await db.user_production.create({
      data: {
        id: u.id,
        email: u.email,
        userId: u.email,
        username: u.name,
        name: u.name,
        password: hashedPassword,
        role: u.role,
        isActive: true,
        sourceId: null, // ไม่มี sourceId → sync จะไม่ deactivate
        updatedAt: new Date(),
      },
    });

    console.log(`✅ สร้าง ${u.email} (${u.name}) - Role: ${u.role}`);
  }

  console.log("\n=== เสร็จสิ้น ===");
  console.log("Login ด้วย Email เช่น 1@1 / Password: 1234");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
