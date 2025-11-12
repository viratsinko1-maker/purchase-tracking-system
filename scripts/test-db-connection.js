const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('กำลังทดสอบการเชื่อมต่อ PostgreSQL...\n');

    // ทดสอบการเชื่อมต่อด้วยการ query ข้อมูล database
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✓ เชื่อมต่อสำเร็จ!');
    console.log('\nข้อมูล PostgreSQL:');
    console.log(result[0].version);

    // ดูรายชื่อตารางที่มีอยู่
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\n📋 ตารางที่มีอยู่ในฐานข้อมูล:');
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });

    console.log('\n✓ การทดสอบเสร็จสมบูรณ์');

  } catch (error) {
    console.error('✗ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
