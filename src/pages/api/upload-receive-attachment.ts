import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import path from 'path';
import { db } from '~/server/db';

// Disable default body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Network share path for storing receive good attachments
const UPLOAD_DIR = '\\\\192.168.1.3\\AttachmentPD\\ReciveGood_Warehouse_attach';

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

interface UploadedFile {
  id: number;
  category: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    ensureUploadDir();

    const form = new IncomingForm({
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB max per file
      multiples: true,
    });

    const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Get metadata
    const prDocNum = parseInt(fields.prDocNum?.[0] || fields.prDocNum || '0');
    const batchKey = fields.batchKey?.[0] || fields.batchKey || '';
    const uploadedBy = fields.uploadedBy?.[0] || fields.uploadedBy || 'Unknown';
    const uploadedByUserId = fields.uploadedByUserId?.[0] || fields.uploadedByUserId || null;
    const category = fields.category?.[0] || fields.category || 'document'; // "document" or "photo"

    if (!prDocNum || !batchKey) {
      return res.status(400).json({ error: 'Missing prDocNum or batchKey' });
    }

    // Process uploaded files
    const uploadedFiles: UploadedFile[] = [];
    const fileArray = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];

    for (const file of fileArray as File[]) {
      if (!file || !file.filepath) continue;

      // Generate unique filename
      const ext = path.extname(file.originalFilename || '');
      const baseName = path.basename(file.originalFilename || 'file', ext);
      const timestamp = Date.now();
      const uniqueName = `${prDocNum}_${timestamp}_${baseName}${ext}`;
      const newPath = path.join(UPLOAD_DIR, uniqueName);

      // Move file to final location
      fs.renameSync(file.filepath, newPath);

      // Save to database
      const attachment = await db.warehouse_receive_attachment.create({
        data: {
          pr_doc_num: prDocNum,
          batch_key: batchKey,
          category: category,
          file_name: file.originalFilename || 'unknown',
          file_path: `\\\\192.168.1.3\\AttachmentPD\\ReciveGood_Warehouse_attach\\${uniqueName}`,
          file_size: file.size || 0,
          file_type: file.mimetype || 'application/octet-stream',
          uploaded_by: uploadedBy,
          uploaded_by_user_id: uploadedByUserId,
        },
      });

      uploadedFiles.push({
        id: attachment.id,
        category: attachment.category,
        fileName: attachment.file_name,
        filePath: attachment.file_path,
        fileSize: attachment.file_size,
        fileType: attachment.file_type,
      });
    }

    return res.status(200).json({
      success: true,
      files: uploadedFiles,
      message: `อัพโหลด ${uploadedFiles.length} ไฟล์สำเร็จ`,
    });

  } catch (error) {
    console.error('[Upload API] Error:', error);
    return res.status(500).json({
      error: 'Failed to upload files',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
