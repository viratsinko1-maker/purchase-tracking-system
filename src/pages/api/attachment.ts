import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

/**
 * API Route สำหรับ serve ไฟล์จาก network share
 *
 * รับ query parameter:
 * - path: file path ในรูปแบบ file://10.1.1.199/... หรือ //10.1.1.199/...
 *
 * ตัวอย่าง:
 * /api/attachment?path=file://10.1.1.199/b1_shr/TMK/Attachments/document.pdf
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ตรวจสอบ method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: 'Missing file path parameter' });
    }

    // แปลง file:// URL เป็น UNC path
    let uncPath = filePath;

    // แปลง file://10.1.1.199/... เป็น \\10.1.1.199\...
    if (uncPath.startsWith('file://')) {
      uncPath = uncPath.replace('file://', '\\\\').replace(/\//g, '\\');
    }
    // แปลง //10.1.1.199/... เป็น \\10.1.1.199\...
    else if (uncPath.startsWith('//')) {
      uncPath = uncPath.replace('//', '\\\\').replace(/\//g, '\\');
    }

    // Debug logging
    console.log('[Attachment API] Original path:', filePath);
    console.log('[Attachment API] UNC path:', uncPath);
    console.log('[Attachment API] Process user:', process.env.USERNAME || 'unknown');
    console.log('[Attachment API] Node version:', process.version);
    console.log('[Attachment API] Platform:', process.platform);

    // ตรวจสอบว่าไฟล์มีอยู่จริง
    if (!fs.existsSync(uncPath)) {
      console.error('[Attachment API] File not found:', uncPath);

      // ลองตรวจสอบ parent directory
      const parentDir = path.dirname(uncPath);
      const parentExists = fs.existsSync(parentDir);
      console.log('[Attachment API] Parent directory exists:', parentExists);

      if (parentExists) {
        try {
          const files = fs.readdirSync(parentDir);
          console.log('[Attachment API] Files in parent directory:', files.length);
        } catch (dirError) {
          console.error('[Attachment API] Cannot read parent directory:', dirError);
        }
      }

      return res.status(404).json({
        error: 'File not found',
        path: uncPath,
        parentExists,
        originalPath: filePath,
        debug: {
          user: process.env.USERNAME || 'unknown',
          platform: process.platform,
        }
      });
    }

    // อ่านไฟล์
    const fileBuffer = fs.readFileSync(uncPath);
    const ext = path.extname(uncPath).toLowerCase();
    const fileName = path.basename(uncPath);

    // กำหนด Content-Type ตาม extension
    const contentTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // กำหนด Content-Disposition
    // PDF และรูปภาพ -> inline (เปิดในเบราว์เซอร์)
    // อื่นๆ (xlsx, doc, zip, etc) -> attachment (ดาวน์โหลด)
    const inlineExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const disposition = inlineExtensions.includes(ext)
      ? `inline; filename="${encodeURIComponent(fileName)}"`
      : `attachment; filename="${encodeURIComponent(fileName)}"`;

    // ส่งไฟล์กลับ
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 ชั่วโมง

    return res.status(200).send(fileBuffer);

  } catch (error) {
    console.error('[Attachment API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log detailed error information
    console.error('[Attachment API] Error details:', {
      message: errorMessage,
      code: errorCode,
      stack: errorStack,
    });

    return res.status(500).json({
      error: 'Failed to serve file',
      message: errorMessage,
      code: errorCode,
      debug: {
        user: process.env.USERNAME || 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      }
    });
  }
}
