/**
 * Auto Sync Scheduler สำหรับ PR และ PO
 *
 * - Full Sync ทุก 2 ชั่วโมง (120 นาที)
 * - รัน PR และ PO แบบ background
 * - มี status tracking เพื่อป้องกัน manual sync ซ้อนทับ
 */

import { db } from '~/server/db';
import { createCaller } from '~/server/api/root';

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
 * Initialize Auto-Sync Scheduler
 * Runs every 2 hours (120 minutes)
 */
export function initAutoSyncScheduler() {
  const INTERVAL_MS = 120 * 60 * 1000; // 120 minutes in milliseconds

  // Run immediately on startup (optional - ปิดไว้ก่อนเพื่อไม่รบกวน)
  // runFullAutoSync();

  // Schedule to run every 2 hours
  setInterval(async () => {
    console.log('[AUTO-SYNC] ⏰ Scheduled sync triggered');
    await runFullAutoSync();
  }, INTERVAL_MS);

  console.log('[AUTO-SYNC] ✅ Scheduler initialized - Full Sync will run every 2 hours');
  console.log(`[AUTO-SYNC] Next sync will be at: ${new Date(Date.now() + INTERVAL_MS).toLocaleString('th-TH')}`);
}
