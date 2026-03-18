/**
 * Forest Rankings List API
 * GET /api/forest-rankings/list?limit=30
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
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    const dates = await ForestRankingService.listDates(limit);
    return sendSuccess(res, dates);
  } catch (error: any) {
    console.error('Forest rankings list error:', error);
    return sendError(res, error.message || 'Failed to fetch dates', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
