/**
 * Script to trigger all syncs immediately
 * Usage: npx tsx scripts/trigger-all-sync.ts
 */

import 'dotenv/config';
import { runFullAutoSync } from '../src/server/auto-sync-scheduler';
import { runManualAttachmentSync } from '../src/server/attachment-sync-scheduler';

async function main() {
  console.log('========================================');
  console.log('  TRIGGER ALL SYNC - Manual Execution');
  console.log('========================================');
  console.log('Start time:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
  console.log('');

  try {
    // 1. PR & PO Sync
    console.log('[1/2] Starting PR & PO Full Sync...');
    const prpoResult = await runFullAutoSync();
    console.log('[1/2] PR & PO Sync completed:', prpoResult);
    console.log('');

    // 2. Attachment Sync
    console.log('[2/2] Starting Attachment Sync...');
    const attachResult = await runManualAttachmentSync();
    console.log('[2/2] Attachment Sync completed:', attachResult);
    console.log('');

    console.log('========================================');
    console.log('  ALL SYNCS COMPLETED SUCCESSFULLY');
    console.log('========================================');
    console.log('End time:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));

  } catch (error) {
    console.error('========================================');
    console.error('  SYNC FAILED');
    console.error('========================================');
    console.error('Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
