// สคริปต์สำหรับทริกเกอร์ Full Sync โดยการลบ sync log ของวันนี้
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('[TRIGGER-FULL-SYNC] Starting...');

    // ลบ sync log ของวันนี้เพื่อบังคับให้ทำ Full Sync
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM sync_log
      WHERE DATE(sync_date) = $1::DATE
    `, today);

    console.log(`[TRIGGER-FULL-SYNC] Deleted ${result} sync logs from today (${today})`);
    console.log('[TRIGGER-FULL-SYNC] Next sync will be a FULL SYNC');
    console.log('[TRIGGER-FULL-SYNC] Please run sync from the web interface now');

  } catch (error) {
    console.error('[TRIGGER-FULL-SYNC] Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
