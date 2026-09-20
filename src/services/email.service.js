import { transporter, emailConfig } from '../config/email.js';
import { env } from '../config/env.js';

export async function sendEmail({ to, subject, html, text, attachments }) {
  if (!to) {
    throw new Error('Recipient email is required');
  }
  if (!env.smtpUser || !env.smtpPassword) {
    const error = new Error('SMTP email service is not configured');
    error.statusCode = 503;
    throw error;
  }

  return transporter.sendMail({
    from: emailConfig.from,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

export async function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to KICKS',
    text: `Welcome ${user.firstName}!`,
    html: `<p>Welcome ${user.firstName}! Your KICKS account is ready.</p>`,
  });
}

export const sendVerificationEmail = (user, url) => sendEmail({ to: user.email, subject: 'Verify your KICKS email', text: `Verify your email: ${url}`, html: `<p>Verify your KICKS email: <a href="${url}">${url}</a></p>` });
export const sendPasswordResetEmail = (user, url) => sendEmail({ to: user.email, subject: 'Reset your KICKS password', text: `Reset your password: ${url}`, html: `<p>Reset your KICKS password: <a href="${url}">${url}</a></p>` });
export const sendOrderConfirmationEmail = (user, order) => sendEmail({ to: user.email, subject: `KICKS order ${order.orderNumber}`, text: `Your order ${order.orderNumber} is confirmed.`, html: `<p>Your order ${order.orderNumber} is confirmed.</p>` });
export const sendPaymentConfirmationEmail = (user, order) => sendEmail({ to: user.email, subject: `KICKS payment received for ${order.orderNumber}`, text: `Payment received for ${order.orderNumber}.`, html: `<p>Payment received for ${order.orderNumber}.</p>` });
export const sendShippingUpdateEmail = (user, order, shipment) => sendEmail({ to: user.email, subject: `KICKS shipment update for ${order.orderNumber}`, text: `Your shipment is ${shipment.status}.`, html: `<p>Your shipment is ${shipment.status}.</p>` });
export const sendDeliveryEmail = (user, order) => sendEmail({ to: user.email, subject: `KICKS order ${order.orderNumber} delivered`, text: `Your order was delivered.`, html: `<p>Your order was delivered.</p>` });
export const sendRefundEmail = (user, order, amount) => sendEmail({ to: user.email, subject: `KICKS refund for ${order.orderNumber}`, text: `Refund processed: INR ${amount}.`, html: `<p>Refund processed: INR ${amount}.</p>` });
export const sendInvoiceEmail = (user, invoice, filePath) => sendEmail({ to: user.email, subject: `KICKS invoice ${invoice.invoiceNumber}`, text: `Your commercial invoice is attached.`, html: `<p>Your commercial invoice is attached.</p>`, attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: filePath }] });
