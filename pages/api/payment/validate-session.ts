import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import Payment, { PaymentStatus } from '@/models/Payment';
import { apiResponse, apiError } from '@/utils/response';

/**
 * API Handler: Validate Payment Session Token
 * POST /api/payment/validate-session
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return apiError(res, 'Method not allowed', 405);
  }

  try {
    const { token } = req.body;

    if (!token) {
      return apiError(res, 'Token is required', 400);
    }

    // Connect to database
    await connectDB();

    // Find payment record by token (razorpayPaymentId)
    // Token should be recent (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const payment = await Payment.findOne({
      razorpayPaymentId: token,
      updatedAt: { $gte: tenMinutesAgo }
    });

    if (!payment) {
      return apiError(res, 'Invalid or expired session', 401);
    }

    // Return user details and payment info based on payment status
    return apiResponse(res, 'Session validated', {
      valid: true,
      status: payment.status,
      userDetails: {
        name: payment.name,
        email: payment.email,
        phone: payment.phone,
      },
      paymentDetails: {
        amount: payment?.amount || 0,
        currency: payment?.currency || 'INR',
        examType: payment?.examType || 'NEET-PG',
      },
    });
  } catch (error: any) {
    console.error('Error validating session:', error);
    return apiError(res, 'Failed to validate session', 500);
  }
}

