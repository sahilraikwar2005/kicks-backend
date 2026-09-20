import { razorpay } from '../config/payment.js';
import crypto from 'node:crypto';

export async function createPaymentOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  return razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt,
    notes,
  });
}

export function verifyRazorpaySignature({ orderId, paymentId, signature, secret }) {
  const generated = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return generated === signature;
}
