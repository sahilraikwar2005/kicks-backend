import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import Invoice from './model.js';
import Order from '../orders/model.js';
import User from '../users/model.js';
import { sendInvoiceEmail } from '../../services/email.service.js';

function createPdf(order, invoiceNumber, customer) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 50 });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(22).text('AJ SPORTS', { bold: true });
    document.fontSize(14).text('Commercial Invoice');
    document.moveDown().fontSize(10).text(`Invoice number: ${invoiceNumber}`).text(`Invoice date: ${new Date().toISOString().slice(0, 10)}`).text(`Payment status: ${order.paymentStatus}`);
    document.moveDown().text(`Customer: ${customer.firstName} ${customer.lastName}`).text(`Email: ${customer.email}`);
    document.moveDown().text(`Shipping address: ${JSON.stringify(order.shippingAddress)}`);
    document.moveDown().text('Products');
    order.items.forEach((item) => document.text(`${item.productName} | SKU: ${item.sku} | Size: ${item.size} | Qty: ${item.quantity} | Unit: INR ${item.unitPrice} | Discount: INR ${item.discount}`));
    document.moveDown().text(`Subtotal: INR ${order.subtotal}`).text(`Shipping: INR ${order.shippingCharge}`).text(`Discount: INR ${order.discountAmount}`).text(`Final amount: INR ${order.grandTotal}`);
    document.end();
  });
}

export const invoiceService = {
  async generate(orderId) {
    const order = await Order.findById(orderId);
    if (!order) { const error = new Error('Order not found'); error.statusCode = 404; throw error; }
    if (order.paymentStatus !== 'PAID') { const error = new Error('Invoice is available only after successful payment'); error.statusCode = 400; throw error; }
    const existing = await Invoice.findOne({ order: order._id });
    if (existing) return existing;
    const customer = await User.findById(order.user).select('firstName lastName email');
    const invoiceNumber = `KICKS-INV-${Date.now()}`;
    const directory = path.resolve('uploads', 'invoices');
    await fs.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, `${invoiceNumber}.pdf`);
    await fs.writeFile(filePath, await createPdf(order, invoiceNumber, customer));
    const invoice = await Invoice.create({ order: order._id, invoiceNumber, filePath });
    try {
      await sendInvoiceEmail(customer, invoice, filePath);
      invoice.status = 'SENT';
      await invoice.save();
    } catch (error) {
      if (error.statusCode !== 503) throw error;
    }
    return invoice;
  },

  async getForCustomer(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) { const error = new Error('Order not found'); error.statusCode = 404; throw error; }
    return this.generate(order._id);
  },

  async getForAdmin(orderId) { return this.generate(orderId); },

  async resend(orderId) {
    const invoice = await this.generate(orderId);
    const order = await Order.findById(orderId);
    const customer = await User.findById(order.user).select('firstName lastName email');
    await sendInvoiceEmail(customer, invoice, invoice.filePath);
    invoice.status = 'SENT';
    await invoice.save();
    return invoice;
  },
};
