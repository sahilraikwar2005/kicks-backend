import Coupon from './model.js';
import CouponRedemption from './redemption.model.js';
import CouponUserUsage from './userUsage.model.js';

const couponError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const calculateDiscount = (coupon, cartTotal) => {
  let discount = coupon.type === 'PERCENTAGE' ? (cartTotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount;
  }
  return Math.min(discount, cartTotal);
};

const incrementUserUsage = async (coupon, userId) => {
  if (!coupon.perUserLimit || !userId) return null;

  try {
    return await CouponUserUsage.findOneAndUpdate(
      { coupon: coupon._id, user: userId, count: { $lt: coupon.perUserLimit } },
      { $inc: { count: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code === 11000) {
      throw couponError('Coupon already used by this user');
    }
    throw error;
  }
};

const rollbackUserUsage = (coupon, userId) => {
  if (!coupon.perUserLimit || !userId) return Promise.resolve();
  return CouponUserUsage.updateOne(
    { coupon: coupon._id, user: userId, count: { $gt: 0 } },
    { $inc: { count: -1 } },
  );
};

export const couponService = {
  async validateCoupon(code, userId, cartTotal) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    if (!coupon) {
      throw couponError('Coupon not found', 404);
    }

    if (coupon.expiryDate < new Date()) {
      throw couponError('Coupon expired');
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw couponError('Coupon usage limit reached');
    }

    if (coupon.minCartValue && cartTotal < coupon.minCartValue) {
      throw couponError('Cart total is below minimum order value');
    }

    if (coupon.perUserLimit && userId) {
      const durableUsage = await CouponUserUsage.findOne({ coupon: coupon._id, user: userId }).lean();
      const usedCount = durableUsage?.count ?? (coupon.userUsage || []).filter((id) => String(id) === String(userId)).length;
      if (usedCount >= coupon.perUserLimit) {
        throw couponError('Coupon already used by this user');
      }
    }

    return { coupon, discount: calculateDiscount(coupon, cartTotal) };
  },

  async create(payload) {
    return Coupon.create(payload);
  },

  async consumeForPaidOrder(order) {
    if (!order?.couponCode) return { consumed: false, reason: 'NO_COUPON' };

    const code = order.couponCode.toUpperCase();
    const coupon = await Coupon.findOne({ code, active: true });
    if (!coupon) throw couponError('Coupon not found');
    if (coupon.expiryDate < new Date()) throw couponError('Coupon expired');
    if (coupon.minCartValue && order.subtotal < coupon.minCartValue) throw couponError('Cart total is below minimum order value');

    const discount = calculateDiscount(coupon, order.subtotal);
    let redemption;
    try {
      redemption = await CouponRedemption.create({
        coupon: coupon._id,
        code,
        user: order.user,
        order: order._id,
        discount,
        status: 'PENDING',
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      redemption = await CouponRedemption.findOne({ coupon: coupon._id, order: order._id });
      if (redemption?.status === 'REDEEMED') {
        return { consumed: false, duplicate: true, redemption };
      }
    }

    const claimed = await CouponRedemption.findOneAndUpdate(
      { _id: redemption._id, status: { $in: ['PENDING', 'FAILED'] } },
      { $set: { status: 'PROCESSING', metadata: { orderNumber: order.orderNumber } } },
      { new: true },
    );

    if (!claimed) {
      const current = await CouponRedemption.findById(redemption._id);
      return { consumed: false, duplicate: true, redemption: current };
    }

    const couponFilter = { _id: coupon._id, active: true, expiryDate: { $gte: new Date() } };
    if (coupon.usageLimit) {
      couponFilter.usedCount = { $lt: coupon.usageLimit };
    }

    const incrementedCoupon = await Coupon.findOneAndUpdate(
      couponFilter,
      { $inc: { usedCount: 1 } },
      { new: true },
    );

    if (!incrementedCoupon) {
      await CouponRedemption.updateOne({ _id: claimed._id }, { $set: { status: 'FAILED', metadata: { reason: 'GLOBAL_LIMIT' } } });
      throw couponError('Coupon usage limit reached');
    }

    try {
      await incrementUserUsage(coupon, order.user);
    } catch (error) {
      await Coupon.updateOne({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
      await CouponRedemption.updateOne({ _id: claimed._id }, { $set: { status: 'FAILED', metadata: { reason: 'USER_LIMIT' } } });
      throw error;
    }

    try {
      await Coupon.updateOne({ _id: coupon._id }, { $push: { userUsage: order.user } });
      const redeemed = await CouponRedemption.findByIdAndUpdate(
        claimed._id,
        { $set: { status: 'REDEEMED', redeemedAt: new Date(), discount } },
        { new: true },
      );
      return { consumed: true, redemption: redeemed };
    } catch (error) {
      await Coupon.updateOne({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
      await rollbackUserUsage(coupon, order.user);
      await CouponRedemption.updateOne({ _id: claimed._id }, { $set: { status: 'FAILED', metadata: { reason: 'LOCAL_FAILURE', error: error.message } } });
      throw error;
    }
  },

  async releaseForOrder(order) {
    if (!order?.couponCode) return { released: false, reason: 'NO_COUPON' };
    const redemption = await CouponRedemption.findOneAndUpdate(
      { order: order._id, status: 'REDEEMED' },
      { $set: { status: 'RELEASED', releasedAt: new Date() } },
      { new: true },
    ).populate('coupon');

    if (!redemption) return { released: false, reason: 'NO_REDEMPTION' };
    await Coupon.updateOne({ _id: redemption.coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    await rollbackUserUsage(redemption.coupon, order.user);
    return { released: true, redemption };
  },
};
