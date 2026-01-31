/**
 * Custom Server สำหรับเพิ่ม Auto-Sync Scheduler
 *
 * ไฟล์นี้จะ start Next.js server พร้อมกับ auto-sync scheduler
 * ใช้แทนการรัน `npm run dev` หรือ `npm run start`
 */

// Load environment variables from .env file
import 'dotenv/config';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import { initAutoSyncScheduler } from './src/server/auto-sync-scheduler';
import { initAttachmentSyncScheduler } from './src/server/attachment-sync-scheduler';
import { initDelayedPRNotificationScheduler } from './src/server/delayed-pr-notification-scheduler';

const execAsync = promisify(exec);

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '2025', 10);

/**
 * Mount network share อัตโนมัติ (ถ้ามีการตั้งค่าใน .env)
 * ใช้เพื่อให้ Node.js process สามารถเข้าถึง network share ได้
 */
async function mountNetworkShare() {
  const sharePath = process.env.NETWORK_SHARE_PATH;
  const shareUser = process.env.NETWORK_SHARE_USER;
  const sharePassword = process.env.NETWORK_SHARE_PASSWORD;
  const shareDomain = process.env.NETWORK_SHARE_DOMAIN;

  if (!sharePath || !shareUser || !sharePassword) {
    console.log('[NETWORK] No network share credentials configured - skipping auto-mount');
    return;
  }

  try {
    // สร้าง command สำหรับ mount network share
    const username = shareDomain ? `${shareDomain}\\${shareUser}` : shareUser;
    // ไม่ใส่ quotes รอบ path และแยก persistent เป็นคำสั่งต่างหาก
    const command = `net use ${sharePath} /user:${username} ${sharePassword} /persistent:yes`;

    console.log('[NETWORK] Mounting network share:', sharePath);
    console.log('[NETWORK] User:', username);

    // รัน command (ซ่อน password ใน log)
    await execAsync(command);

    console.log('[NETWORK] ✅ Network share mounted successfully');
  } catch (error) {
    // ถ้า error เป็น "Multiple connections..." แปลว่า mount อยู่แล้ว
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Multiple connections') || errorMessage.includes('already')) {
      console.log('[NETWORK] ✅ Network share already mounted');
    } else {
      console.error('[NETWORK] ⚠️  Failed to mount network share:', errorMessage);
      console.log('[NETWORK] Continuing anyway - manual mount may be required');
    }
  }
}

// สร้าง Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Mount network share ก่อน start server
mountNetworkShare().then(() => {
  return app.prepare();
}).then(() => {
  // เริ่มต้น Auto-Sync Scheduler (PR/PO data - ทุก 2 ชั่วโมง)
  console.log('[SERVER] Initializing auto-sync scheduler...');
  initAutoSyncScheduler();

  // เริ่มต้น Attachment Sync Scheduler (PR/PO attachments - ทุก 2 ชั่วโมง + midnight refresh)
  console.log('[SERVER] Initializing attachment sync scheduler...');
  initAttachmentSyncScheduler();

  // เริ่มต้น Delayed PR Notification Scheduler (ส่งแจ้งเตือน PR ที่ล่าช้า - ทุกวันตอน 02:00)
  // TODO: Enable this when ready to use
  // console.log('[SERVER] Initializing delayed PR notification scheduler...');
  // initDelayedPRNotificationScheduler();

  // สร้าง HTTP server
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
