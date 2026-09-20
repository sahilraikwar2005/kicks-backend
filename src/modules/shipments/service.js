import crypto from 'node:crypto';
import Shipment from './model.js';
import ShipmentWebhookEvent from './webhook.model.js';
import Order from '../orders/model.js';
import User from '../users/model.js';
import { shippingConfig } from '../../config/shipping.js';
import {
  sendShippedEmail,
  sendOutForDeliveryEmail,
  sendDeliveryEmail,
} from '../../services/email.service.js';

const shipmentError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const configError = () => shipmentError('Shipping provider is not configured', 503);

const constantTimeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const payloadHash = (rawBody) => crypto.createHash('sha256').update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8')).digest('hex');

const verifyWebhookSignature = (rawBody, signature) => {
  if (!shippingConfig.webhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', shippingConfig.webhookSecret).update(rawBody).digest('hex');
  return constantTimeEqual(expected, signature);
};

const statusRank = {
  PENDING: 0,
  PROCESSING: 1,
  CREATED: 2,
  AWB_ASSIGNED: 3,
  SHIPPED: 4,
  PICKED_UP: 5,
  IN_TRANSIT: 6,
  OUT_FOR_DELIVERY: 7,
  DELIVERED: 8,
  CANCELLED: 9,
  FAILED: 9,
};

const statusMap = new Map([
  ['NEW', 'CREATED'],
  ['CREATED', 'CREATED'],
  ['AWB_ASSIGNED', 'AWB_ASSIGNED'],
  ['AWB ASSIGNED', 'AWB_ASSIGNED'],
  ['PICKED_UP', 'PICKED_UP'],
  ['PICKED UP', 'PICKED_UP'],
  ['IN_TRANSIT', 'IN_TRANSIT'],
  ['IN TRANSIT', 'IN_TRANSIT'],
  ['SHIPPED', 'SHIPPED'],
  ['OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY'],
  ['OUT FOR DELIVERY', 'OUT_FOR_DELIVERY'],
  ['DELIVERED', 'DELIVERED'],
  ['CANCELLED', 'CANCELLED'],
  ['CANCELED', 'CANCELLED'],
  ['FAILED', 'FAILED'],
]);

const normalizeShipmentStatus = (value, fallback = 'CREATED') => {
  const key = String(value || '').trim().toUpperCase();
  return statusMap.get(key) || fallback;
};

const assertEligibleOrder = (order) => {
  if (!order) throw shipmentError('Order not found', 404);
  if (!['CONFIRMED', 'PROCESSING', 'PACKED'].includes(order.status) || order.paymentStatus !== 'PAID') {
    throw shipmentError('Order is not eligible for shipping');
  }
  if (!order.shippingAddress || typeof order.shippingAddress !== 'object') throw shipmentError('Order shipping address is required');
  if (!Array.isArray(order.items) || order.items.length === 0) throw shipmentError('Order items are required');
};

async function shiprocketToken() {
  if (shippingConfig.provider !== 'shiprocket') throw shipmentError(`Unsupported shipping provider: ${shippingConfig.provider}`, 503);
  if (!shippingConfig.apiKey || !shippingConfig.apiSecret || !shippingConfig.pickupLocation) throw configError();

  const response = await fetch(`${shippingConfig.baseUrl}/v1/external/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: shippingConfig.apiKey, password: shippingConfig.apiSecret }),
  });
  if (!response.ok) throw shipmentError('Shipping provider authentication failed', 502);
  return (await response.json()).token;
}

const buildShiprocketPayload = (order) => {
  const packageConfig = shippingConfig.package;
  return {
    order_id: order.orderNumber,
    order_date: order.createdAt.toISOString(),
    pickup_location: shippingConfig.pickupLocation,
    billing_customer_name: order.user.firstName,
    billing_last_name: order.user.lastName,
    billing_email: order.user.email,
    billing_address: order.shippingAddress.addressLine1 || order.shippingAddress.street || '',
    billing_city: order.shippingAddress.city || '',
    billing_pincode: order.shippingAddress.postalCode || order.shippingAddress.pincode || '',
    billing_state: order.shippingAddress.state || '',
    billing_country: order.shippingAddress.country || 'India',
    billing_phone: order.user.phone || '',
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({ name: item.productName, sku: item.sku, units: item.quantity, selling_price: item.unitPrice })),
    sub_total: order.subtotal,
    length: packageConfig.lengthCm,
    breadth: packageConfig.breadthCm,
    height: packageConfig.heightCm,
    weight: packageConfig.weightKg,
  };
};

const safeTrackingPayload = (shipment) => {
  if (!shipment) return null;
  return {
    _id: shipment._id,
    order: shipment.order,
    provider: shipment.provider,
    shipmentId: shipment.shipmentId,
    awb: shipment.awb,
    trackingUrl: shipment.trackingUrl,
    status: shipment.status,
    events: shipment.events,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
};

const applyOrderShippingStatus = async (orderId, shipmentStatus, shipment = null) => {
  let updatedOrder = null;
  if (shipmentStatus === 'DELIVERED') {
    updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: { $in: ['SHIPPED', 'OUT_FOR_DELIVERY'] } },
      { $set: { status: 'DELIVERED' } },
      { new: true },
    );
  } else if (shipmentStatus === 'OUT_FOR_DELIVERY') {
    updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: 'SHIPPED' },
      { $set: { status: 'OUT_FOR_DELIVERY' } },
      { new: true },
    );
  } else if (['CREATED', 'AWB_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'SHIPPED'].includes(shipmentStatus)) {
    updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: { $in: ['CONFIRMED', 'PROCESSING', 'PACKED'] } },
      { $set: { status: 'SHIPPED' } },
      { new: true },
    );
  }

  if (updatedOrder) {
    try {
      const customer = updatedOrder.customerSnapshot?.email ? updatedOrder.customerSnapshot : await User.findById(updatedOrder.user).select('firstName lastName email');
      if (customer?.email) {
        if (updatedOrder.status === 'DELIVERED') {
          await sendDeliveryEmail(customer, updatedOrder);
        } else if (updatedOrder.status === 'OUT_FOR_DELIVERY') {
          await sendOutForDeliveryEmail(customer, updatedOrder, shipment || {});
        } else if (updatedOrder.status === 'SHIPPED') {
          await sendShippedEmail(customer, updatedOrder, shipment || {});
        }
      }
    } catch (emailErr) {
      if (emailErr.statusCode !== 503) {
        console.error(`Failed to send shipping (${shipmentStatus}) email:`, emailErr.message);
      }
    }
  }
};

export const shipmentService = {
  async createForOrder(orderId) {
    const order = await Order.findById(orderId).populate('user');
    assertEligibleOrder(order);

    let shipment;
    try {
      shipment = await Shipment.create({
        order: order._id,
        provider: shippingConfig.provider,
        status: 'PROCESSING',
        events: [{ status: 'PROCESSING', source: 'system', metadata: { reason: 'shipment_create_requested' } }],
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await Shipment.findOne({ order: order._id });
      if (!existing) throw error;
      if (existing.status !== 'FAILED') return existing;
      shipment = await Shipment.findOneAndUpdate(
        { _id: existing._id, status: 'FAILED' },
        {
          $set: { status: 'PROCESSING', failureReason: '' },
          $push: { events: { status: 'PROCESSING', source: 'system', metadata: { reason: 'shipment_retry_requested' } } },
        },
        { new: true },
      );
      if (!shipment) return Shipment.findOne({ order: order._id });
    }

    try {
      const token = await shiprocketToken();
      const response = await fetch(`${shippingConfig.baseUrl}/v1/external/orders/create/adhoc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildShiprocketPayload(order)),
      });
      if (!response.ok) throw shipmentError('Shipping provider rejected shipment creation', 502);

      const raw = await response.json();
      const shipmentId = String(raw.shipment_id || raw.order_id || '');
      const awb = String(raw.awb_code || raw.awb || '');
      const status = awb ? 'AWB_ASSIGNED' : 'CREATED';
      const trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : '';

      const updatedShipment = await Shipment.findByIdAndUpdate(
        shipment._id,
        {
          $set: { shipmentId, awb, trackingUrl, status, raw, failureReason: '' },
          $push: { events: { status, source: shippingConfig.provider, providerReference: shipmentId || awb, metadata: { providerStatus: raw.status || '' } } },
        },
        { new: true },
      );

      try {
        await applyOrderShippingStatus(order._id, status, updatedShipment);
      } catch (error) {
        await Shipment.updateOne(
          { _id: shipment._id },
          {
            $set: {
              metadata: { ...(updatedShipment.metadata || {}), reconciliationRequired: true, orderUpdateError: error.message },
            },
          },
        );
      }

      return updatedShipment;
    } catch (error) {
      await Shipment.updateOne(
        { _id: shipment._id },
        {
          $set: { status: 'FAILED', failureReason: error.message || 'Shipping provider failed' },
          $push: { events: { status: 'FAILED', source: shippingConfig.provider, metadata: { error: error.message || 'Shipping provider failed' } } },
        },
      );
      throw error;
    }
  },

  async getForCustomer(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) throw shipmentError('Order not found', 404);
    const shipment = await Shipment.findOne({ order: order._id }).lean();
    return safeTrackingPayload(shipment);
  },

  async handleWebhook(rawBody, signature, payload) {
    const incomingBody = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    if (!incomingBody) throw shipmentError('Webhook body is required');
    if (!shippingConfig.webhookSecret) throw configError();
    if (!verifyWebhookSignature(incomingBody, signature)) throw shipmentError('Invalid shipping webhook signature');

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw shipmentError('Malformed shipping webhook payload');

    const incomingHash = payloadHash(incomingBody);
    const eventType = payload.event || payload.current_status || payload.status || 'shipment.status';
    const eventId = String(payload.event_id || payload.id || `${payload.shipment_id || payload.order_id || payload.awb || 'unknown'}:${eventType}:${incomingHash}`);
    let eventRecord;
    try {
      eventRecord = await ShipmentWebhookEvent.create({
        provider: shippingConfig.provider,
        eventId,
        eventType,
        payloadHash: incomingHash,
        status: 'RECEIVED',
        attempts: 1,
        metadata: { provider: shippingConfig.provider },
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      eventRecord = await ShipmentWebhookEvent.findOne({ provider: shippingConfig.provider, eventId });
    }

    if (eventRecord.payloadHash && eventRecord.payloadHash !== incomingHash) throw shipmentError('Shipping webhook payload hash mismatch', 409);
    if (eventRecord.status === 'PROCESSED') return { received: true, duplicate: true, eventId };
    if (eventRecord.status === 'PROCESSING') return { received: true, duplicate: true, eventId, status: 'PROCESSING' };

    const claimed = await ShipmentWebhookEvent.findOneAndUpdate(
      { _id: eventRecord._id, status: { $in: ['RECEIVED', 'FAILED'] } },
      { $set: { status: 'PROCESSING', lastError: '', payloadHash: incomingHash }, $inc: { attempts: 1 } },
      { new: true },
    );
    if (!claimed) return { received: true, duplicate: true, eventId };

    try {
      const providerStatus = normalizeShipmentStatus(payload.current_status || payload.status || payload.shipment_status, '');
      if (!providerStatus) {
        await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'PROCESSED', processedAt: new Date() } });
        return { received: true, ignored: true, eventId };
      }

      const shipment = await Shipment.findOne({
        $or: [
          { shipmentId: String(payload.shipment_id || '') },
          { awb: String(payload.awb || payload.awb_code || '') },
        ],
      });

      if (!shipment) {
        await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), metadata: { ignored: 'SHIPMENT_NOT_FOUND' } } });
        return { received: true, ignored: true, eventId };
      }

      if ((statusRank[shipment.status] || 0) > (statusRank[providerStatus] || 0)) {
        await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), metadata: { ignored: 'BACKWARD_TRANSITION' } } });
        return { received: true, ignored: true, eventId };
      }

      const updatedShipment = await Shipment.findByIdAndUpdate(
        shipment._id,
        {
          $set: {
            status: providerStatus,
            awb: payload.awb || payload.awb_code || shipment.awb,
            trackingUrl: payload.tracking_url || shipment.trackingUrl,
          },
          $push: {
            events: {
              status: providerStatus,
              occurredAt: payload.event_time ? new Date(payload.event_time) : new Date(),
              providerReference: String(payload.shipment_id || payload.awb || payload.awb_code || ''),
              source: shippingConfig.provider,
              metadata: { providerStatus: payload.current_status || payload.status || payload.shipment_status || '' },
            },
          },
        },
        { new: true },
      );
      await applyOrderShippingStatus(shipment.order, providerStatus, updatedShipment);
      await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), lastError: '' } });
      return { received: true, eventId, status: providerStatus };
    } catch (error) {
      await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'FAILED', lastError: error.message || 'Shipping webhook failed' } });
      return { received: true, retryable: true, eventId, status: 'FAILED', error: error.message };
    }
  },
};
