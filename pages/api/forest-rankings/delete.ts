/**
 * Forest Rankings Delete API
 * DELETE /api/forest-rankings/delete?date=YYYY-MM-DD
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ForestRankingService } from '@/services/forest-ranking.service';
import { sendSuccess, sendError } from '@/utils/response';
import { HTTP_STATUS } from '@/config/constants';
import { verifyAuth } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return sendError(res, `Method ${req.method} not allowed`, HTTP_STATUS.METHOD_NOT_ALLOWED);
  }

  // Admin-only
  if (!verifyAuth(req)) {
    return sendError(res, 'Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  try {
    const { date: dateStr } = req.query;
    if (!dateStr || typeof dateStr !== 'string') {
      return sendError(res, 'date query parameter is required', HTTP_STATUS.BAD_REQUEST);
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return sendError(res, 'Invalid date format. Use YYYY-MM-DD', HTTP_STATUS.BAD_REQUEST);
    }

    const deleted = await ForestRankingService.deleteByDate(date);
    if (!deleted) {
      return sendError(res, 'No forest rankings found for this date', HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, { message: 'Forest rankings deleted successfully', date: dateStr });
  } catch (error: any) {
    console.error('Forest rankings delete error:', error);
    return sendError(res, error.message || 'Failed to delete rankings', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
