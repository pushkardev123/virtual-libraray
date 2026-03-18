/**
 * Forest Rankings Upload API
 * POST /api/forest-rankings/upload
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ForestRankingService } from '@/services/forest-ranking.service';
import { sendSuccess, sendError } from '@/utils/response';
import { HTTP_STATUS } from '@/config/constants';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return sendError(res, `Method ${req.method} not allowed`, HTTP_STATUS.METHOD_NOT_ALLOWED);
  }

  try {
    const { fields, files } = await parseForm(req);

    const dateStr = Array.isArray(fields.date) ? fields.date[0] : fields.date;
    if (!dateStr) {
      return sendError(res, 'Date is required (YYYY-MM-DD format)', HTTP_STATUS.BAD_REQUEST);
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return sendError(res, 'Invalid date format. Use YYYY-MM-DD', HTTP_STATUS.BAD_REQUEST);
    }

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    const file = fileArray[0];
    if (!file) {
      return sendError(res, 'File is required', HTTP_STATUS.BAD_REQUEST);
    }

    // Only XLSX supported for forest rankings
    const fileName = file.originalFilename || 'forest-ranking.xlsx';
    if (!fileName.match(/\.(xlsx|xls)$/i)) {
      return sendError(res, 'Only XLSX/XLS files are supported for Forest Rankings', HTTP_STATUS.BAD_REQUEST);
    }

    const buffer = await fs.readFile(file.filepath);

    const { saved } = await ForestRankingService.uploadRankings(buffer, date, fileName);

    try { await fs.unlink(file.filepath); } catch {}

    return sendSuccess(
      res,
      {
        date: dateStr,
        totalParticipants: saved.length,
        preview: saved.slice(0, 20),
      },
      HTTP_STATUS.CREATED
    );
  } catch (error: any) {
    console.error('Forest ranking upload error:', error);
    return sendError(res, error.message || 'Failed to process file', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

async function parseForm(req: NextApiRequest) {
  const uploadDir = path.join(os.tmpdir(), 'vl-forest-uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true, uploadDir });

  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}
