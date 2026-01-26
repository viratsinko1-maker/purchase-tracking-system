/**
 * Delayed PR Notification Scheduler
 * ส่งแจ้งเตือน PR ที่ล่าช้าเข้า Telegram ทุกวันเวลา 02:00
 */

import { db } from '~/server/db';
import { createCaller } from '~/server/api/root';
import { notifyDelayedPRs } from '~/server/services/telegram';
import cron from 'node-cron';

/**
 * ส่งรายงาน PR ที่ล่าช้า
 */
async function sendDelayedPRNotification() {
  console.log('[DELAYED-PR-NOTIFY] 🚀 Starting delayed PR notification...');

  try {
    // สร้าง tRPC caller แบบ server-side
    const caller = createCaller({ db, req: undefined });

    // ดึงข้อมูล PR ที่ล่าช้าแบบจัดกลุ่ม
    const delayedPRs = await caller.pr.getDelayedPRsGrouped();

    if (!delayedPRs || delayedPRs.length === 0) {
      console.log('[DELAYED-PR-NOTIFY] ℹ️ No delayed PRs found');
      return;
    }

    console.log(`[DELAYED-PR-NOTIFY] 📊 Found ${delayedPRs.length} delayed PR groups`);

    // ส่งแจ้งเตือนเข้า Telegram
    await notifyDelayedPRs(delayedPRs);

    console.log('[DELAYED-PR-NOTIFY] ✅ Notification sent successfully');
  } catch (error) {
    console.error('[DELAYED-PR-NOTIFY] ❌ Error:', error);
  }
}

/**
 * เริ่มต้น Scheduler - ทำงานทุกวันเวลา 02:00
 */
export function initDelayedPRNotificationScheduler() {
  console.log('[DELAYED-PR-NOTIFY] Initializing scheduler...');

  // Schedule: ทุกวันเวลา 02:00 (Asia/Bangkok timezone)
  cron.schedule('0 2 * * *', async () => {
    console.log('[DELAYED-PR-NOTIFY] ⏰ Scheduled notification triggered');
    await sendDelayedPRNotification();
  }, {
    timezone: 'Asia/Bangkok',
  });

  console.log('[DELAYED-PR-NOTIFY] ✅ Scheduler initialized');
  console.log('[DELAYED-PR-NOTIFY] 📅 Schedule: Daily at 02:00 (Asia/Bangkok)');

  // คำนวณเวลาที่จะรันครั้งถัดไป
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(2, 0, 0, 0);

  // ถ้าเวลาปัจจุบันผ่าน 02:00 แล้ว ให้ set เป็นวันถัดไป
  if (now.getHours() >= 2) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  console.log(`[DELAYED-PR-NOTIFY] Next run: ${nextRun.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
}

/**
 * Manual trigger - สำหรับทดสอบ
 */
export async function triggerDelayedPRNotification() {
  console.log('[DELAYED-PR-NOTIFY] 🔧 Manual trigger');
  await sendDelayedPRNotification();
}
