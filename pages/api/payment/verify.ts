import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import Payment, { PaymentStatus } from '@/models/Payment';
import { apiResponse, apiError } from '@/utils/response';
import { sendPaymentConfirmationWhatsApp } from '@/services/whatsapp.service';
import { sendMetaPurchaseEvent } from '@/services/meta-conversions.service';

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

      // Send WhatsApp confirmation (non-blocking)
      sendPaymentConfirmationWhatsApp({
        name: payment.name,
        email: payment.email,
        phone: payment.phone,
        amount: payment.amount,
        orderId: payment.razorpayOrderId,
        paymentId: razorpay_payment_id,
        isPremium: true,
      }).catch((error) => {
        console.error('WhatsApp notification failed (non-critical):', error);
      });

      // Send Meta Conversions API Purchase event (non-blocking)
      const nameParts = payment.name.split(' ');
      sendMetaPurchaseEvent({
        email: payment.email,
        phone: payment.phone,
        firstName: nameParts[0] || payment.name,
        lastName: nameParts.slice(1).join(' ') || undefined,
        amount: payment.amount / 100, // Convert paise to rupees
        currency: 'INR',
        orderId: payment.razorpayOrderId,
        paymentId: razorpay_payment_id,
        userAgent: req.headers['user-agent'],
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   (req.headers['x-real-ip'] as string) || 
                   req.socket.remoteAddress,
      }).catch((error) => {
        console.error('Meta Conversions API failed (non-critical):', error);
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

      return apiError(res, 'Payment verification failed', 400);
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return apiError(res, 'Failed to verify payment', 500);
  }
}

