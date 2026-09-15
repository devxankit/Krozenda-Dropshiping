const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb, createCustomer } = require('./helpers');
const Coupon = require('../Models/Coupon');
const CouponUserUsage = require('../Models/CouponUserUsage');
const CouponRedemption = require('../Models/CouponRedemption');
const { redeemCoupon } = require('../Controllers/couponController');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('coupon perUserLimit race (regression)', () => {
  it('never lets two concurrent redemptions both succeed past a perUserLimit of 1', async () => {
    const { user } = await createCustomer();
    const coupon = await Coupon.create({
      code: `RACE${Date.now()}`,
      discountType: 'FIXED',
      discountValue: 50,
      perUserLimit: 1,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });

    const cartItems = [{ productId: new mongoose.Types.ObjectId(), price: 500, quantity: 1 }];

    const attempt = () =>
      redeemCoupon({
        code: coupon.code,
        userId: user._id,
        orderId: new mongoose.Types.ObjectId(),
        cartItems,
        cartTotal: 500,
        shippingFee: 0,
        isNewCustomer: true,
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const usage = await CouponUserUsage.findOne({ couponId: coupon._id, userId: user._id });
    expect(usage.count).toBe(1);

    const redemptions = await CouponRedemption.countDocuments({ couponId: coupon._id, userId: user._id, status: 'SUCCESS' });
    expect(redemptions).toBe(1);
  });
});
