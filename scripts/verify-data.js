import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
  try {
    console.log('🔍 ตรวจสอบข้อมูลที่ sync มา...\n');

    // นับจำนวน records
    const count = await prisma.purchaseRequestPO.count();
    console.log(`✓ จำนวนรายการทั้งหมด: ${count.toLocaleString()} รายการ\n`);

    // ตัวอย่างข้อมูล 5 รายการแรก
    const samples = await prisma.purchaseRequestPO.findMany({
      take: 5,
      orderBy: { prDate: 'desc' }
    });

    console.log('📋 ตัวอย่างข้อมูล 5 รายการล่าสุด:');
    samples.forEach((record, index) => {
      console.log(`\n${index + 1}. PR #${record.prNo}`);
      console.log(`   วันที่: ${record.prDate.toISOString().split('T')[0]}`);
      console.log(`   ผู้เปิด: ${record.prRequester}`);
      console.log(`   สถานะ: ${record.prStatus}`);
      console.log(`   PO: ${record.poNo || '-'}`);
    });

    console.log('\n✅ การตรวจสอบข้อมูลเสร็จสิ้น');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyData();
