import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function refreshMaterializedView() {
  try {
    console.log('🔄 กำลัง Refresh Materialized View...\n');

    const startTime = Date.now();

    // Refresh Materialized View (แบบ Concurrent เพื่อไม่ lock table)
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY pr_po_summary`;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Refresh สำเร็จ! ใช้เวลา ${duration} วินาที\n`);

    // แสดงข้อมูลสรุป
    const summary = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_pr,
        SUM(po_count) as total_po_lines,
        MAX(last_updated) as last_sync
      FROM pr_po_summary
    `;

    console.log('📊 สรุปข้อมูล:');
    console.log(`  PR ทั้งหมด: ${summary[0].total_pr} รายการ`);
    console.log(`  PO Lines ทั้งหมด: ${summary[0].total_po_lines} รายการ`);
    console.log(`  อัพเดตล่าสุด: ${summary[0].last_sync}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

refreshMaterializedView();
