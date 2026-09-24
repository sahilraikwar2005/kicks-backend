import Order from './model.js';
import Cart from '../cart/model.js';
import Product from '../products/model.js';
import Address from '../addresses/model.js';
import User from '../users/model.js';
import { canonicalState, isIndianPincodeFormat } from '../addresses/indiaLocations.js';
import { adminSettingsService } from '../admin/settings.service.js';
import {
  sendOrderConfirmationEmail,
  sendOrderCancelledEmail,
  sendShippedEmail,
  sendOutForDeliveryEmail,
  sendDeliveryEmail,
} from '../../services/email.service.js';

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

export const assertValidOrderTransition = (currentStatus, nextStatus) => {
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

// Re-validate the shipping address at order time. Frontend checks are not
// sufficient: malformed data must never reach order creation.
const assertOrderAddress = (address) => {
  const fail = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  };
  if (!address) fail('A valid shipping address is required');
  for (const field of ['firstName', 'lastName', 'phone', 'addressLine1', 'city', 'state', 'postalCode']) {
    if (!String(address[field] || '').trim()) fail(`Shipping address ${field} is required`);
  }
  const digits = String(address.phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) fail('Shipping address phone is invalid');
  if (!isIndianPincodeFormat(address.postalCode)) fail('Shipping address PIN code is invalid');
  if (!canonicalState(address.state)) fail('Shipping address state is invalid');
};

// Order-item image snapshot helper. Mirrors the storefront gallery priority
// (variant.images → product.colorImages[color] → product.images[]) so the
// Order Details page shows the exact image that was purchased.
const firstImage = (value) => {
  if (Array.isArray(value)) {
    return value.find((url) => typeof url === 'string' && url.trim())?.trim() || '';
  }
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

const colorImage = (product, color) => {
  const source = product?.colorImages;
  const wanted = String(color || '').trim().toLowerCase();
  if (!source || !wanted) return '';
  if (typeof source.get === 'function') {
    const direct = firstImage(source.get(color));
    if (direct) return direct;
    if (typeof source.entries === 'function') {
      for (const [name, urls] of source.entries()) {
        if (String(name || '').trim().toLowerCase() === wanted) return firstImage(urls);
      }
    }
  } else if (typeof source === 'object') {
    for (const [name, urls] of Object.entries(source)) {
      if (String(name || '').trim().toLowerCase() === wanted) return firstImage(urls);
    }
  }
  return '';
};

const resolveItemImage = (product, variant) =>
  firstImage(variant?.images) || colorImage(product, variant?.color) || firstImage(product?.images) || '';

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
    assertOrderAddress(address);
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
        image: resolveItemImage(product, variant),
      });
    }

    const discountAmount = 0;
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
    });

    try {
      const recipient = customer?.email ? customer : await User.findById(userId).select('firstName lastName email');
      if (recipient?.email && (await adminSettingsService.isEmailEnabled('order'))) {
        await sendOrderConfirmationEmail(recipient, order);
      }
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to send order confirmation email:', error.message);
      }
    }

    return order;
  },

  async listForUser(userId) {
    return Order.find({ user: userId }).sort({ createdAt: -1 });
  },

  async getById(userId, orderId) {
    // Legacy orders have no image snapshot on their items, so expose the
    // product gallery as a fallback for the Order Details page.
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.productId', 'name images colorImages variants');
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }
    return order;
  },

  async listAdmin(filters = {}) {
    const page = Math.max(Number(filters.page || 1), 1);
    const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const query = {};
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (filters.status && validStatuses.includes(String(filters.status).toUpperCase())) {
      query.status = String(filters.status).toUpperCase();
    }
    if (filters.search && String(filters.search).trim()) {
      const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = { $regex: term, $options: 'i' };
      query.$or = [{ orderNumber: pattern }, { 'customerSnapshot.email': pattern }, { 'customerSnapshot.phone': pattern }];
    }
    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);
    return { orders, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
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

    try {
      const customer = order.customerSnapshot?.email ? order.customerSnapshot : await User.findById(order.user).select('firstName lastName email');
      if (customer?.email) {
        if (status === 'CANCELLED' && (await adminSettingsService.isEmailEnabled('order'))) {
          await sendOrderCancelledEmail(customer, order);
        } else if (status === 'SHIPPED' && (await adminSettingsService.isEmailEnabled('shipping'))) {
          await sendShippedEmail(customer, order);
        } else if (status === 'OUT_FOR_DELIVERY' && (await adminSettingsService.isEmailEnabled('shipping'))) {
          await sendOutForDeliveryEmail(customer, order);
        } else if (status === 'DELIVERED' && (await adminSettingsService.isEmailEnabled('delivery'))) {
          await sendDeliveryEmail(customer, order);
        }
      }
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error(`Failed to send order status (${status}) email:`, error.message);
      }
    }

    return order;
  },

  async cancelByCustomer(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) { const error = new Error('Order not found'); error.statusCode = 404; throw error; }
    if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') { const error = new Error('Only unpaid pending orders can be cancelled by the customer'); error.statusCode = 409; throw error; }
    order.status = 'CANCELLED';
    await order.save();

    try {
      const customer = order.customerSnapshot?.email ? order.customerSnapshot : await User.findById(userId).select('firstName lastName email');
      if (customer?.email && (await adminSettingsService.isEmailEnabled('order'))) {
        await sendOrderCancelledEmail(customer, order);
      }
    } catch (error) {
      if (error.statusCode !== 503) {
        console.error('Failed to send order cancelled email:', error.message);
      }
    }

    return order;
  },
};
