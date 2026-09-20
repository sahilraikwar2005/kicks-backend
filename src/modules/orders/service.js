import Order from './model.js';
import Cart from '../cart/model.js';
import Product from '../products/model.js';
import { couponService } from '../coupons/service.js';
import Address from '../addresses/model.js';
import User from '../users/model.js';

const allowedTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const assertValidOrderTransition = (currentStatus, nextStatus) => {
  if (!Object.prototype.hasOwnProperty.call(allowedTransitions, currentStatus)) {
    const error = new Error(`Unsupported order status: ${currentStatus}`);
    error.statusCode = 409;
    throw error;
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    const error = new Error(`Invalid order transition from ${currentStatus} to ${nextStatus}`);
    error.statusCode = 409;
    throw error;
  }
};

export const orderService = {
  async createOrderFromCart(userId, payload = {}) {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      const error = new Error('Cart is empty');
      error.statusCode = 400;
      throw error;
    }

    const address = await Address.findOne({ _id: payload.addressId, user: userId }).lean();
    if (!address) { const error = new Error('A valid shipping address is required'); error.statusCode = 400; throw error; }
    const customer = await User.findById(userId).select('firstName lastName email phone').lean();
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = productMap.get(String(item.productId));
      if (!product || product.status !== 'PUBLISHED') {
        const error = new Error('Product no longer exists');
        error.statusCode = 400;
        throw error;
      }

      const variant = product.variants.find((entry) => String(entry._id) === String(item.variantId));
      if (!variant) {
        const error = new Error('Variant no longer exists');
        error.statusCode = 400;
        throw error;
      }

      if (variant.stock < item.quantity) {
        const error = new Error('Insufficient stock');
        error.statusCode = 400;
        throw error;
      }

      const itemTotal = (variant.salePrice ?? variant.price) * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        unitPrice: variant.salePrice ?? variant.price,
        discount: 0,
        finalPrice: itemTotal,
      });
    }

    let discountAmount = 0;
    if (payload.couponCode) {
      const { coupon, discount } = await couponService.validateCoupon(payload.couponCode, userId, subtotal);
      if (coupon.firstOrderOnly && await Order.exists({ user: userId, paymentStatus: 'PAID' })) { const error = new Error('Coupon is valid only for a first order'); error.statusCode = 400; throw error; }
      if (coupon.productRestrictions?.length && !orderItems.some((item) => coupon.productRestrictions.some((id) => String(id) === String(item.productId)))) { const error = new Error('Coupon does not apply to these products'); error.statusCode = 400; throw error; }
      discountAmount = discount;
    }

    const shippingCharge = 0;
    const tax = 0;
    const grandTotal = Math.max(subtotal - discountAmount + shippingCharge + tax, 0);

    const order = await Order.create({
      user: userId,
      orderNumber: `KICKS-${Date.now()}`,
      items: orderItems,
      shippingAddress: { ...address, _id: undefined },
      customerSnapshot: customer,
      subtotal,
      discountAmount,
      shippingCharge,
      tax,
      grandTotal,
      paymentStatus: 'PENDING',
      couponCode: payload.couponCode || '',
    });

    return order;
  },

  async listForUser(userId) {
    return Order.find({ user: userId }).sort({ createdAt: -1 });
  },

  async getById(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }
    return order;
  },

  async listAdmin() {
    return Order.find().sort({ createdAt: -1 });
  },

  async updateStatus(orderId, status) {
    const current = await Order.findById(orderId);
    if (!current) { const error = new Error('Order not found'); error.statusCode = 404; throw error; }
    if (current.status === 'CANCELLED' || current.status === 'REFUNDED' || current.status === 'DELIVERED') {
      const error = new Error(`Invalid order transition from ${current.status} to ${status}`);
      error.statusCode = 409;
      throw error;
    }

    if (status !== 'CANCELLED') {
      assertValidOrderTransition(current.status, status);
    } else if (current.status !== 'PENDING' && current.status !== 'CONFIRMED') {
      const error = new Error(`Invalid order transition from ${current.status} to ${status}`);
      error.statusCode = 409;
      throw error;
    }

    if (status === 'CANCELLED' && current.paymentStatus === 'PAID') {
      const error = new Error('Paid orders cannot be cancelled by status transition');
      error.statusCode = 409;
      throw error;
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: current.status },
      { $set: { status } },
      { new: true, runValidators: true },
    );

    if (!order) {
      const error = new Error(`Invalid order transition from ${current.status} to ${status}`);
      error.statusCode = 409;
      throw error;
    }

    return order;
  },

  async cancelByCustomer(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) { const error = new Error('Order not found'); error.statusCode = 404; throw error; }
    if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') { const error = new Error('Only unpaid pending orders can be cancelled by the customer'); error.statusCode = 409; throw error; }
    order.status = 'CANCELLED';
    await order.save();
    return order;
  },
};
