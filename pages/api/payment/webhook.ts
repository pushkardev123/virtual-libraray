import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import Payment, { PaymentStatus } from '@/models/Payment';
import { apiResponse, apiError } from '@/utils/response';
import { sendMetaPurchaseEvent } from '@/services/meta-conversions.service';

/**
 * API Handler: Razorpay Webhook
 * POST /api/payment/webhook
 * 
 * This endpoint handles webhooks from Razorpay for tracking
 * stuck payments, failed payments, and other events
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
    // Validate webhook secret
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Razorpay webhook secret not configured');
      return apiError(res, 'Webhook not configured', 500);
    }

    // Get signature from headers
    const receivedSignature = req.headers['x-razorpay-signature'] as string;

    if (!receivedSignature) {
      return apiError(res, 'Missing webhook signature', 400);
    }

    // Verify webhook signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (receivedSignature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return apiError(res, 'Invalid signature', 400);
    }

    // Connect to database
    await connectDB();

    // Process webhook event
    const { event, payload } = req.body;

    switch (event) {
      case 'payment.authorized':
        await handlePaymentAuthorized(payload.payment.entity);
        break;

      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;

      case 'order.paid':
        await handleOrderPaid(payload.order.entity);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return apiResponse(res, 'Webhook processed successfully', { event });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return apiError(res, 'Failed to process webhook', 500);
  }
}

/**
 * Handle payment.authorized event
 */
async function handlePaymentAuthorized(paymentEntity: any) {
  const payment = await Payment.findOne({
    razorpayOrderId: paymentEntity.order_id,
  });

  if (payment) {
    payment.status = PaymentStatus.PENDING;
    payment.razorpayPaymentId = paymentEntity.id;
    await payment.save();
  }
}

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(paymentEntity: any) {
  const payment = await Payment.findOne({
    razorpayOrderId: paymentEntity.order_id,
  });

  if (payment) {
    const wasAlreadyCaptured = payment.status === PaymentStatus.SUCCESS;
    
    payment.status = PaymentStatus.SUCCESS;
    payment.razorpayPaymentId = paymentEntity.id;
    payment.paidAt = new Date(paymentEntity.created_at * 1000);
    await payment.save();

    // Send Meta conversion event only if this is a new capture (to avoid duplicates)
    if (!wasAlreadyCaptured) {
      const nameParts = payment.name.split(' ');
      sendMetaPurchaseEvent({
        email: payment.email,
        phone: payment.phone,
        firstName: nameParts[0] || payment.name,
        lastName: nameParts.slice(1).join(' ') || undefined,
        amount: payment.amount / 100, // Convert paise to rupees
        currency: 'INR',
        orderId: payment.razorpayOrderId,
        paymentId: paymentEntity.id,
      }).catch((error) => {
        console.error('Meta Conversions API failed (non-critical):', error);
      });
    }

    // Note: WhatsApp notification is sent from verify.ts to avoid duplicates
    // Webhook is for backup/reconciliation only
    console.log('✅ Payment captured via webhook:', paymentEntity.id);
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(paymentEntity: any) {
  const payment = await Payment.findOne({
    razorpayOrderId: paymentEntity.order_id,
  });

  if (payment) {
    payment.status = PaymentStatus.FAILED;
    payment.razorpayPaymentId = paymentEntity.id;
    payment.failureReason = paymentEntity.error_description || 'Payment failed';
    await payment.save();
  }
}

/**
 * Handle order.paid event
 */
async function handleOrderPaid(orderEntity: any) {
  const payment = await Payment.findOne({
    razorpayOrderId: orderEntity.id,
  });

  if (payment && payment.status !== PaymentStatus.SUCCESS) {
    payment.status = PaymentStatus.SUCCESS;
    payment.paidAt = new Date();
    await payment.save();

    // Note: WhatsApp notification is sent from verify.ts to avoid duplicates
    // Webhook is for backup/reconciliation only
    console.log('✅ Order paid via webhook:', orderEntity.id);
  }
}

