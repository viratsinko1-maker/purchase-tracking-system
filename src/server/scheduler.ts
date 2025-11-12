/**
 * Cron Scheduler สำหรับ Auto Sync
 *
 * Full Sync: 07:00, 10:00, 12:00, 15:00, 17:00 (5 รอบต่อวัน)
 * Incremental Sync: ทุกชั่วโมง (ยกเว้นเวลาที่ทำ Full Sync)
 */

import cron from 'node-cron';
import { db } from '~/server/db';

/**
 * เรียก tRPC procedure sync โดยตรง
 */
async function triggerSync(fullSync: boolean = false) {
  const syncType = fullSync ? 'FULL' : 'INCREMENTAL';
  const syncStartTime = new Date();

  try {
    console.log(`[SCHEDULER] Starting ${syncType} sync at ${syncStartTime.toISOString()}`);

    // เรียก sync procedure ผ่าน raw query
    const result = await db.$queryRaw`
      SELECT sync_pr_data(${fullSync});
    ` as any[];

    const syncEndTime = new Date();
    const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);

    console.log(`[SCHEDULER] ✅ ${syncType} sync completed successfully in ${durationSeconds}s`);

    return {
      success: true,
      sync_type: syncType,
      duration_seconds: durationSeconds,
    };

  } catch (error) {
    const syncEndTime = new Date();
    const durationSeconds = Math.round((syncEndTime.getTime() - syncStartTime.getTime()) / 1000);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[SCHEDULER] ❌ ${syncType} sync error:`, error);

    try {
      await db.$queryRawUnsafe(`
        INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds, sync_type, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, syncEndTime, 'error', 0, durationSeconds, syncType, errorMessage);
    } catch (logError) {
      console.error('[SCHEDULER] Failed to log sync error:', logError);
    }

    return {
      success: false,
      sync_type: syncType,
      error: errorMessage,
    };
  }
}

/**
 * เริ่มต้น Cron Scheduler
 *
 * Full Sync Schedule:
 * - 0 7 * * * = ทุกวันตอน 07:00
 * - 0 10 * * * = ทุกวันตอน 10:00
 * - 0 12 * * * = ทุกวันตอน 12:00
 * - 0 15 * * * = ทุกวันตอน 15:00
 * - 0 17 * * * = ทุกวันตอน 17:00
 *
 * Incremental Sync Schedule:
 * - 0 * * * * = ทุกชั่วโมง (ยกเว้น 7, 10, 12, 15, 17)
 *
 * Timezone: Asia/Bangkok
 */
export function initScheduler() {
  // Full Sync: 07:00
  cron.schedule('0 7 * * *', async () => {
    console.log('[SCHEDULER] 🕐 Triggered Full Sync at 07:00');
    await triggerSync(true);
  }, {
    timezone: 'Asia/Bangkok'
  });

  // Full Sync: 10:00
  cron.schedule('0 10 * * *', async () => {
    console.log('[SCHEDULER] 🕐 Triggered Full Sync at 10:00');
    await triggerSync(true);
  }, {
    timezone: 'Asia/Bangkok'
  });

  // Full Sync: 12:00
  cron.schedule('0 12 * * *', async () => {
    console.log('[SCHEDULER] 🕐 Triggered Full Sync at 12:00');
    await triggerSync(true);
  }, {
    timezone: 'Asia/Bangkok'
  });

  // Full Sync: 15:00
  cron.schedule('0 15 * * *', async () => {
    console.log('[SCHEDULER] 🕐 Triggered Full Sync at 15:00');
    await triggerSync(true);
  }, {
    timezone: 'Asia/Bangkok'
  });

  // Full Sync: 17:00
  cron.schedule('0 17 * * *', async () => {
    console.log('[SCHEDULER] 🕐 Triggered Full Sync at 17:00');
    await triggerSync(true);
  }, {
    timezone: 'Asia/Bangkok'
  });

  // Incremental Sync: ทุกชั่วโมง (ยกเว้น 7, 10, 12, 15, 17)
  cron.schedule('0 0-6,8-9,11,13-14,16,18-23 * * *', async () => {
    const currentHour = new Date().getHours();
    console.log(`[SCHEDULER] 🕐 Triggered Incremental Sync at ${currentHour}:00`);
    await triggerSync(false);
  }, {
    timezone: 'Asia/Bangkok'
  });

  console.log('[SCHEDULER] ✅ Scheduler initialized');
  console.log('[SCHEDULER] 📅 Full Sync: 07:00, 10:00, 12:00, 15:00, 17:00');
  console.log('[SCHEDULER] 📅 Incremental Sync: Every hour (except Full Sync hours)');
}
