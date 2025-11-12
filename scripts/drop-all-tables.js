import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dropAllTables() {
  try {
    console.log('กำลังลบตารางทั้งหมดใน PostgreSQL...\n');

    // ดูรายชื่อตารางที่มีอยู่ก่อน
    const tablesBefore = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log(`พบตาราง ${tablesBefore.length} ตาราง:`);
    tablesBefore.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });

    console.log('\nกำลังลบตารางทั้งหมด...');

    // ลบตารางทั้งหมดด้วย CASCADE
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log('✓ ลบตารางทั้งหมดสำเร็จแล้ว');

    // ตรวจสอบอีกครั้ง
    const tablesAfter = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log(`\n✓ ตารางที่เหลือ: ${tablesAfter.length} ตาราง`);

  } catch (error) {
    console.error('✗ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

dropAllTables();
