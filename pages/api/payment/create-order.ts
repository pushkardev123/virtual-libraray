import type { NextApiRequest, NextApiResponse } from 'next';
import Razorpay from 'razorpay';
import connectDB from '@/lib/mongodb';
import Payment, { PaymentStatus } from '@/models/Payment';
import Coupon from '@/models/Coupon';
import { apiResponse, apiError } from '@/utils/response';

/**
 * API Handler: Create Razorpay Order
 * POST /api/payment/create-order
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
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials not configured');
      return apiError(res, 'Payment gateway not configured', 500);
    }

    // Extract and validate request body
    const { name, email, phone, amount, examType, couponCode } = req.body;

    // Validation
    if (!name || !email || !phone) {
      return apiError(res, 'Name, email, and phone are required', 400);
    }

    if (!amount || amount <= 0) {
      return apiError(res, 'Valid amount is required', 400);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError(res, 'Invalid email address', 400);
    }

    // Phone validation (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return apiError(res, 'Invalid phone number. Must be 10 digits', 400);
    }

    // Connect to database
    await connectDB();

    // Handle coupon code if provided
    let finalAmount = amount;
    let couponData: any = {};
    
    if (couponCode) {
      const couponResult = await Coupon.findAndValidate(couponCode);
      
      if (!couponResult.valid) {
        return apiError(res, couponResult.message || 'Invalid coupon code', 400);
      }
      
      const coupon = couponResult.coupon!;
      const originalAmount = amount;
      finalAmount = coupon.applyDiscount(amount);
      const discountAmount = originalAmount - finalAmount;
      
      couponData = {
        couponCode: coupon.code,
        discountPercentage: coupon.discountPercentage,
        discountAmount: discountAmount * 100, // Store in paise
        originalAmount: originalAmount * 100, // Store in paise
      };
      
      // Increment coupon usage count
      coupon.usageCount += 1;
      await coupon.save();
    }

    // Initialize Razorpay instance
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Create Razorpay order
    const options = {
      amount: finalAmount * 100, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        name,
        email,
        phone,
        examType: examType || 'general',
        ...(couponCode && { couponCode }),
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Create payment record in database
    const payment = new Payment({
      name,
      email,
      phone,
      razorpayOrderId: razorpayOrder.id,
      amount: finalAmount * 100, // Store in paise
      currency: 'INR',
      status: PaymentStatus.CREATED,
      examType,
      ...couponData,
      metadata: {
        receipt: razorpayOrder.receipt,
      },
    });
    await payment.save();

    // Return order details to frontend
    return apiResponse(res, 'Order created successfully', {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: keyId,
      name,
      email,
      phone,
      paymentRecordId: payment._id,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    
    // Handle Razorpay specific errors
    if (error.error?.description) {
      return apiError(res, error.error.description, 400);
    }
    
    return apiError(res, 'Failed to create payment order', 500);
  }
}

