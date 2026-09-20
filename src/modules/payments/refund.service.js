import { razorpay } from '../../config/payment.js';
import { env } from '../../config/env.js';
import Payment from './model.js';
import Refund from './refund.model.js';
import Order from '../orders/model.js';
import { sendRefundEmail } from '../../services/email.service.js';
import { auditService } from '../audit/service.js';

const refundError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertRazorpayConfigured = () => {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) throw refundError('Razorpay is not configured', 503);
};

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw refundError('Invalid refund amount');
  return Math.round(value * 100) / 100;
};

const isGatewayRefundCompleted = (refund) => {
  const status = String(refund?.status || '').toLowerCase();
  return ['processed', 'completed', 'succeeded', 'success'].includes(status);
};

const gatewayRefundAmount = (refund, fallbackAmount) => {
  if (Number.isFinite(Number(refund?.amount))) return Number(refund.amount) / 100;
  return fallbackAmount;
};

const gatewayRefundCurrency = (refund, fallbackCurrency) => refund?.currency || fallbackCurrency;

const auditRefund = ({ adminId, orderId, paymentId, amount, refundId = '', previousState = {}, newState = '', reason = '', requestId = '', action = 'ORDER_REFUND_ACTION' }) => auditService.record({
  actor: adminId,
  action,
  resource: 'order',
  resourceId: orderId,
  metadata: {
    paymentId,
    amount,
    refundId,
    previousState,
    newState,
    reason,
    requestId,
  },
});

const isIgnorableEmailFailure = (error) => {
  if (!error) return false;
  return error.statusCode === 503 || error.code === 'EAUTH' || error.responseCode === 535 || /invalid credentials|smtp|email service/i.test(error.message || '');
};

const markRefundFailed = async (refundOperation, payment, error, adminId, requestId) => {
  await Refund.updateOne(
    { _id: refundOperation._id, status: { $ne: 'COMPLETED' } },
    {
      $set: {
        status: 'FAILED',
        failureReason: error.message || 'Refund failed',
        metadata: { ...(refundOperation.metadata || {}), retryable: true },
      },
    },
  );

  await Payment.updateOne(
    { _id: payment._id, refundStatus: 'PROCESSING' },
    {
      $set: {
        refundStatus: 'FAILED',
        metadata: {
          ...(payment.metadata || {}),
          lastRefundError: error.message || 'Refund failed',
          refundReconciliationRequired: true,
        },
      },
    },
  );

  await auditRefund({
    adminId,
    orderId: refundOperation.order,
    paymentId: payment._id,
    amount: refundOperation.amount,
    refundId: refundOperation.gatewayRefundId,
    previousState: refundOperation.previousState,
    newState: 'FAILED',
    reason: refundOperation.reason,
    requestId,
    action: 'ORDER_REFUND_FAILED',
  });
};

export const refundService = {
  async refund(orderId, adminId, requestedAmount, options = {}) {
    assertRazorpayConfigured();

    const order = await Order.findById(orderId).populate('user');
    const payment = await Payment.findOne({ order: orderId });
    if (!order || !payment) throw refundError('Paid order or payment not found', 404);
    if (payment.status !== 'PAID' || !payment.paymentId) throw refundError('Order does not have a successful payment');
    if (payment.refundStatus === 'PROCESSING') throw refundError('A refund is already processing for this payment', 409);
    if (payment.status === 'REFUNDED' || payment.refundAmount >= payment.amount) throw refundError('Payment has already been fully refunded', 409);
    if (payment.currency !== 'INR') throw refundError('Refund currency is not supported');

    const refundableAmount = Math.round((payment.amount - payment.refundAmount) * 100) / 100;
    const amount = requestedAmount === undefined ? refundableAmount : normalizeAmount(requestedAmount);
    if (amount > refundableAmount) throw refundError('Invalid refund amount');

    const idempotencyKey = String(options.idempotencyKey || `${payment._id}:${amount}`);
    const previousState = {
      paymentStatus: payment.status,
      paymentRefundStatus: payment.refundStatus,
      refundAmount: payment.refundAmount,
      orderStatus: order.status,
      orderPaymentStatus: order.paymentStatus,
    };

    let refundOperation;
    try {
      refundOperation = await Refund.create({
        order: order._id,
        payment: payment._id,
        requestedBy: adminId,
        provider: 'RAZORPAY',
        idempotencyKey,
        gatewayPaymentId: payment.paymentId,
        amount,
        currency: payment.currency,
        status: 'PENDING',
        reason: options.reason || '',
        previousState,
        metadata: { requestId: options.requestId || '' },
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      refundOperation = await Refund.findOne({ payment: payment._id, idempotencyKey });
      if (refundOperation) {
        return { payment: await Payment.findById(payment._id), refund: refundOperation, idempotent: true };
      }
      throw error;
    }

    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'PAID',
        paymentId: { $ne: '' },
        refundStatus: { $ne: 'PROCESSING' },
        refundAmount: { $lte: payment.amount - amount },
      },
      {
        $set: {
          refundStatus: 'PROCESSING',
          metadata: {
            ...(payment.metadata || {}),
            activeRefundOperation: refundOperation._id,
          },
        },
      },
      { new: true },
    );

    if (!claimedPayment) {
      await Refund.updateOne({ _id: refundOperation._id }, { $set: { status: 'FAILED', failureReason: 'Payment is not refundable' } });
      throw refundError('Payment is not refundable', 409);
    }

    await Refund.updateOne({ _id: refundOperation._id }, { $set: { status: 'PROCESSING' } });
    await auditRefund({
      adminId,
      orderId: order._id,
      paymentId: payment._id,
      amount,
      previousState,
      newState: 'PROCESSING',
      reason: options.reason || '',
      requestId: options.requestId || '',
      action: 'ORDER_REFUND_STARTED',
    });

    try {
      const gatewayRefund = await razorpay.payments.refund(payment.paymentId, { amount: Math.round(amount * 100) });
      if (gatewayRefundCurrency(gatewayRefund, payment.currency) !== payment.currency) {
        throw refundError('Refund currency does not match payment currency', 502);
      }

      const gatewayUpdate = gatewayRefund.id
        ? {
            $set: {
              gatewayRefundId: gatewayRefund.id,
              metadata: { ...(refundOperation.metadata || {}), gatewayStatus: gatewayRefund.status || '', raw: gatewayRefund },
            },
          }
        : {
            $unset: { gatewayRefundId: '' },
            $set: { metadata: { ...(refundOperation.metadata || {}), gatewayStatus: gatewayRefund.status || '', raw: gatewayRefund } },
          };

      await Refund.updateOne({ _id: refundOperation._id }, gatewayUpdate);

      if (!isGatewayRefundCompleted(gatewayRefund)) {
        await auditRefund({
          adminId,
          orderId: order._id,
          paymentId: payment._id,
          amount,
          refundId: gatewayRefund.id || '',
          previousState,
          newState: 'PROCESSING',
          reason: options.reason || '',
          requestId: options.requestId || '',
          action: 'ORDER_REFUND_PENDING_GATEWAY_CONFIRMATION',
        });
        return { payment: await Payment.findById(payment._id), refund: await Refund.findById(refundOperation._id), gatewayRefund };
      }

      const completed = await this.completeRefund(refundOperation._id, gatewayRefund, { adminId, requestId: options.requestId || '' });
      try {
        await sendRefundEmail(order.user, order, amount);
      } catch (error) {
        if (!isIgnorableEmailFailure(error)) throw error;
      }
      return { ...completed, gatewayRefund };
    } catch (error) {
      await markRefundFailed(refundOperation, claimedPayment, error, adminId, options.requestId || '');
      throw error;
    }
  },

  async completeRefund(refundOperationId, gatewayRefund = {}, context = {}) {
    const refundOperation = await Refund.findById(refundOperationId);
    if (!refundOperation) throw refundError('Refund operation not found', 404);
    if (refundOperation.status === 'COMPLETED') {
      return { payment: await Payment.findById(refundOperation.payment), refund: refundOperation, idempotent: true };
    }
    if (refundOperation.status === 'FAILED') throw refundError('Invalid refund state transition', 409);

    const amount = gatewayRefundAmount(gatewayRefund, refundOperation.amount);
    if (amount <= 0 || amount > refundOperation.amount) throw refundError('Invalid refund amount from gateway', 409);
    const payment = await Payment.findById(refundOperation.payment);
    if (!payment) throw refundError('Payment not found', 404);
    if (gatewayRefundCurrency(gatewayRefund, payment.currency) !== payment.currency) throw refundError('Refund currency does not match payment currency', 409);

    const newRefundAmount = Math.round((payment.refundAmount + amount) * 100) / 100;
    if (newRefundAmount > payment.amount) throw refundError('Refund exceeds paid amount', 409);

    const isFullRefund = newRefundAmount >= payment.amount;
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, refundAmount: payment.refundAmount, status: 'PAID' },
      {
        $set: {
          refundId: gatewayRefund.id || refundOperation.gatewayRefundId,
          refundStatus: isFullRefund ? 'COMPLETED' : 'COMPLETED',
          status: isFullRefund ? 'REFUNDED' : 'PAID',
          refundedAt: new Date(),
          metadata: {
            ...(payment.metadata || {}),
            activeRefundOperation: '',
            lastRefundGatewayStatus: gatewayRefund.status || 'processed',
          },
        },
        $inc: { refundAmount: amount },
      },
      { new: true },
    );

    if (!updatedPayment) throw refundError('Invalid refund state transition', 409);

    let updatedOrder = null;
    if (isFullRefund) {
      updatedOrder = await Order.findByIdAndUpdate(
        refundOperation.order,
        { $set: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } },
        { new: true },
      );
    }

    const completionUpdate = gatewayRefund.id
      ? {
          $set: {
            status: 'COMPLETED',
            gatewayRefundId: gatewayRefund.id,
            processedAt: new Date(),
            failureReason: '',
            metadata: {
              ...(refundOperation.metadata || {}),
              gatewayStatus: gatewayRefund.status || 'processed',
              raw: gatewayRefund,
            },
          },
        }
      : {
          $set: {
            status: 'COMPLETED',
            processedAt: new Date(),
            failureReason: '',
            metadata: {
              ...(refundOperation.metadata || {}),
              gatewayStatus: gatewayRefund.status || 'processed',
              raw: gatewayRefund,
            },
          },
        };

    const completedRefund = await Refund.findByIdAndUpdate(refundOperation._id, completionUpdate, { new: true });

    await auditRefund({
      adminId: context.adminId || refundOperation.requestedBy,
      orderId: refundOperation.order,
      paymentId: payment._id,
      amount,
      refundId: completedRefund.gatewayRefundId,
      previousState: refundOperation.previousState,
      newState: 'COMPLETED',
      reason: refundOperation.reason,
      requestId: context.requestId || refundOperation.metadata?.requestId || '',
      action: 'ORDER_REFUNDED',
    });

    return { payment: updatedPayment, order: updatedOrder, refund: completedRefund };
  },

  async reconcileWebhook(refundEntity) {
    const gatewayRefundId = refundEntity?.id;
    const gatewayPaymentId = refundEntity?.payment_id;
    if (!gatewayRefundId || !gatewayPaymentId) return { ignored: true, reason: 'INVALID_REFUND_PAYLOAD' };

    let refundOperation = await Refund.findOne({ provider: 'RAZORPAY', gatewayRefundId });
    if (!refundOperation) {
      const payment = await Payment.findOne({ paymentId: gatewayPaymentId });
      if (!payment) return { ignored: true, reason: 'PAYMENT_NOT_FOUND' };
      const amount = gatewayRefundAmount(refundEntity, 0);
      refundOperation = await Refund.create({
        order: payment.order,
        payment: payment._id,
        provider: 'RAZORPAY',
        idempotencyKey: `webhook:${gatewayRefundId}`,
        gatewayRefundId,
        gatewayPaymentId,
        amount,
        currency: gatewayRefundCurrency(refundEntity, payment.currency),
        status: 'PROCESSING',
        previousState: {
          paymentStatus: payment.status,
          paymentRefundStatus: payment.refundStatus,
          refundAmount: payment.refundAmount,
        },
        metadata: { source: 'webhook' },
      });
    }

    if (refundOperation.status === 'COMPLETED') {
      return { duplicate: true, refund: refundOperation };
    }

    if (String(refundEntity.status || '').toLowerCase() === 'failed') {
      await Refund.updateOne({ _id: refundOperation._id, status: { $ne: 'COMPLETED' } }, { $set: { status: 'FAILED', failureReason: refundEntity.error_description || 'Gateway refund failed' } });
      await Payment.updateOne({ _id: refundOperation.payment, status: { $ne: 'REFUNDED' } }, { $set: { refundStatus: 'FAILED' } });
      return { failed: true, refund: await Refund.findById(refundOperation._id) };
    }

    if (!isGatewayRefundCompleted(refundEntity)) return { pending: true, refund: refundOperation };
    return this.completeRefund(refundOperation._id, refundEntity);
  },
};
