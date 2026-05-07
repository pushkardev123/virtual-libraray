import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Coupon Interface
 */
export interface ICoupon extends Document {
  code: string;
  discountPercentage: number;
  expiryDate: Date;
  isActive: boolean;
  showOnUI: boolean;
  usageCount: number;
  maxUsage?: number;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  isValid(): { valid: boolean; message?: string };
  applyDiscount(originalAmount: number): number;
}

/**
 * Coupon Model Interface with static methods
 */
interface ICouponModel extends Model<ICoupon> {
  findAndValidate(code: string): Promise<{
    valid: boolean;
    coupon?: ICoupon;
    message?: string;
  }>;
}

/**
 * Coupon Schema
 */
const CouponSchema = new Schema<ICoupon, ICouponModel>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountPercentage: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    showOnUI: {
      type: Boolean,
      default: false,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUsage: {
      type: Number,
      default: null, // null means unlimited
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Method to check if coupon is valid
 */
CouponSchema.methods.isValid = function(): { valid: boolean; message?: string } {
  if (!this.isActive) {
    return { valid: false, message: 'This coupon is no longer active' };
  }

  if (new Date() > this.expiryDate) {
    return { valid: false, message: 'This coupon has expired' };
  }

  if (this.maxUsage && this.usageCount >= this.maxUsage) {
    return { valid: false, message: 'This coupon has reached its usage limit' };
  }

  return { valid: true };
};

/**
 * Method to apply coupon discount to an amount
 */
CouponSchema.methods.applyDiscount = function(originalAmount: number): number {
  const discountAmount = (originalAmount * this.discountPercentage) / 100;
  return Math.round(originalAmount - discountAmount);
};

/**
 * Static method to find and validate a coupon by code
 */
CouponSchema.statics.findAndValidate = async function(code: string): Promise<{
  valid: boolean;
  coupon?: ICoupon;
  message?: string;
}> {
  const coupon = await this.findOne({ code: code.toUpperCase() });
  
  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  const validation = coupon.isValid();
  
  if (!validation.valid) {
    return { valid: false, message: validation.message };
  }

  return { valid: true, coupon };
};

/**
 * Export Model
 */
const Coupon = (mongoose.models.Coupon as ICouponModel) || mongoose.model<ICoupon, ICouponModel>('Coupon', CouponSchema);

export default Coupon;

