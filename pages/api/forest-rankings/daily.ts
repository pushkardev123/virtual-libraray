/**
 * Forest Rankings Daily API
 * GET /api/forest-rankings/daily?date=YYYY-MM-DD
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ForestRankingService } from '@/services/forest-ranking.service';
import { sendSuccess, sendError } from '@/utils/response';
import { HTTP_STATUS } from '@/config/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return sendError(res, `Method ${req.method} not allowed`, HTTP_STATUS.METHOD_NOT_ALLOWED);
  }

  try {
    const { date: dateStr } = req.query;
    if (!dateStr || typeof dateStr !== 'string') {
      return sendError(res, 'date query parameter is required (YYYY-MM-DD)', HTTP_STATUS.BAD_REQUEST);
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return sendError(res, 'Invalid date format. Use YYYY-MM-DD', HTTP_STATUS.BAD_REQUEST);
    }

    const record = await ForestRankingService.getRankingsByDate(date);
    if (!record) {
      return sendError(res, 'No forest rankings found for this date', HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, {
      date: record.date.toISOString().split('T')[0],
      rankings: record.rankings,
      totalParticipants: record.totalParticipants,
      uploadedAt: record.uploadedAt,
    });
  } catch (error: any) {
    console.error('Forest rankings daily error:', error);
    return sendError(res, error.message || 'Failed to fetch rankings', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
