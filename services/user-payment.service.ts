/**
 * User Payment Service
 * Handles user creation/update when payments are made
 */

import { User } from '@/models';
import { UserStatus, RegistrationSource } from '@/types';
import mongoose from 'mongoose';

interface PaymentUserData {
  email: string;
  name: string;
  phone: string;
  examType?: string;
  isPaymentSuccessful: boolean;
  paymentId?: string | mongoose.Types.ObjectId; // Payment record ID to link
}

/**
 * Create or update user based on payment
 * - If user doesn't exist: create new user
 * - If user exists: update premium status only
 * - Email is unique constraint
 */
export async function createOrUpdateUserFromPayment(
  paymentData: PaymentUserData
): Promise<void> {
  try {
    const { email, name, phone, examType, isPaymentSuccessful, paymentId } = paymentData;

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists by email
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // User doesn't exist - create new user
      console.log(`Creating new user from payment: ${normalizedEmail}`);

      const premiumExpiresAt = isPaymentSuccessful
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        : undefined;

      // Convert paymentId to ObjectId if it's a string
      const paymentObjectId = paymentId 
        ? (typeof paymentId === 'string' ? new mongoose.Types.ObjectId(paymentId) : paymentId)
        : undefined;

      user = await User.create({
        email: normalizedEmail,
        name: name || 'User',
        phone: phone || undefined,
        emailVerified: true, // Auto-verify since they made a payment
        emailVerifiedAt: new Date(),
        phoneVerified: false,
        status: UserStatus.ACTIVE,
        registrationSource: RegistrationSource.WEB,
        role: 'user',
        examType: examType || undefined,
        isPremium: isPaymentSuccessful,
        premiumExpiresAt: premiumExpiresAt,
        paymentIds: paymentObjectId ? [paymentObjectId] : [], // Link payment to user
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        loginCount: 0,
        isBlocked: false,
      });

      console.log(
        `✅ User created from payment: ${user.email} | Premium: ${user.isPremium} | Payment linked: ${!!paymentId}`
      );
    } else {
      // User exists - update premium status if payment successful
      console.log(`Updating existing user from payment: ${normalizedEmail}`);

      let updated = false;

      if (isPaymentSuccessful) {
        // Update premium status
        user.isPremium = true;
        user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        updated = true;
      }

      // Update phone if not set
      if (phone && !user.phone) {
        user.phone = phone;
        updated = true;
      }

      // Update exam type if not set
      if (examType && !user.examType) {
        user.examType = examType as 'neet-pg' | 'other-exams';
        updated = true;
      }

      // Update name if better quality (longer)
      if (name && name.length > (user.name?.length || 0)) {
        user.name = name;
        updated = true;
      }

      // Link payment ID to user if provided and not already linked
      if (paymentId) {
        const paymentObjectId = typeof paymentId === 'string' 
          ? new mongoose.Types.ObjectId(paymentId) 
          : paymentId;
        
        const isAlreadyLinked = user.paymentIds?.some(
          (id) => id.toString() === paymentObjectId.toString()
        );

        if (!isAlreadyLinked) {
          user.paymentIds = user.paymentIds || [];
          user.paymentIds.push(paymentObjectId);
          updated = true;
        }
      }

      if (updated) {
        await user.save();
        console.log(
          `✅ User updated from payment: ${user.email} | Premium: ${user.isPremium} | Payments: ${user.paymentIds?.length || 0}`
        );
      } else {
        console.log(`ℹ️  No updates needed for user: ${user.email}`);
      }
    }
  } catch (error: any) {
    console.error('Error creating/updating user from payment:', error);
    // Don't throw - we don't want payment verification to fail if user creation fails
    // The payment should still be processed successfully
  }
}

