import { transporter, emailConfig } from '../config/email.js';
import { env } from '../config/env.js';

/**
 * Escapes HTML characters to prevent XSS in email templates.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Common base layout wrapper for all AJ SPORTS transactional emails.
 */
function emailLayout({ title, content }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="background-color: #09090b; padding: 24px 32px; text-align: left;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">AJ SPORTS</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px 32px; border-top: 1px solid #f4f4f5; text-align: center; font-size: 12px; color: #71717a;">
              <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} AJ SPORTS Store. All rights reserved.</p>
              <p style="margin: 0;">This is an automated notification. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Low-level email sender utilizing Nodemailer transport.
 */
export async function sendEmail({ to, subject, html, text, attachments }) {
  if (!to) {
    throw new Error('Recipient email is required');
  }
  if (!env.smtpUser || !env.smtpPassword) {
    const error = new Error('SMTP email service is not configured');
    error.statusCode = 503;
    throw error;
  }

  try {
    return await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject,
      text,
      html,
      attachments,
    });
  } catch (error) {
    const serviceError = new Error('SMTP email service unavailable');
    serviceError.statusCode = 503;
    serviceError.cause = error;
    throw serviceError;
  }
}

/**
 * 1. Welcome / Registration Email
 */
export async function sendWelcomeEmail(user) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const subject = 'Welcome to AJ SPORTS!';
  const text = `Hi ${user.firstName || 'there'},\n\nWelcome to AJ SPORTS! Your account has been successfully created. Explore the latest premium sneakers and footwear on our store.\n\nHappy shopping!\nThe AJ SPORTS Team`;
  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Welcome to AJ SPORTS, ${name}!</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Your account has been successfully created. Discover our curated collection of authentic, high-performance sneakers and timeless classics.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(env.clientUrl)}/shop" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Explore Collection</a>
      </div>
      <p style="color: #71717a; font-size: 13px; margin-top: 24px;">If you didn't create this account, please ignore this email.</p>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 2b. Registration OTP (email channel)
 */
export async function sendOtpEmail({ to, firstName, otp }) {
  const name = firstName ? escapeHtml(firstName) : 'there';
  const subject = 'Your AJ SPORTS verification code';
  const text = `Hi ${firstName || 'there'},\n\nYour AJ SPORTS verification code is:\n${otp}\n\nThis code expires in 10 minutes. Do not share this code with anyone.\n\nThe AJ SPORTS Team`;
  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Verify your email</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, use the code below to finish creating your AJ SPORTS account.</p>
      <div style="margin: 24px 0; text-align: center; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 20px;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #09090b;">${escapeHtml(otp)}</span>
      </div>
      <p style="color: #71717a; font-size: 13px; line-height: 1.5;">This code expires in 10 minutes. Do not share this code with anyone.</p>
    `,
  });

  return sendEmail({ to, subject, text, html });
}

/**
 * 2c. Password-reset OTP (email channel)
 */
export async function sendPasswordResetOtpEmail({ to, firstName, otp }) {
  const name = firstName ? escapeHtml(firstName) : 'there';
  const subject = 'Your AJ SPORTS password reset code';
  const text = `Hi ${firstName || 'there'},\n\nWe received a request to reset your AJ SPORTS account password. Your verification code is:\n${otp}\n\nThis code expires in 10 minutes. Do not share this code with anyone.\n\nIf you did not request a password reset, you can safely ignore this email; your account remains secure.\n\nThe AJ SPORTS Team`;
  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Reset your password</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, use the code below to verify it is you and choose a new AJ SPORTS password.</p>
      <div style="margin: 24px 0; text-align: center; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 20px;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #09090b;">${escapeHtml(otp)}</span>
      </div>
      <p style="color: #71717a; font-size: 13px; line-height: 1.5;">This code expires in 10 minutes. Do not share this code with anyone.<br>If you did not request a password reset, you can safely ignore this email.</p>
    `,
  });

  return sendEmail({ to, subject, text, html });
}

/**
 * 2. Email Verification & Resend Verification
 */
export async function sendVerificationEmail(user, url) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const subject = 'Verify your AJ SPORTS email';
  const text = `Hi ${user.firstName || 'there'},\n\nPlease verify your email address by visiting the following link:\n${url}\n\nThis verification link will expire in 24 hours.\n\nThe AJ SPORTS Team`;
  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Verify Your Email Address</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, thank you for joining AJ SPORTS! Please confirm your email address by clicking the button below.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(url)}" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Verify Email</a>
      </div>
      <p style="color: #71717a; font-size: 13px; line-height: 1.5;">This link will expire in 24 hours. If the button doesn't work, copy and paste this link into your browser:<br><span style="color: #2563eb; word-break: break-all;">${escapeHtml(url)}</span></p>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 3. Forgot Password / Reset Password Request
 */
export async function sendPasswordResetEmail(user, url) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const subject = 'Reset your AJ SPORTS password';
  const text = `Hi ${user.firstName || 'there'},\n\nWe received a request to reset your AJ SPORTS password. Click the link below to choose a new password:\n${url}\n\nThis link expires in 1 hour. If you did not request a password reset, please ignore this email or contact support immediately.\n\nThe AJ SPORTS Team`;
  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Password Reset Request</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, we received a request to reset your password for your AJ SPORTS account.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(url)}" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Reset Password</a>
      </div>
      <p style="color: #71717a; font-size: 13px; line-height: 1.5;">This link expires in 1 hour and can only be used once.<br>If you did not request a password reset, you can safely ignore this email; your account remains secure.</p>
      <p style="color: #71717a; font-size: 12px; word-break: break-all;">Direct link: ${escapeHtml(url)}</p>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 4. Password Changed Notification
 */
export async function sendPasswordChangedEmail(user) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const subject = 'Your AJ SPORTS password was changed';
  const text = `Hi ${user.firstName || 'there'},\n\nYour AJ SPORTS account password was successfully changed on ${new Date().toUTCString()}.\n\nIf you did not make this change, please contact AJ SPORTS support immediately to protect your account.\n\nThe AJ SPORTS Team`;
  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Password Changed Successfully</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, this email confirms that your AJ SPORTS password was successfully updated.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;"><strong>Important:</strong> If you did not make this update, please contact support or reset your password immediately to secure your account.</p>
      </div>
      <p style="color: #71717a; font-size: 13px;">Time of change: ${new Date().toUTCString()}</p>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * Helper to render order items list in email
 */
function renderOrderItemsHtml(items = []) {
  if (!items || items.length === 0) return '';
  const rows = items.map((item) => `
    <tr style="border-bottom: 1px solid #f4f4f5;">
      <td style="padding: 10px 0; font-size: 14px; color: #18181b;">
        <strong>${escapeHtml(item.productName)}</strong>
        <div style="font-size: 12px; color: #71717a;">Size: ${escapeHtml(item.size || 'N/A')} | Color: ${escapeHtml(item.color || 'N/A')} | SKU: ${escapeHtml(item.sku || 'N/A')}</div>
      </td>
      <td style="padding: 10px 0; text-align: center; font-size: 14px; color: #3f3f46;">${escapeHtml(item.quantity)}</td>
      <td style="padding: 10px 0; text-align: right; font-size: 14px; color: #18181b;">INR ${escapeHtml(item.finalPrice ?? (item.unitPrice * item.quantity))}</td>
    </tr>
  `).join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #e4e4e7; font-size: 12px; text-transform: uppercase; color: #71717a;">
          <th align="left" style="padding: 8px 0;">Item</th>
          <th align="center" style="padding: 8px 0;">Qty</th>
          <th align="right" style="padding: 8px 0;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * 5. Order Confirmation Email (Order Placed)
 */
export async function sendOrderConfirmationEmail(user, order) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const subject = `Order Confirmed: ${order.orderNumber}`;
  const itemsText = (order.items || []).map((i) => `- ${i.productName} (Qty: ${i.quantity}) - INR ${i.finalPrice ?? (i.unitPrice * i.quantity)}`).join('\n');
  const text = `Hi ${user.firstName || 'there'},\n\nThank you for your order! Your order ${order.orderNumber} has been received.\n\nItems:\n${itemsText}\n\nGrand Total: INR ${order.grandTotal}\nPayment Status: ${order.paymentStatus}\n\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Order Confirmed!</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, thank you for shopping with AJ SPORTS! We have received your order <strong>${orderNumber}</strong>.</p>
      ${renderOrderItemsHtml(order.items)}
      <div style="background-color: #fafafa; border-radius: 6px; padding: 14px 18px; margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #09090b;">
          <span>Grand Total:</span>
          <span>INR ${escapeHtml(order.grandTotal)}</span>
        </div>
        <div style="font-size: 12px; color: #71717a; margin-top: 4px;">Payment Status: ${escapeHtml(order.paymentStatus)}</div>
      </div>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(env.clientUrl)}/orders" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">View Your Orders</a>
      </div>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 6. Payment Successful Email (ONLY after verified payment)
 */
export async function sendPaymentConfirmationEmail(user, order) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const subject = `Payment Successful for Order ${order.orderNumber}`;
  const text = `Hi ${user.firstName || 'there'},\n\nWe have successfully received your payment of INR ${order.grandTotal} for order ${order.orderNumber}.\n\nPayment ID: ${order.paymentId || 'Verified'}\nWe are now preparing your order for shipment.\n\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #15803d; font-size: 20px; font-weight: 700;">Payment Successful</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, your payment for order <strong>${orderNumber}</strong> has been successfully processed and verified.</p>
      <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #166534;"><strong>Amount Paid:</strong> INR ${escapeHtml(order.grandTotal)}</p>
        <p style="margin: 0; font-size: 13px; color: #15803d;"><strong>Payment ID:</strong> ${escapeHtml(order.paymentId || 'Captured')}</p>
      </div>
      <p style="color: #3f3f46; font-size: 14px;">Your order is now confirmed and our fulfillment team is preparing it for dispatch.</p>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 7. Order Cancelled Email
 */
export async function sendOrderCancelledEmail(user, order) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const subject = `Order Cancelled: ${order.orderNumber}`;
  const text = `Hi ${user.firstName || 'there'},\n\nYour AJ SPORTS order ${order.orderNumber} has been cancelled.\n\nIf you have any questions or this was done in error, please reach out to our customer support.\n\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #b91c1c; font-size: 20px; font-weight: 700;">Order Cancelled</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, your order <strong>${orderNumber}</strong> has been cancelled.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">If this cancellation was not requested by you, or if you require further assistance, please contact AJ SPORTS support.</p>
      </div>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 8. Invoice Email
 */
export async function sendInvoiceEmail(user, invoice, filePath) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const invoiceNumber = escapeHtml(invoice.invoiceNumber);
  const subject = `Invoice ${invoice.invoiceNumber} for your AJ SPORTS order`;
  const text = `Hi ${user.firstName || 'there'},\n\nPlease find attached the official commercial tax invoice ${invoice.invoiceNumber} for your recent AJ SPORTS order.\n\nThank you for shopping with us!\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Commercial Invoice</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, your official commercial tax invoice <strong>${invoiceNumber}</strong> is attached to this email as a PDF.</p>
      <p style="color: #71717a; font-size: 13px;">Please retain this document for your records and warranty purposes.</p>
    `,
  });

  return sendEmail({
    to: user.email,
    subject,
    text,
    html,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: filePath }],
  });
}

/**
 * 9. Refund Email
 */
export async function sendRefundEmail(user, order, amount) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const subject = `Refund Processed for Order ${order.orderNumber}`;
  const text = `Hi ${user.firstName || 'there'},\n\nA refund of INR ${amount} has been processed for your order ${order.orderNumber}.\n\nThe amount should reflect in your original payment method in 5-7 business days.\n\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Refund Processed</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, a refund has been initiated for your order <strong>${orderNumber}</strong>.</p>
      <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #09090b;">Refund Amount: INR ${escapeHtml(amount)}</p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #71717a;">The funds should reflect in your original payment account within 5-7 business days depending on your bank.</p>
      </div>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 10. Shipped Email
 */
export async function sendShippedEmail(user, order, shipment = {}) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const awb = shipment.awb ? escapeHtml(shipment.awb) : '';
  const trackingUrl = shipment.trackingUrl ? escapeHtml(shipment.trackingUrl) : '';
  const subject = `Your AJ SPORTS Order ${order.orderNumber} Has Shipped!`;
  const text = `Hi ${user.firstName || 'there'},\n\nGreat news! Your order ${order.orderNumber} has been shipped.\n${awb ? `Tracking / AWB Number: ${awb}\n` : ''}${trackingUrl ? `Track package: ${trackingUrl}\n` : ''}\nThe AJ SPORTS Team`;

  const trackingButton = trackingUrl ? `
    <div style="margin: 24px 0; text-align: center;">
      <a href="${trackingUrl}" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Track Shipment</a>
    </div>
  ` : '';

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Your Order is on the Way!</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, exciting news! Your order <strong>${orderNumber}</strong> has been handed over to the courier and is on its way.</p>
      ${awb ? `<p style="font-size: 14px; color: #3f3f46;"><strong>AWB / Tracking Number:</strong> ${awb}</p>` : ''}
      ${trackingButton}
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 11. Out For Delivery Email
 */
export async function sendOutForDeliveryEmail(user, order, shipment = {}) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const subject = `Out for Delivery: AJ SPORTS Order ${order.orderNumber}`;
  const text = `Hi ${user.firstName || 'there'},\n\nYour order ${order.orderNumber} is out for delivery today! Please ensure someone is available at the delivery address to receive it.\n\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #09090b; font-size: 20px; font-weight: 700;">Out for Delivery Today</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, your order <strong>${orderNumber}</strong> is in the final delivery vehicle and will arrive today.</p>
      <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #1e40af;">Please make sure you or someone at your address is available to accept the package.</p>
      </div>
      ${shipment.trackingUrl ? `<p style="font-size: 13px;"><a href="${escapeHtml(shipment.trackingUrl)}" style="color: #2563eb;">Live courier tracking &rarr;</a></p>` : ''}
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * 12. Delivered Email
 */
export async function sendDeliveryEmail(user, order) {
  const name = user.firstName ? escapeHtml(user.firstName) : 'there';
  const orderNumber = escapeHtml(order.orderNumber);
  const subject = `Delivered: AJ SPORTS Order ${order.orderNumber}`;
  const text = `Hi ${user.firstName || 'there'},\n\nYour order ${order.orderNumber} has been delivered! We hope you love your new kicks.\n\nIf you have any feedback or didn't receive your package, please reach out to us right away.\n\nThe AJ SPORTS Team`;

  const html = emailLayout({
    title: subject,
    content: `
      <h2 style="margin-top: 0; color: #15803d; font-size: 20px; font-weight: 700;">Package Delivered!</h2>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">Hi ${name}, your order <strong>${orderNumber}</strong> has been successfully delivered. Time to lace up!</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(env.clientUrl)}/shop" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Leave a Review & Explore More</a>
      </div>
      <p style="color: #71717a; font-size: 13px;">If you haven't received your package despite this notification, please contact our support team immediately.</p>
    `,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

/**
 * Backward compatibility alias
 */
export const sendShippingUpdateEmail = sendShippedEmail;
