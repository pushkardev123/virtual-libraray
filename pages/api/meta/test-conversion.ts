import type { NextApiRequest, NextApiResponse } from 'next';
import { apiResponse, apiError } from '@/utils/response';
import { testMetaConversionsAPI } from '@/services/meta-conversions.service';

/**
 * API Handler: Test Meta Conversions API Connection
 * GET /api/meta/test-conversion
 * 
 * This endpoint tests the Meta Conversions API setup
 * Requires admin authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return apiError(res, 'Method not allowed', 405);
  }

  try {
    // Verify admin access (you can adjust this based on your auth setup)
    // const admin = await verifyAdmin(req);
    // if (!admin) {
    //   return apiError(res, 'Unauthorized', 401);
    // }

    // Test the Meta Conversions API
    const result = await testMetaConversionsAPI();

    if (result.success) {
      return apiResponse(res, result.message, {
        status: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      return apiError(res, result.message, 500);
    }
  } catch (error: any) {
    console.error('Error testing Meta Conversions API:', error);
    return apiError(res, 'Failed to test Meta Conversions API', 500);
  }
}
