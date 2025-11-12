/**
 * Attachment Sync Scheduler
 * - Sync PR & PO attachments ทุก 2 ชั่วโมง
 * - Full refresh (ลบ + ดึงใหม่) ทุกเที่ยงคืน (00:00)
 */

import { syncPRAttachments } from '~/server/api/services/prAttachmentSync';
import { syncPOAttachments } from '~/server/api/services/poAttachmentSync';
import { db } from '~/server/db';

// Global sync status
let isAttachmentSyncInProgress = false;
let lastSyncEndTime: Date | null = null;

/**
 * Get current attachment sync status
 */
export function getAttachmentSyncStatus() {
  return {
    isInProgress: isAttachmentSyncInProgress,
    lastEndTime: lastSyncEndTime,
  };
}

/**
 * Full Refresh - ลบทั้งหมดแล้วดึงใหม่
 */
async function fullRefreshAttachments() {
  console.log('[ATTACHMENT-SYNC] 🌙 Starting midnight full refresh...');

  try {
    // ลบ attachments ทั้งหมด
    console.log('[ATTACHMENT-SYNC] Clearing all attachments...');
    await db.$executeRaw`TRUNCATE TABLE pr_attachments CASCADE`;
    await db.$executeRaw`TRUNCATE TABLE po_attachments CASCADE`;
    console.log('[ATTACHMENT-SYNC] ✅ Tables cleared');

    // ดึงใหม่ทั้งหมด
    await syncAttachments();

    console.log('[ATTACHMENT-SYNC] ✅ Midnight full refresh completed');
  } catch (error) {
    console.error('[ATTACHMENT-SYNC] ❌ Full refresh failed:', error);
    throw error;
  }
}

/**
 * Sync attachments (normal mode)
 */
async function syncAttachments() {
  if (isAttachmentSyncInProgress) {
    console.log('[ATTACHMENT-SYNC] ⚠️  Sync already in progress, skipping...');
    return;
  }

  isAttachmentSyncInProgress = true;
  const syncStartTime = new Date();

  console.log(`[ATTACHMENT-SYNC] 🚀 Starting sync at ${syncStartTime.toLocaleString('th-TH')}`);

  try {
    // Sync PR Attachments
    console.log('[ATTACHMENT-SYNC] Syncing PR attachments...');
    const prResult = await syncPRAttachments();
    console.log(`[ATTACHMENT-SYNC] ✅ PR: ${prResult.insertCount} inserted, ${prResult.skipCount} skipped`);

    // Sync PO Attachments
    console.log('[ATTACHMENT-SYNC] Syncing PO attachments...');
    const poResult = await syncPOAttachments();
    console.log(`[ATTACHMENT-SYNC] ✅ PO: ${poResult.insertCount} inserted, ${poResult.skipCount} skipped`);

    lastSyncEndTime = new Date();
    const duration = (lastSyncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[ATTACHMENT-SYNC] ✅ Sync completed in ${duration.toFixed(2)}s`);

    return {
      success: true,
      prResult,
      poResult,
      duration,
    };
  } catch (error) {
    console.error('[ATTACHMENT-SYNC] ❌ Sync failed:', error);
    lastSyncEndTime = new Date();
    throw error;
  } finally {
    isAttachmentSyncInProgress = false;
  }
}

/**
 * คำนวณเวลาถัดไปที่ต้องรอจนถึงเที่ยงคืน
 */
function getMillisecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0); // เที่ยงคืนของวันถัดไป
  return midnight.getTime() - now.getTime();
}

/**
 * Initialize Attachment Sync Scheduler
 */
export function initAttachmentSyncScheduler() {
  const INTERVAL_MS = 120 * 60 * 1000; // 120 minutes (2 hours)

  console.log('[ATTACHMENT-SYNC] ✅ Scheduler initialized');

  // Schedule regular sync every 2 hours
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Skip ช่วงเที่ยงคืน (00:00-00:15) เพราะจะมี full refresh
    if (hour === 0 && minute < 15) {
      console.log('[ATTACHMENT-SYNC] ⏸️  Skipping regular sync during midnight refresh window');
      return;
    }

    console.log('[ATTACHMENT-SYNC] ⏰ Scheduled sync triggered');
    try {
      await syncAttachments();
    } catch (error) {
      console.error('[ATTACHMENT-SYNC] Scheduled sync error:', error);
    }
  }, INTERVAL_MS);

  console.log(`[ATTACHMENT-SYNC] 🕐 Regular sync: Every 2 hours`);
  console.log(`[ATTACHMENT-SYNC] Next regular sync: ${new Date(Date.now() + INTERVAL_MS).toLocaleString('th-TH')}`);

  // Schedule midnight full refresh
  const scheduleNextMidnightRefresh = () => {
    const msUntilMidnight = getMillisecondsUntilMidnight();
    const midnightTime = new Date(Date.now() + msUntilMidnight);

    console.log(`[ATTACHMENT-SYNC] 🌙 Midnight full refresh scheduled at: ${midnightTime.toLocaleString('th-TH')}`);

    setTimeout(async () => {
      try {
        await fullRefreshAttachments();
      } catch (error) {
        console.error('[ATTACHMENT-SYNC] Midnight refresh error:', error);
      }

      // Schedule ครั้งต่อไปหลังจากทำเสร็จ
      scheduleNextMidnightRefresh();
    }, msUntilMidnight);
  };

  scheduleNextMidnightRefresh();
}

/**
 * Manual trigger สำหรับ admin
 */
export async function runManualAttachmentSync() {
  return await syncAttachments();
}
