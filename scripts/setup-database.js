/**
 * Database Setup Script
 * สคริปต์นี้จะสร้างตารางและ views ทั้งหมดใน PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function setupDatabase() {
  console.log('🚀 เริ่มต้นการสร้างโครงสร้างฐานข้อมูล...\n');

  try {
    // อ่านไฟล์ SQL
    const sqlPath = path.join(__dirname, '..', 'database-setup.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // แบ่ง SQL commands (แยกตาม semicolon ที่ไม่อยู่ใน function)
    const commands = sqlContent
      .split(/;(?=\s*(?:CREATE|DROP|INSERT|ALTER|--|\n\n))/gi)
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--') && cmd.length > 10);

    console.log(`📝 พบ SQL commands ทั้งหมด ${commands.length} คำสั่ง\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      // แสดงความคืบหน้า
      const preview = command.substring(0, 80).replace(/\s+/g, ' ');
      process.stdout.write(`[${i + 1}/${commands.length}] ${preview}... `);

      try {
        await prisma.$executeRawUnsafe(command + ';');
        console.log('✅');
        successCount++;
      } catch (error) {
        // บาง command อาจ error ถ้ามีอยู่แล้ว (IF NOT EXISTS)
        if (error.message.includes('already exists')) {
          console.log('⚠️  (อยู่แล้ว)');
          successCount++;
        } else {
          console.log('❌');
          console.error(`   Error: ${error.message}\n`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ สำเร็จ: ${successCount} คำสั่ง`);
    console.log(`❌ ผิดพลาด: ${errorCount} คำสั่ง`);
    console.log('='.repeat(60));

    // ตรวจสอบว่ามีตารางและ views หรือยัง
    console.log('\n🔍 ตรวจสอบโครงสร้างฐานข้อมูล...\n');

    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log('📊 ตารางที่สร้างแล้ว:');
    tables.forEach((table, idx) => {
      console.log(`   ${idx + 1}. ${table.table_name}`);
    });

    const views = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\n👁️  Views ที่สร้างแล้ว:');
    views.forEach((view, idx) => {
      console.log(`   ${idx + 1}. ${view.table_name}`);
    });

    const matviews = await prisma.$queryRaw`
      SELECT matviewname
      FROM pg_matviews
      WHERE schemaname = 'public'
      ORDER BY matviewname;
    `;

    console.log('\n📦 Materialized Views ที่สร้างแล้ว:');
    matviews.forEach((mv, idx) => {
      console.log(`   ${idx + 1}. ${mv.matviewname}`);
    });

    console.log('\n✨ การตั้งค่าฐานข้อมูลเสร็จสมบูรณ์!\n');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// รันสคริปต์
setupDatabase();
