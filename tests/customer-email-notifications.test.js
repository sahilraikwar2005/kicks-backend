import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { transporter } from '../src/config/email.js';
import { env } from '../src/config/env.js';
import User from '../src/modules/users/model.js';
import Order from '../src/modules/orders/model.js';
import Payment from '../src/modules/payments/model.js';
import Product from '../src/modules/products/model.js';
import { authService } from '../src/modules/auth/service.js';
import { orderService } from '../src/modules/orders/service.js';
import { paymentService } from '../src/modules/payments/service.js';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendOrderConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendOrderCancelledEmail,
  sendInvoiceEmail,
  sendRefundEmail,
  sendShippedEmail,
  sendOutForDeliveryEmail,
  sendDeliveryEmail,
} from '../src/services/email.service.js';

let sentEmails = [];
let originalSendMail;

test.before(async () => {
  await connectDatabase();
  originalSendMail = transporter.sendMail;
  transporter.sendMail = async (mailOptions) => {
    sentEmails.push(mailOptions);
    return { messageId: `mock-${Date.now()}-${Math.random()}` };
  };
  env.smtpUser = 'mock-user@example.com';
  env.smtpPassword = 'mock-password';
});

test.after(async () => {
  transporter.sendMail = originalSendMail;
  await User.deleteMany({ email: { $regex: /email-test/i } });
  await closeDatabase();
});

test.beforeEach(() => {
  sentEmails = [];
});

test('1. Email templates generate valid HTML and text with proper layout', async () => {
  const dummyUser = { email: 'email-test-template@kicks.test', firstName: 'Alex', lastName: 'Mercer' };
  const dummyOrder = {
    orderNumber: 'KICKS-TMPL-1234',
    grandTotal: 4500,
    paymentStatus: 'PAID',
    paymentId: 'pay_tmpl_999',
    items: [{ productName: 'Air Jordan 1', size: 'UK 9', color: 'Bred', sku: 'AJ1-BRED', quantity: 1, unitPrice: 4500, finalPrice: 4500 }],
  };

  await sendWelcomeEmail(dummyUser);
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Welcome to KICKS/i);
  assert.match(sentEmails[0].html, /Welcome to KICKS, Alex!/);

  await sendVerificationEmail(dummyUser, 'https://kicks.test/verify-email?token=abc');
  assert.equal(sentEmails.length, 2);
  assert.match(sentEmails[1].subject, /Verify your KICKS email/i);
  assert.match(sentEmails[1].html, /https:\/\/kicks\.test\/verify-email\?token=abc/);

  await sendPasswordResetEmail(dummyUser, 'https://kicks.test/reset-password?token=def');
  assert.equal(sentEmails.length, 3);
  assert.match(sentEmails[2].subject, /Reset your KICKS password/i);
  assert.match(sentEmails[2].html, /https:\/\/kicks\.test\/reset-password\?token=def/);

  await sendPasswordChangedEmail(dummyUser);
  assert.equal(sentEmails.length, 4);
  assert.match(sentEmails[3].subject, /password was changed/i);

  await sendOrderConfirmationEmail(dummyUser, dummyOrder);
  assert.equal(sentEmails.length, 5);
  assert.match(sentEmails[4].subject, /Order Confirmed: KICKS-TMPL-1234/i);
  assert.match(sentEmails[4].html, /Air Jordan 1/);

  await sendPaymentConfirmationEmail(dummyUser, dummyOrder);
  assert.equal(sentEmails.length, 6);
  assert.match(sentEmails[5].subject, /Payment Successful for Order KICKS-TMPL-1234/i);

  await sendOrderCancelledEmail(dummyUser, dummyOrder);
  assert.equal(sentEmails.length, 7);
  assert.match(sentEmails[6].subject, /Order Cancelled: KICKS-TMPL-1234/i);

  await sendInvoiceEmail(dummyUser, { invoiceNumber: 'INV-123' }, 'mock/path.pdf');
  assert.equal(sentEmails.length, 8);
  assert.match(sentEmails[7].subject, /Invoice INV-123/i);

  await sendRefundEmail(dummyUser, dummyOrder, 4500);
  assert.equal(sentEmails.length, 9);
  assert.match(sentEmails[8].subject, /Refund Processed for Order KICKS-TMPL-1234/i);

  await sendShippedEmail(dummyUser, dummyOrder, { awb: 'AWB9988', trackingUrl: 'https://track.kicks/9988' });
  assert.equal(sentEmails.length, 10);
  assert.match(sentEmails[9].subject, /Order KICKS-TMPL-1234 Has Shipped/i);

  await sendOutForDeliveryEmail(dummyUser, dummyOrder, { trackingUrl: 'https://track.kicks/9988' });
  assert.equal(sentEmails.length, 11);
  assert.match(sentEmails[10].subject, /Out for Delivery/i);

  await sendDeliveryEmail(dummyUser, dummyOrder);
  assert.equal(sentEmails.length, 12);
  assert.match(sentEmails[11].subject, /Delivered: KICKS Order KICKS-TMPL-1234/i);
});

test('2. Forgot password security: sends ONLY to registered account email, suppresses unregistered', async () => {
  const registeredEmail = 'email-test-registered@kicks.test';
  await User.deleteOne({ email: registeredEmail });
  const user = await User.create({
    firstName: 'Registered',
    lastName: 'User',
    email: registeredEmail,
    password: await bcrypt.hash('SecurePass123!', 12),
    role: 'CUSTOMER',
    isActive: true,
  });

  // A: Request for existing registered account
  const res1 = await authService.forgotPassword(registeredEmail);
  assert.equal(res1.message, 'If the account exists, a password reset link was sent.');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, registeredEmail);
  assert.match(sentEmails[0].subject, /Reset your KICKS password/i);

  // B: Request for non-existent/unregistered account
  sentEmails = [];
  const res2 = await authService.forgotPassword('email-test-unregistered-unknown@kicks.test');
  assert.equal(res2.message, 'If the account exists, a password reset link was sent.');
  assert.equal(sentEmails.length, 0, 'Must NOT send email for unregistered accounts');

  await User.deleteOne({ _id: user._id });
});

test('3. Auth notifications: register sends welcome + verification, resetPassword & changePassword send password changed', async () => {
  const email = 'email-test-authflow@kicks.test';
  await User.deleteOne({ email });

  // Registration
  const regResult = await authService.register({
    firstName: 'Jordan',
    lastName: 'Belfort',
    email,
    password: 'Password123!',
  });

  assert.ok(regResult.user);
  // Should send welcome email and verification email
  assert.equal(sentEmails.length, 2);
  assert.equal(sentEmails[0].to, email);
  assert.match(sentEmails[0].subject, /Welcome to KICKS/i);
  assert.equal(sentEmails[1].to, email);
  assert.match(sentEmails[1].subject, /Verify your KICKS email/i);

  // Change Password
  sentEmails = [];
  await authService.changePassword(regResult.user.id, 'Password123!', 'NewPassword456!');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, email);
  assert.match(sentEmails[0].subject, /password was changed/i);

  // Reset Password
  sentEmails = [];
  const dbUser = await User.findById(regResult.user.id);
  const resetToken = 'test-token-12345';
  dbUser.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  dbUser.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await dbUser.save();

  await authService.resetPassword(resetToken, 'AnotherPassword789!');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, email);
  assert.match(sentEmails[0].subject, /password was changed/i);

  // Expired / used token cannot be reused
  await assert.rejects(() => authService.resetPassword(resetToken, 'FailPassword!'), /invalid or expired/i);

  await User.deleteOne({ email });
});

test('4. Payment duplicate protection: payment success email sent once only across duplicate markPaid', async () => {
  const userId = new mongoose.Types.ObjectId();
  const email = 'email-test-paydup@kicks.test';
  const sku = `TEST-PAY-${Date.now()}`;

  const product = await Product.create({
    name: 'Payment Email Shoe',
    slug: `payment-email-shoe-${Date.now()}`,
    price: 300,
    status: 'PUBLISHED',
    variants: [{ sku, size: 'US 10', color: 'White', price: 300, stock: 10 }],
  });

  const order = await Order.create({
    user: userId,
    orderNumber: `KICKS-PAY-${Date.now()}`,
    items: [{
      productId: product._id,
      variantId: product.variants[0]._id,
      productName: product.name,
      sku,
      size: 'US 10',
      color: 'White',
      quantity: 1,
      unitPrice: 300,
      discount: 0,
      finalPrice: 300,
    }],
    shippingAddress: { street: '123 Test Rd', city: 'Delhi', country: 'India' },
    customerSnapshot: { firstName: 'Pay', lastName: 'Tester', email },
    subtotal: 300,
    grandTotal: 300,
    status: 'PENDING',
    paymentStatus: 'PENDING',
  });

  const payment = await Payment.create({
    order: order._id,
    user: userId,
    gatewayOrderId: `order_gw_${Date.now()}`,
    amount: 300,
    status: 'PENDING',
  });

  sentEmails = [];
  // First payment success
  await paymentService.markPaid(payment, 'pay_unique_1');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, email);
  assert.match(sentEmails[0].subject, /Payment Successful/i);

  // Duplicate / retry payment success
  const refreshedPayment = await Payment.findById(payment._id);
  await paymentService.markPaid(refreshedPayment, 'pay_unique_1');
  assert.equal(sentEmails.length, 1, 'Duplicate markPaid must NOT send duplicate payment confirmation email');

  await Product.deleteOne({ _id: product._id });
  await Order.deleteOne({ _id: order._id });
  await Payment.deleteOne({ _id: payment._id });
});

test('5. Order status transitions trigger appropriate customer emails', async () => {
  const userId = new mongoose.Types.ObjectId();
  const email = 'email-test-order-transitions@kicks.test';

  const order = await Order.create({
    user: userId,
    orderNumber: `KICKS-STATUS-${Date.now()}`,
    items: [{
      productId: new mongoose.Types.ObjectId(),
      variantId: new mongoose.Types.ObjectId(),
      productName: 'Status Transition Shoe',
      sku: 'SKU-TRANS',
      size: 'US 8',
      color: 'Blue',
      quantity: 1,
      unitPrice: 150,
      discount: 0,
      finalPrice: 150,
    }],
    shippingAddress: { street: '456 Test Way', city: 'Bangalore', country: 'India' },
    customerSnapshot: { firstName: 'Transition', lastName: 'Customer', email },
    subtotal: 150,
    grandTotal: 150,
    status: 'PENDING',
    paymentStatus: 'PENDING',
  });

  // Customer Cancel
  sentEmails = [];
  await orderService.cancelByCustomer(userId, order._id);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, email);
  assert.match(sentEmails[0].subject, /Order Cancelled/i);

  // Reset to confirmed for shipping progression test
  await Order.updateOne({ _id: order._id }, { $set: { status: 'CONFIRMED', paymentStatus: 'PAID' } });

  sentEmails = [];
  await orderService.updateStatus(order._id, 'PROCESSING');
  assert.equal(sentEmails.length, 0); // No email on processing

  await orderService.updateStatus(order._id, 'PACKED');
  assert.equal(sentEmails.length, 0); // No email on packed

  sentEmails = [];
  await orderService.updateStatus(order._id, 'SHIPPED');
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Has Shipped/i);

  sentEmails = [];
  await orderService.updateStatus(order._id, 'OUT_FOR_DELIVERY');
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Out for Delivery/i);

  sentEmails = [];
  await orderService.updateStatus(order._id, 'DELIVERED');
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Delivered/i);

  await Order.deleteOne({ _id: order._id });
});

test('6. SMTP failure does not fail business transactions', async () => {
  // Make transporter throw simulated SMTP outage error
  transporter.sendMail = async () => {
    const err = new Error('SMTP connection timed out');
    err.statusCode = 503;
    throw err;
  };

  const email = 'email-test-smtpfail@kicks.test';
  await User.deleteOne({ email });

  // Registration should still succeed despite email outage
  const regResult = await authService.register({
    firstName: 'Resilient',
    lastName: 'User',
    email,
    password: 'Password123!',
  });
  assert.ok(regResult.user);
  assert.equal(regResult.user.email, email);

  // Password change should succeed
  await authService.changePassword(regResult.user.id, 'Password123!', 'NewResilientPass1!');
  const userInDb = await User.findById(regResult.user.id).select('+password');
  assert.ok(await bcrypt.compare('NewResilientPass1!', userInDb.password));

  await User.deleteOne({ email });
});
