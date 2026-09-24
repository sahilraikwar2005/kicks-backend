import crypto from 'node:crypto';
import Shipment from './model.js';
import ShipmentWebhookEvent from './webhook.model.js';
import Order from '../orders/model.js';
import User from '../users/model.js';
import { shippingConfig } from '../../config/shipping.js';
import { env } from '../../config/env.js';
import {
  MOCK_PROVIDER_NAME,
  MOCK_ALLOWED_TRANSITIONS,
  MOCK_SIMULATION_EVENTS,
  buildMockLabelHtml,
  createMockShipmentPayload,
  generateMockAwb,
  scheduleMockPickupPayload,
} from './providers/mock.provider.js';
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
  READY_FOR_PICKUP: 3,
  PICKUP_SCHEDULED: 4,
  SHIPPED: 4,
  PICKED_UP: 5,
  IN_TRANSIT: 6,
  OUT_FOR_DELIVERY: 7,
  NDR: 7,
  RTO_INITIATED: 7,
  RTO_IN_TRANSIT: 7,
  DELIVERED: 8,
  RETURNED: 8,
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
  ['READY_FOR_PICKUP', 'READY_FOR_PICKUP'],
  ['READY FOR PICKUP', 'READY_FOR_PICKUP'],
  ['PICKUP_SCHEDULED', 'PICKUP_SCHEDULED'],
  ['PICKUP SCHEDULED', 'PICKUP_SCHEDULED'],
  ['NDR', 'NDR'],
  ['UNDELIVERED', 'NDR'],
  ['NOT DELIVERED', 'NDR'],
  ['RTO_INITIATED', 'RTO_INITIATED'],
  ['RTO', 'RTO_INITIATED'],
  ['RTO_IN_TRANSIT', 'RTO_IN_TRANSIT'],
  ['RETURNED', 'RETURNED'],
  ['RTO_DELIVERED', 'RETURNED'],
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

const isMockShippingActive = () => shippingConfig.provider === 'mock' && shippingConfig.mockShippingEnabled !== false;

const assertMockShipment = (shipment) => {
  if (!isMockShippingActive()) throw shipmentError('Mock shipping is disabled', 503);
  if (!shipment) throw shipmentError('Shipment not found', 404);
  if (shipment.provider !== MOCK_PROVIDER_NAME || !shipment.isTest) {
    throw shipmentError('Mock simulation is only available for MOCK test shipments', 400);
  }
};

// Provider-independent event applier shared by real webhooks and mock
// simulations: persist normalized status + timeline event, then map onto the
// order through the established shipping-status path.
const applyCarrierStatusChange = async (shipment, {
  status,
  source,
  providerReference = '',
  occurredAt = null,
  metadata = {},
  awb = null,
  trackingUrl = null,
} = {}) => {
  const updated = await Shipment.findByIdAndUpdate(
    shipment._id,
    {
      $set: { status, ...(awb ? { awb } : {}), ...(trackingUrl ? { trackingUrl } : {}) },
      $push: {
        events: {
          status,
          occurredAt: occurredAt || new Date(),
          providerReference,
          source,
          metadata,
        },
      },
    },
    { new: true },
  );
  await applyOrderShippingStatus(shipment.order, status, updated);
  return updated;
};

const markShipmentFailed = async (shipmentId, message, source) => {
  await Shipment.updateOne(
    { _id: shipmentId },
    {
      $set: { status: 'FAILED', failureReason: message },
      $push: { events: { status: 'FAILED', source, metadata: { error: message } } },
    },
  );
};

// Builds and persists a clearly-fake shipment for a paid, eligible order.
// No order status change here: the order stays PACKED/CONFIRMED/PROCESSING
// until a simulated carrier event moves it through the shared event path.
const finalizeMockShipment = async (pendingShipment, order) => {
  const payload = createMockShipmentPayload();
  let { shipmentId, awb } = payload;
  for (let attempt = 0; attempt < 5 && await Shipment.exists({ awb }); attempt += 1) {
    awb = generateMockAwb();
  }
  const trackingUrl = `${env.clientUrl || ''}/account/orders/${order._id}`.replace(/^\//, '/');
  const labelHtml = buildMockLabelHtml(order, { shipmentId, awb });
  return Shipment.findByIdAndUpdate(
    pendingShipment._id,
    {
      $set: {
        provider: MOCK_PROVIDER_NAME,
        isTest: true,
        shipmentId,
        awb,
        trackingUrl,
        status: 'READY_FOR_PICKUP',
        labelHtml,
        estimatedDeliveryDate: payload.estimatedDeliveryDate,
        pickup: { requestId: '', status: '', date: null, slot: '' },
        raw: { mock: true, provider: MOCK_PROVIDER_NAME, isTest: true, createdAt: payload.createdAt },
        failureReason: '',
      },
      $push: {
        events: {
          $each: [
            { status: 'READY_FOR_PICKUP', source: MOCK_PROVIDER_NAME, providerReference: shipmentId, metadata: { awb } },
            { status: 'AWB_ASSIGNED', source: MOCK_PROVIDER_NAME, providerReference: awb, metadata: { mock: true } },
          ],
        },
      },
    },
    { new: true },
  );
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
      // Mock provider: pure local computation, zero network. Real-courier
      // paths below stay untouched.
      if (shippingConfig.provider === 'mock') {
        if (!isMockShippingActive()) {
          const message = 'Mock shipping is disabled';
          await markShipmentFailed(shipment._id, message, MOCK_PROVIDER_NAME);
          throw shipmentError(message, 503);
        }
        return finalizeMockShipment(shipment, order);
      }

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

  // ---- Mock provider lifecycle (test only, zero network) ----

  async scheduleMockPickup(shipmentId) {
    const shipment = await Shipment.findById(shipmentId);
    assertMockShipment(shipment);
    if (shipment.pickup?.requestId) return shipment;
    if (shipment.status !== 'READY_FOR_PICKUP') {
      throw shipmentError(`Pickup can only be scheduled from READY_FOR_PICKUP (current: ${shipment.status})`);
    }
    const pickup = scheduleMockPickupPayload();
    return Shipment.findByIdAndUpdate(
      shipment._id,
      {
        $set: { status: 'PICKUP_SCHEDULED', pickup },
        $push: {
          events: {
            status: 'PICKUP_SCHEDULED',
            source: MOCK_PROVIDER_NAME,
            providerReference: pickup.requestId,
            metadata: { pickupDate: pickup.date, slot: pickup.slot },
          },
        },
      },
      { new: true },
    );
  },

  async simulateMockEvent(shipmentId, event) {
    const shipment = await Shipment.findById(shipmentId);
    assertMockShipment(shipment);
    const target = MOCK_SIMULATION_EVENTS[String(event || '').toLowerCase()];
    if (!target) throw shipmentError(`Unknown mock event: ${event}`);
    // Same-state replay is an idempotent no-op: no write, no side effects.
    if (target === shipment.status) return { duplicate: true, eventId: null, status: shipment.status };
    const allowed = MOCK_ALLOWED_TRANSITIONS[shipment.status] || [];
    if (!allowed.includes(target)) {
      throw shipmentError(`Cannot move mock shipment from ${shipment.status} to ${target}`);
    }

    // Deterministic event id: exact replays dedupe, legitimate repeats
    // (NDR → OFD → NDR) get a per-occurrence suffix from the timeline.
    const priorCount = (shipment.events || []).filter(
      (item) => item?.source === MOCK_PROVIDER_NAME && item?.metadata?.mockEvent === event,
    ).length;
    const eventId = `mock:${shipment.shipmentId}:${event}:${priorCount}`;

    let eventRecord;
    try {
      eventRecord = await ShipmentWebhookEvent.create({
        provider: MOCK_PROVIDER_NAME,
        eventId,
        eventType: event,
        payloadHash: `mock:${shipment.shipmentId}:${target}:${priorCount}`,
        status: 'RECEIVED',
        attempts: 1,
        metadata: { provider: MOCK_PROVIDER_NAME, mockEvent: event },
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      return { duplicate: true, eventId, status: shipment.status };
    }

    const claimed = await ShipmentWebhookEvent.findOneAndUpdate(
      { _id: eventRecord._id, status: 'RECEIVED' },
      { $set: { status: 'PROCESSING', lastError: '' }, $inc: { attempts: 1 } },
      { new: true },
    );
    if (!claimed) return { duplicate: true, eventId, status: shipment.status };

    try {
      const updated = await applyCarrierStatusChange(shipment, {
        status: target,
        source: MOCK_PROVIDER_NAME,
        providerReference: shipment.shipmentId,
        metadata: { mockEvent: event },
      });
      await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), lastError: '' } });
      return { shipment: updated, eventId, status: target };
    } catch (error) {
      await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'FAILED', lastError: error.message || 'Mock event failed' } });
      throw error;
    }
  },

  async getShipmentLabel(shipmentId) {
    const shipment = await Shipment.findById(shipmentId).select('shipmentId awb labelHtml provider isTest').lean();
    if (!shipment || !shipment.labelHtml) throw shipmentError('Shipping label not found', 404);
    return shipment;
  },

  async listAdmin({ page = 1, limit = 20, status, provider, search } = {}) {    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (status) {
      query.status = status.toUpperCase();
    }
    if (provider) {
      query.provider = provider.toLowerCase();
    }

    if (search && String(search).trim()) {
      const searchTerm = String(search).trim();
      const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const matchedOrders = await Order.find({
        $or: [
          { orderNumber: searchRegex },
          { 'customerSnapshot.email': searchRegex },
          { 'customerSnapshot.firstName': searchRegex },
          { 'customerSnapshot.lastName': searchRegex },
          { 'shippingAddress.phone': searchRegex },
          { 'shippingAddress.postalCode': searchRegex },
        ],
      }).select('_id').lean();

      const matchedOrderIds = matchedOrders.map((o) => o._id);

      query.$or = [
        { awb: searchRegex },
        { shipmentId: searchRegex },
        { order: { $in: matchedOrderIds } },
      ];
    }

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .select('-raw')
        .populate({
          path: 'order',
          select: 'orderNumber grandTotal status paymentStatus customerSnapshot shippingAddress items createdAt',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Shipment.countDocuments(query),
    ]);

    return {
      shipments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  },

  async getAdminDetails(id) {
    let shipment = null;
    if (id && String(id).match(/^[0-9a-fA-F]{24}$/)) {
      shipment = await Shipment.findById(id)
        .select('-raw')
        .populate({
          path: 'order',
          select: 'orderNumber grandTotal subtotal tax shippingCharge discountAmount status paymentStatus customerSnapshot shippingAddress items createdAt updatedAt',
        })
        .lean();

      if (!shipment) {
        shipment = await Shipment.findOne({ order: id })
          .select('-raw')
          .populate({
            path: 'order',
            select: 'orderNumber grandTotal subtotal tax shippingCharge discountAmount status paymentStatus customerSnapshot shippingAddress items createdAt updatedAt',
          })
          .lean();
      }
    }

    if (!shipment) {
      const error = shipmentError('Shipment not found', 404);
      throw error;
    }

    return shipment;
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

      await applyCarrierStatusChange(shipment, {
        status: providerStatus,
        source: shippingConfig.provider,
        providerReference: String(payload.shipment_id || payload.awb || payload.awb_code || ''),
        occurredAt: payload.event_time ? new Date(payload.event_time) : null,
        metadata: { providerStatus: payload.current_status || payload.status || payload.shipment_status || '' },
        awb: payload.awb || payload.awb_code || null,
        trackingUrl: payload.tracking_url || null,
      });
      await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'PROCESSED', processedAt: new Date(), lastError: '' } });
      return { received: true, eventId, status: providerStatus };
    } catch (error) {
      await ShipmentWebhookEvent.updateOne({ _id: claimed._id }, { $set: { status: 'FAILED', lastError: error.message || 'Shipping webhook failed' } });
      return { received: true, retryable: true, eventId, status: 'FAILED', error: error.message };
    }
  },
};
