import crypto from 'node:crypto';
import { razorpay, paymentConfig } from '../../config/payment.js';
import { env } from '../../config/env.js';
import Order from '../orders/model.js';
import Cart from '../cart/model.js';
import Payment from './model.js';
import PaymentWebhookEvent from './webhook.model.js';
import { refundService } from './refund.service.js';
import { auditService } from '../audit/service.js';
import { couponService } from '../coupons/service.js';
import { inventoryService } from '../inventory/service.js';

const configurationError = () => {
  const error = new Error('Razorpay is not configured');
  error.statusCode = 503;
  return error;
};

const constantTimeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifySignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return constantTimeEqual(expected, signature);
};

const payloadHash = (rawBody) => crypto.createHash('sha256').update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8')).digest('hex');

export const paymentService = {
  async createOrder(userId, orderId) {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) throw configurationError();
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) { const error = new Error('Order not found'); error.statusCode = 404; throw error; }
    const existing = await Payment.findOne({ order: order._id, status: 'PENDING' });
    if (existing) return { order, payment: existing };
    const gatewayOrder = await razorpay.orders.create({ amount: Math.round(order.grandTotal * 100), currency: paymentConfig.currency, receipt: order.orderNumber });
    const payment = await Payment.create({ order: order._id, user: userId, gatewayOrderId: gatewayOrder.id, amount: order.grandTotal });
    return { order, payment, gatewayOrder };
  },

  async verifyPayment(userId, payload) {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) throw configurationError();
    const payment = await Payment.findOne({ gatewayOrderId: payload.razorpay_order_id, user: userId }).populate('order');
    if (!payment) { const error = new Error('Payment order not found'); error.statusCode = 404; throw error; }
    if (payment.status === 'PAID') return payment;
    if (!verifySignature(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`, payload.razorpay_signature, env.razorpayKeySecret)) {
      const error = new Error('Invalid payment signature'); error.statusCode = 400; throw error;
    }
    const gatewayPayment = await razorpay.payments.fetch(payload.razorpay_payment_id);
    if (gatewayPayment.order_id !== payment.gatewayOrderId || gatewayPayment.currency !== payment.currency || Number(gatewayPayment.amount) !== Math.round(payment.amount * 100) || gatewayPayment.status !== 'captured') {
      const error = new Error('Payment details do not match the order'); error.statusCode = 400; throw error;
    }
    await this.markPaid(payment, payload.razorpay_payment_id);
    return Payment.findById(payment._id);
  },

  async markPaid(payment, paymentId) {
    if (payment.status === 'PAID') return payment;

    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'PAID', paymentId } },
      { new: true },
    );

    if (!updatedPayment) {
      return Payment.findById(payment._id);
    }
    payment = updatedPayment;

    const order = payment.order && typeof payment.order === 'object' && payment.order.items ? payment.order : await Order.findById(payment.order);
    if (order) {
      await Order.updateOne(
        { _id: order._id, paymentStatus: { $ne: 'PAID' } },
        { $set: { paymentStatus: 'PAID', status: 'CONFIRMED', paymentId } },
      );
    }

    let inventoryFailed = false;
    let inventoryErrorMsg = '';

    if (order && order.items && order.items.length > 0) {
      try {
        for (const item of order.items) {
          const itemProdId = item.productId?._id || item.productId;
          const itemVarId = item.variantId?._id || item.variantId;
          await inventoryService.commitSale(itemProdId, itemVarId, item.quantity, {
            orderId: order._id,
            paymentId,
            referenceId: `payment-${payment._id}-item-${itemVarId}`,
            reason: 'payment_capture',
          });
        }
      } catch (err) {
        console.error('DEBUG_COMMIT_FAIL:', err.stack || err.message);
        inventoryFailed = true;
        inventoryErrorMsg = err.message || 'Inventory commit failed';
      }
    }

    if (inventoryFailed) {
      console.error('MARK_PAID_INV_ERROR:', inventoryErrorMsg);
      const metadataUpdate = {
        ...(payment.metadata || {}),
        inventoryStatus: 'FAILED',
        inventoryError: inventoryErrorMsg,
        reconciliationRequired: true,
      };

      await Payment.updateOne(
        { _id: payment._id },
        { $set: { metadata: metadataUpdate } },
      );
      payment.metadata = metadataUpdate;

      const error = new Error(`Payment recorded as PAID, but inventory processing failed: ${inventoryErrorMsg}`);
      error.statusCode = 409;
      throw error;
    }

    try {
      if (order) {
        await Cart.updateOne({ userId: order.user, items: { $exists: true } }, { $set: { items: [] } });
        if (order.couponCode) await couponService.consumeForPaidOrder(order);
        await auditService.record({ actor: order.user, action: 'INVENTORY_DECREMENTED', resource: 'order', resourceId: order._id, metadata: { paymentId } });
      }
    } catch (e) {
      const metadataUpdate = {
        ...(payment.metadata || {}),
        couponStatus: 'FAILED',
        couponError: e.message || 'Coupon consumption failed',
        reconciliationRequired: true,
      };
      await Payment.updateOne({ _id: payment._id }, { $set: { metadata: metadataUpdate } });
      payment.metadata = metadataUpdate;
      const error = new Error(`Payment recorded as PAID, but post-payment processing failed: ${e.message}`);
      error.statusCode = e.statusCode || 409;
      throw error;
    }

    return payment;
  },

  async handleWebhook(rawBody, signature, payload) {
    const incomingBody = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');

    if (!incomingBody) {
      const error = new Error('Webhook body is required');
      error.statusCode = 400;
      throw error;
    }

    if (!env.razorpayWebhookSecret) throw configurationError();
    if (!signature) {
      const error = new Error('Missing webhook signature');
      error.statusCode = 400;
      throw error;
    }

    if (!verifySignature(incomingBody, signature, env.razorpayWebhookSecret)) {
      const error = new Error('Invalid webhook signature');
      error.statusCode = 400;
      throw error;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      const error = new Error('Malformed webhook payload');
      error.statusCode = 400;
      throw error;
    }

    const eventType = payload.event;
    const incomingHash = payloadHash(incomingBody);
    const fallbackEventId = payload.event_id || payload.id || payload.payload?.payment?.entity?.id || payload.payload?.order?.entity?.id || payload.payload?.refund?.entity?.id || `${eventType}:${incomingHash}`;
    const eventId = fallbackEventId;

    if (!eventType) {
      const error = new Error('Webhook payload missing event metadata');
      error.statusCode = 400;
      throw error;
    }

    const gateway = 'RAZORPAY';
    const staleProcessingMs = 10 * 60 * 1000;
    const isStaleProcessing = (event) => {
      if (!event || event.status !== 'PROCESSING') return false;
      const lastTouched = new Date(event.updatedAt || event.receivedAt || event.createdAt || Date.now());
      return Date.now() - lastTouched.getTime() >= staleProcessingMs;
    };

    let eventRecord = await PaymentWebhookEvent.findOne({ gateway, eventId });
    if (!eventRecord) {
      try {
        eventRecord = await PaymentWebhookEvent.create({
          gateway,
          provider: 'RAZORPAY',
          eventId,
          eventType,
          status: 'RECEIVED',
          payloadHash: incomingHash,
          receivedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          attempts: 1,
          metadata: { rawPayload: { event: eventType } },
        });
      } catch (err) {
        if (err.code === 11000) {
          eventRecord = await PaymentWebhookEvent.findOne({ gateway, eventId });
        } else {
          throw err;
        }
      }
    }

    if (eventRecord && eventRecord.payloadHash && eventRecord.payloadHash !== incomingHash) {
      await PaymentWebhookEvent.updateOne(
        { _id: eventRecord._id },
        { $set: { status: 'FAILED', lastError: 'Webhook payload hash mismatch for eventId', processedAt: null, updatedAt: new Date() } },
      );
      const error = new Error('Webhook payload hash mismatch for same eventId');
      error.statusCode = 409;
      throw error;
    }

    if (eventRecord && eventRecord.status === 'PROCESSED') {
      return { received: true, duplicate: true, status: 'PROCESSED', eventId };
    }

    if (eventRecord && eventRecord.status === 'PROCESSING' && !isStaleProcessing(eventRecord)) {
      return { received: true, duplicate: true, status: 'PROCESSING', eventId };
    }

    const claimFilter = { _id: eventRecord._id, status: { $in: ['RECEIVED', 'FAILED'] } };
    let claimedEvent = await PaymentWebhookEvent.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          status: 'PROCESSING',
          eventType,
          payloadHash: incomingHash,
          lastError: '',
          processedAt: null,
          receivedAt: eventRecord.receivedAt || new Date(),
          updatedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    if (!claimedEvent) {
      const latest = await PaymentWebhookEvent.findOne({ gateway, eventId }).sort({ updatedAt: -1 });
      if (latest && latest.status === 'PROCESSED') {
        return { received: true, duplicate: true, status: 'PROCESSED', eventId };
      }
      if (latest && latest.status === 'PROCESSING') {
        if (!isStaleProcessing(latest)) {
          return { received: true, duplicate: true, status: 'PROCESSING', eventId };
        }
        claimedEvent = await PaymentWebhookEvent.findOneAndUpdate(
          { _id: latest._id },
          {
            $set: {
              status: 'PROCESSING',
              eventType,
              payloadHash: incomingHash,
              lastError: '',
              processedAt: null,
              receivedAt: latest.receivedAt || new Date(),
              updatedAt: new Date(),
            },
            $inc: { attempts: 1 },
          },
          { new: true },
        );
        if (!claimedEvent) {
          return { received: true, duplicate: true, status: latest.status, eventId };
        }
      }
      if (latest && latest.status === 'FAILED') {
        claimedEvent = await PaymentWebhookEvent.findOneAndUpdate(
          { _id: latest._id, status: 'FAILED' },
          {
            $set: {
              status: 'PROCESSING',
              eventType,
              payloadHash: incomingHash,
              lastError: '',
              processedAt: null,
              receivedAt: latest.receivedAt || new Date(),
              updatedAt: new Date(),
            },
            $inc: { attempts: 1 },
          },
          { new: true },
        );
        if (!claimedEvent) {
          return { received: true, duplicate: true, status: latest.status, eventId };
        }
      }
    }

    const activeEvent = claimedEvent || eventRecord;

    try {
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const paymentId = payload.payload?.payment?.entity?.id || payload.payload?.order?.entity?.id;
        const gatewayOrderId = payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;

        if (gatewayOrderId) {
          const payment = await Payment.findOne({ gatewayOrderId }).populate('order');
          if (payment) {
            if (payment.status === 'PAID') {
              await PaymentWebhookEvent.updateOne({ _id: activeEvent._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), updatedAt: new Date(), lastError: '' } });
              return { received: true, duplicate: true, status: 'PROCESSED', eventId, paymentStatus: payment.status };
            }
            await this.markPaid(payment, paymentId);
          }
        }
      } else if (eventType === 'payment.failed') {
        const gatewayOrderId = payload.payload?.payment?.entity?.order_id;
        if (gatewayOrderId) {
          await Payment.updateOne({ gatewayOrderId, status: { $ne: 'PAID' } }, { $set: { status: 'FAILED' } });
        }
      } else if (eventType === 'refund.processed' || eventType === 'refund.failed') {
        const refundEntity = payload.payload?.refund?.entity;
        if (refundEntity) await refundService.reconcileWebhook(refundEntity);
      }

      const supportedEventTypes = ['payment.captured', 'order.paid', 'payment.failed', 'refund.processed', 'refund.failed'];
      if (!supportedEventTypes.includes(eventType)) {
        await PaymentWebhookEvent.updateOne({ _id: activeEvent._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), updatedAt: new Date(), lastError: '' } });
        return { received: true, ignored: true, status: 'PROCESSED', eventId, eventType };
      }

      await PaymentWebhookEvent.updateOne({ _id: activeEvent._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), updatedAt: new Date(), lastError: '' } });
      return { received: true, status: 'PROCESSED', eventId };
    } catch (err) {
      await PaymentWebhookEvent.updateOne(
        { _id: activeEvent._id },
        { $set: { status: 'FAILED', processedAt: null, updatedAt: new Date(), lastError: err.message || 'Webhook processing failed' } },
      );
      return { received: true, retryable: true, status: 'FAILED', eventId, error: err.message || 'Webhook processing failed' };
    }
  },
};
