/**
 * Attachment & Project Sync Scheduler
 * - Sync PR & PO attachments + PR Projects ทุก 2 ชั่วโมง (ใช้ node-cron)
 * - Full refresh (ลบ + ดึงใหม่) ทุกเที่ยงคืน (00:00)
 */

import { syncPRAttachments } from '~/server/api/services/prAttachmentSync';
import { syncPOAttachments } from '~/server/api/services/poAttachmentSync';
import { syncPRProjects } from '~/server/api/services/prProjectSync';
import { db } from '~/server/db';
import cron from 'node-cron';

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
    // ลบ attachments และ project links ทั้งหมด
    console.log('[ATTACHMENT-SYNC] Clearing all attachments and project links...');
    await db.$executeRaw`TRUNCATE TABLE pr_attachments CASCADE`;
    await db.$executeRaw`TRUNCATE TABLE po_attachments CASCADE`;
    await db.$executeRaw`TRUNCATE TABLE pr_project_link CASCADE`;
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
 * Sync attachments and project links (normal mode)
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
    console.log(`[ATTACHMENT-SYNC] ✅ PR Attachments: ${prResult.insertCount} inserted, ${prResult.skipCount} skipped`);

    // Sync PO Attachments
    console.log('[ATTACHMENT-SYNC] Syncing PO attachments...');
    const poResult = await syncPOAttachments();
    console.log(`[ATTACHMENT-SYNC] ✅ PO Attachments: ${poResult.insertCount} inserted, ${poResult.skipCount} skipped`);

    // Sync PR Projects
    console.log('[ATTACHMENT-SYNC] Syncing PR project links...');
    const projectResult = await syncPRProjects();
    console.log(`[ATTACHMENT-SYNC] ✅ PR Projects: ${projectResult.insertCount} inserted, ${projectResult.updateCount} updated, ${projectResult.skipCount} skipped`);

    lastSyncEndTime = new Date();
    const duration = (lastSyncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[ATTACHMENT-SYNC] ✅ Sync completed in ${duration.toFixed(2)}s`);

    return {
      success: true,
      prResult,
      poResult,
      projectResult,
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
 * Initialize Attachment Sync Scheduler
 * Uses node-cron for precise scheduling
 */
export function initAttachmentSyncScheduler() {
  console.log('[ATTACHMENT-SYNC] ✅ Scheduler initialized');

  // Schedule regular sync every 2 hours at :30 (00:30, 02:30, 04:30, etc.)
  // ขยับจาก :00 เป็น :30 เพื่อไม่ให้ชนกับ auto-sync
  cron.schedule('30 */2 * * *', async () => {
    const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    console.log(`[ATTACHMENT-SYNC] ⏰ Scheduled sync triggered at ${currentTime}`);

    try {
      await syncAttachments();
    } catch (error) {
      console.error('[ATTACHMENT-SYNC] Scheduled sync error:', error);
    }
  }, {
    timezone: 'Asia/Bangkok'
  });

  console.log(`[ATTACHMENT-SYNC] 🕐 Regular sync: Every 2 hours at :30 (00:30, 02:30, 04:30, ...)`);

  // Schedule midnight full refresh at 00:00
  cron.schedule('0 0 * * *', async () => {
    const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    console.log(`[ATTACHMENT-SYNC] 🌙 Midnight full refresh triggered at ${currentTime}`);

    try {
      await fullRefreshAttachments();
    } catch (error) {
      console.error('[ATTACHMENT-SYNC] Midnight refresh error:', error);
    }
  }, {
    timezone: 'Asia/Bangkok'
  });

  console.log(`[ATTACHMENT-SYNC] 🌙 Midnight full refresh: Daily at 00:00`);

  // แสดงเวลา sync ครั้งถัดไป
  const now = new Date();
  const nextHour = Math.floor(now.getHours() / 2) * 2;
  const nextSync = new Date(now);
  nextSync.setHours(nextHour, 30, 0, 0);
  if (nextSync <= now) {
    nextSync.setHours(nextSync.getHours() + 2);
  }
  console.log(`[ATTACHMENT-SYNC] Next regular sync: ${nextSync.toLocaleString('th-TH')}`);

  // แสดงเวลา midnight refresh ครั้งถัดไป
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  console.log(`[ATTACHMENT-SYNC] Next midnight refresh: ${nextMidnight.toLocaleString('th-TH')}`);
}

/**
 * Manual trigger สำหรับ admin
 */
export async function runManualAttachmentSync() {
  return await syncAttachments();
}
