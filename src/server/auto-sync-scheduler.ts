/**
 * Auto Sync Scheduler สำหรับ PR และ PO
 *
 * - Full Sync ทุก 2 ชั่วโมง (ใช้ node-cron)
 * - รัน PR และ PO แบบ background
 * - มี status tracking เพื่อป้องกัน manual sync ซ้อนทับ
 */

import { db } from '~/server/db';
import { createCaller } from '~/server/api/root';
import cron from 'node-cron';

// Global sync status
let isSyncInProgress = false;
let currentSyncType: 'PR' | 'PO' | 'BOTH' | null = null;
let syncStartTime: Date | null = null;
let lastSyncEndTime: Date | null = null;

/**
 * Get current sync status
 */
export function getSyncStatus() {
  return {
    isInProgress: isSyncInProgress,
    syncType: currentSyncType,
    startTime: syncStartTime,
    lastEndTime: lastSyncEndTime,
  };
}

/**
 * Full Sync for PR
 */
async function syncPR() {
  console.log('[AUTO-SYNC] Starting PR FULL sync...');

  try {
    // สร้าง tRPC caller แบบ server-side พร้อม context
    const caller = createCaller({ db, req: undefined });

    // เรียก PR sync ด้วย fullSync: true
    const result = await caller.pr.sync({ fullSync: true });

    console.log('[AUTO-SYNC] ✅ PR FULL sync completed');
    return result;
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ PR sync error:', error);
    throw error;
  }
}

/**
 * Full Sync for PO
 */
async function syncPO() {
  console.log('[AUTO-SYNC] Starting PO FULL sync...');

  try {
    // สร้าง tRPC caller แบบ server-side พร้อม context
    const caller = createCaller({ db, req: undefined });

    // เรียก PO sync
    const result = await caller.po.sync();

    console.log('[AUTO-SYNC] ✅ PO FULL sync completed');
    return result;
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ PO sync error:', error);
    throw error;
  }
}

/**
 * Run full sync for both PR and PO
 */
export async function runFullAutoSync() {
  // ป้องกัน sync ซ้อนทับ
  if (isSyncInProgress) {
    console.log('[AUTO-SYNC] ⚠️ Sync already in progress, skipping...');
    return {
      success: false,
      message: 'Sync already in progress',
    };
  }

  isSyncInProgress = true;
  currentSyncType = 'BOTH';
  syncStartTime = new Date();

  console.log(`[AUTO-SYNC] 🚀 Starting full auto-sync at ${syncStartTime.toISOString()}`);

  try {
    // Sync PR first
    currentSyncType = 'PR';
    await syncPR();

    // Then sync PO
    currentSyncType = 'PO';
    await syncPO();

    lastSyncEndTime = new Date();
    const duration = (lastSyncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[AUTO-SYNC] ✅ Full auto-sync completed in ${duration.toFixed(2)}s`);

    return {
      success: true,
      duration,
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
    };
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ Auto-sync failed:', error);
    lastSyncEndTime = new Date();

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
    };
  } finally {
    isSyncInProgress = false;
    currentSyncType = null;
    syncStartTime = null;
  }
}

/**
 * Manual Full Refresh for PR ONLY
 * ล้างข้อมูล PR ทั้งหมดแล้วดึงใหม่
 * ใช้เมื่อพบปัญหา data integrity (เช่น PR-PO link ไม่ตรงกัน)
 */
export async function runManualPRFullRefresh() {
  // ป้องกัน sync ซ้อนทับ
  if (isSyncInProgress) {
    console.log('[MANUAL-REFRESH] ⚠️ Sync already in progress, skipping...');
    return {
      success: false,
      message: 'Sync already in progress',
    };
  }

  isSyncInProgress = true;
  currentSyncType = 'PR';
  syncStartTime = new Date();

  console.log(`[MANUAL-REFRESH] 🔄 Starting MANUAL PR FULL REFRESH at ${syncStartTime.toISOString()}`);
  console.log('[MANUAL-REFRESH] 🗑️  This will TRUNCATE all PR data and re-sync from SAP');

  try {
    // เรียก PR sync ด้วย fullSync: true
    // PR router จะทำการ TRUNCATE และดึงข้อมูลใหม่ทั้งหมด
    await syncPR();

    lastSyncEndTime = new Date();
    const duration = (lastSyncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[MANUAL-REFRESH] ✅ PR Full Refresh completed in ${duration.toFixed(2)}s`);

    return {
      success: true,
      duration,
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
      message: 'PR data has been completely refreshed',
    };
  } catch (error) {
    console.error('[MANUAL-REFRESH] ❌ PR Full Refresh failed:', error);
    lastSyncEndTime = new Date();

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
    };
  } finally {
    isSyncInProgress = false;
    currentSyncType = null;
    syncStartTime = null;
  }
}

/**
 * Initialize Auto-Sync Scheduler
 * Runs every 2 hours using node-cron
 * Timezone: Asia/Bangkok
 */
export function initAutoSyncScheduler() {
  // Schedule to run every 2 hours at :00 (00:00, 02:00, 04:00, etc.)
  cron.schedule('0 */2 * * *', async () => {
    const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    console.log(`[AUTO-SYNC] ⏰ Scheduled sync triggered at ${currentTime}`);
    await runFullAutoSync();
  }, {
    timezone: 'Asia/Bangkok'
  });

  console.log('[AUTO-SYNC] ✅ Scheduler initialized - Full Sync will run every 2 hours');
  console.log('[AUTO-SYNC] 📅 Schedule: Every 2 hours at :00 (00:00, 02:00, 04:00, ...)');

  // แสดงเวลา sync ครั้งถัดไป
  const now = new Date();
  const nextHour = Math.ceil(now.getHours() / 2) * 2;
  const nextSync = new Date(now);
  nextSync.setHours(nextHour, 0, 0, 0);
  if (nextSync <= now) {
    nextSync.setHours(nextSync.getHours() + 2);
  }
  console.log(`[AUTO-SYNC] Next sync will be at: ${nextSync.toLocaleString('th-TH')}`);
}
