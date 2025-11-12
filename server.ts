/**
 * Custom Server สำหรับเพิ่ม Auto-Sync Scheduler
 *
 * ไฟล์นี้จะ start Next.js server พร้อมกับ auto-sync scheduler
 * ใช้แทนการรัน `npm run dev` หรือ `npm run start`
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initAutoSyncScheduler } from './src/server/auto-sync-scheduler';
import { initAttachmentSyncScheduler } from './src/server/attachment-sync-scheduler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '2025', 10);

// สร้าง Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // เริ่มต้น Auto-Sync Scheduler (PR/PO data - ทุก 2 ชั่วโมง)
  console.log('[SERVER] Initializing auto-sync scheduler...');
  initAutoSyncScheduler();

  // เริ่มต้น Attachment Sync Scheduler (PR/PO attachments - ทุก 2 ชั่วโมง + midnight refresh)
  console.log('[SERVER] Initializing attachment sync scheduler...');
  initAttachmentSyncScheduler();

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
