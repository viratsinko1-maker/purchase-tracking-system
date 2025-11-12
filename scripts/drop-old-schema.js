import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dropOldSchema() {
  try {
    console.log('🗑️  เริ่มการลบ schema เก่า...\n');

    // ✅ STEP 1: ดูรายชื่อ tables ที่มีอยู่
    console.log('📋 กำลังตรวจสอบ tables ที่มีอยู่...');
    const tablesBefore = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\n📊 พบ ${tablesBefore.length} tables:`);
    tablesBefore.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });

    // ตรวจสอบว่ามี table เก่าหรือไม่
    const hasOldTable = tablesBefore.some(t =>
      t.table_name === 'PurchaseRequestPO' ||
      t.table_name.toLowerCase() === 'purchaserequestpo'
    );

    if (!hasOldTable && tablesBefore.length === 0) {
      console.log('\n✅ ไม่มี tables เก่า ไม่ต้องลบอะไร');
      return;
    }

    // ✅ STEP 2: ยืนยันการลบ
    console.log('\n⚠️  คำเตือน: สคริปต์นี้จะลบ tables ต่อไปนี้:');
    console.log('  - PurchaseRequestPO (table เก่า)');
    console.log('  - pr_po_summary (materialized view เก่า)');
    console.log('  - tables และ views อื่นๆ ที่เกี่ยวข้อง');

    console.log('\n🔄 กำลังลบ tables เก่า...\n');

    // ✅ STEP 3: ลบ Materialized View เก่า (ถ้ามี)
    try {
      await prisma.$executeRawUnsafe(`
        DROP MATERIALIZED VIEW IF EXISTS pr_po_summary CASCADE;
      `);
      console.log('  ✓ ลบ materialized view เก่า (pr_po_summary)');
    } catch (error) {
      console.log('  ℹ️  ไม่มี materialized view เก่า');
    }

    // ✅ STEP 4: ลบ Table เก่า PurchaseRequestPO
    try {
      await prisma.$executeRawUnsafe(`
        DROP TABLE IF EXISTS "PurchaseRequestPO" CASCADE;
      `);
      console.log('  ✓ ลบ table เก่า (PurchaseRequestPO)');
    } catch (error) {
      console.log('  ℹ️  ไม่มี table เก่า PurchaseRequestPO');
    }

    // ✅ STEP 5: ลบ Prisma migrations table (ถ้าต้องการเริ่มใหม่)
    try {
      await prisma.$executeRawUnsafe(`
        DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
      `);
      console.log('  ✓ ลบ Prisma migrations table');
    } catch (error) {
      console.log('  ℹ️  ไม่มี Prisma migrations table');
    }

    // ✅ STEP 6: ตรวจสอบอีกครั้งหลังลบ
    const tablesAfter = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\n📊 Tables ที่เหลืออยู่: ${tablesAfter.length} tables`);
    if (tablesAfter.length > 0) {
      tablesAfter.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
    } else {
      console.log('  (ไม่มี tables เหลืออยู่)');
    }

    console.log('\n✅ การลบ schema เก่าเสร็จสมบูรณ์!');
    console.log('\n📝 ขั้นตอนต่อไป:');
    console.log('  1. รัน SQL script: psql -U user -d database -f create_pr_tracking_schema.sql');
    console.log('  2. หรือใช้ pgAdmin/DBeaver เพื่อ execute SQL script');
    console.log('  3. จากนั้นรัน sync script: node sync-pr-po-new.js');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// รันสคริปต์
dropOldSchema();
