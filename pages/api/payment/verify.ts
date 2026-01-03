import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import Payment, { PaymentStatus } from '@/models/Payment';
import { apiResponse, apiError } from '@/utils/response';
import { createOrUpdateUserFromPayment } from '@/services/user-payment.service';

/**
 * API Handler: Verify Razorpay Payment
 * POST /api/payment/verify
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
    // Validate environment variables
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error('Razorpay secret not configured');
      return apiError(res, 'Payment gateway not configured', 500);
    }

    // Extract payment details from request
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return apiError(res, 'Missing payment verification details', 400);
    }

    // Connect to database
    await connectDB();

    // Find payment record
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });

    if (!payment) {
      return apiError(res, 'Payment record not found', 404);
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    if (isValid) {
      // Update payment record as successful
      payment.status = PaymentStatus.SUCCESS;
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.paidAt = new Date();
      await payment.save();

      // Create or update user based on successful payment
      await createOrUpdateUserFromPayment({
        email: payment.email,
        name: payment.name,
        phone: payment.phone,
        examType: payment.examType,
        isPaymentSuccessful: true,
        paymentId: payment._id, // Link payment to user
      });

      return apiResponse(res, 'Payment verified successfully', {
        status: 'success',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        userDetails: {
          name: payment.name,
          email: payment.email,
          phone: payment.phone,
        },
      });
    } else {
      // Update payment record as failed
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Signature verification failed';
      await payment.save();

      // Create or update user even for failed payment (but not premium)
      await createOrUpdateUserFromPayment({
        email: payment.email,
        name: payment.name,
        phone: payment.phone,
        examType: payment.examType,
        isPaymentSuccessful: false,
        paymentId: payment._id, // Link payment to user
      });

      return apiError(res, 'Payment verification failed', 400);
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return apiError(res, 'Failed to verify payment', 500);
  }
}

