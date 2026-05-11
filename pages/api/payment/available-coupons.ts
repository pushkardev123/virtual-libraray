import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { apiResponse, apiError } from '@/utils/response';
import { PRICING } from '@/config/constants';

/**
 * API Handler: Get publicly displayable coupons
 * GET /api/payment/available-coupons
 *
 * Security:
 * - Returns ONLY coupons explicitly flagged with `showOnUI: true`
 * - Filters out inactive, expired and exhausted coupons at the DB level
 * - Whitelists the response fields so internal flags (showOnUI, isActive,
 *   usageCount, maxUsage, _id, timestamps, etc.) are never leaked to the client
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return apiError(res, 'Method not allowed', 405);
  }

  try {
    await connectDB();

    const now = new Date();

    // Strict server-side filter — only public, active, non-expired coupons
    const coupons = await Coupon.find(
      {
        showOnUI: true,
        isActive: true,
        expiryDate: { $gt: now },
        $or: [
          { maxUsage: null },
          { $expr: { $lt: ['$usageCount', '$maxUsage'] } },
        ],
      },
      // Projection: only pull the fields we need from the DB
      { code: 1, discountPercentage: 1, expiryDate: 1, _id: 0 }
    )
      .sort({ discountPercentage: -1 })
      .lean();

    const originalAmount = PRICING.MEMBERSHIP_FEE;

    // Whitelist response fields — never return raw documents
    const safeCoupons = coupons.map((c) => {
      const discountAmount = Math.round(
        (originalAmount * c.discountPercentage) / 100
      );
      const discountedAmount = originalAmount - discountAmount;

      return {
        code: c.code,
        discountPercentage: c.discountPercentage,
        discountAmount,
        discountedAmount,
        expiryDate: c.expiryDate,
      };
    });

    // Cache for a short period to reduce DB load on the public landing page
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );

    return apiResponse(res, 'Available coupons fetched', {
      coupons: safeCoupons,
      originalAmount,
    });
  } catch (error: any) {
    console.error('Error fetching available coupons:', error);
    return apiError(res, 'Failed to fetch coupons', 500);
  }
}
