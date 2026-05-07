/**
 * Seed Coupons Script
 * Run this script to add coupon codes to the database
 * 
 * Usage: node scripts/seed-coupons.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Coupon Schema (copied from model for standalone script)
const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    expiryDate: {
      type: Date,
      required: true,
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
      default: null,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);

// Coupon codes to seed
const coupons = [
  {
    code: 'NEWYEAR',
    discountPercentage: 30,
    expiryDate: new Date('2026-01-03T23:59:59.999Z'), // January 3, 2026
    isActive: true,
    showOnUI: true,
    usageCount: 0,
    maxUsage: null, // unlimited
  },
  {
    code: 'SUPER15',
    discountPercentage: 15,
    expiryDate: new Date('2026-02-05T23:59:59.999Z'), // February 5, 2026
    isActive: true,
    showOnUI: true,
    usageCount: 0,
    maxUsage: null, // unlimited
  },
  {
    code: 'VL20',
    discountPercentage: 20,
    expiryDate: new Date('2025-06-27T23:59:59.999Z'), // 6 months from now (June 27, 2025)
    isActive: true,
    showOnUI: true,
    usageCount: 0,
    maxUsage: null, // unlimited
  },
  {
    code: 'EARLYBIRD',
    discountPercentage: 10,
    expiryDate: new Date('2025-06-27T23:59:59.999Z'), // 6 months from now (June 27, 2025)
    isActive: true,
    showOnUI: true,
    usageCount: 0,
    maxUsage: null, // unlimited
  },
  {
    code: 'VLDDTEST',
    discountPercentage: 99,
    expiryDate: new Date('2025-06-27T23:59:59.999Z'), // 6 months from now (June 27, 2025)
    isActive: true,
    showOnUI: false,
    usageCount: 0,
    maxUsage: null, // unlimited
  },
];

async function seedCoupons() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully');

    // Clear existing coupons (optional - comment out if you want to keep existing ones)
    // await Coupon.deleteMany({});
    // console.log('Cleared existing coupons');

    // Insert coupons
    console.log('\nSeeding coupons...');
    
    for (const coupon of coupons) {
      try {
        // Try to update if exists, otherwise create
        const result = await Coupon.findOneAndUpdate(
          { code: coupon.code },
          coupon,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        console.log(`✓ ${coupon.code}: ${coupon.discountPercentage}% off (expires: ${coupon.expiryDate.toLocaleDateString()})`);
      } catch (error) {
        console.error(`✗ Failed to seed ${coupon.code}:`, error.message);
      }
    }

    console.log('\n✅ Coupon seeding completed successfully!');
    console.log('\nCoupon Summary:');
    console.log('- NEWYEAR: 30% discount (expires Jan 3, 2026)');
    console.log('- SUPER15: 15% discount (expires Feb 5, 2026)');
    console.log('- VL20: 20% discount (expires Jun 27, 2025)');
    console.log('- EARLYBIRD: 10% discount (expires Jun 27, 2025)');
    console.log('- VLDDTEST: 99% discount - TEST ONLY (expires Jun 27, 2025)');

    // Verify coupons in database
    const count = await Coupon.countDocuments();
    console.log(`\nTotal coupons in database: ${count}`);

  } catch (error) {
    console.error('Error seeding coupons:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the seed function
seedCoupons();

