import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Upload directory from env, fallback to local ./uploads/AttachmentPD
const UPLOAD_BASE_DIR = process.env.UPLOAD_ATTACHMENT_DIR
  ? path.resolve(process.env.UPLOAD_ATTACHMENT_DIR, 'ReciveGood_Warehouse_attach')
  : path.resolve(process.cwd(), 'uploads', 'AttachmentPD', 'ReciveGood_Warehouse_attach');

/**
 * API Route สำหรับ serve ไฟล์จาก network share
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: 'Missing file path parameter' });
    }

    // Resolve the requested path
    const resolvedPath = path.resolve(filePath);

    // Security: ensure path is within allowed upload directory (prevent path traversal)
    if (!resolvedPath.startsWith(UPLOAD_BASE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fullPath = resolvedPath;

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read file
    const fileBuffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const fileName = path.basename(fullPath);

    // Content-Type mapping
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

    // Inline for PDF and images, attachment for others
    const inlineExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const disposition = inlineExtensions.includes(ext)
      ? `inline; filename="${encodeURIComponent(fileName)}"`
      : `attachment; filename="${encodeURIComponent(fileName)}"`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    return res.status(200).send(fileBuffer);

  } catch (error) {
    console.error('[Serve Attachment API] Error:', error);
    return res.status(500).json({
      error: 'Failed to serve file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
