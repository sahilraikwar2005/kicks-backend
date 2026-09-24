import crypto from 'node:crypto';

// MockShippingProvider — clearly-fake, network-free courier stand-in for
// development/testing. It NEVER calls any real courier API, even if real
// credentials exist in the environment: every function below is pure local
// computation (unique IDs, timestamps, label HTML).
//
// Replacement contract for production (Delhivery): implement the same three
// functions against the real carrier API and select the implementation via
// SHIPPING_PROVIDER. Order workflow, event handling, statuses, the Shipment
// model and the admin UI all stay untouched.

export const MOCK_PROVIDER_NAME = 'MOCK';

const randomDigits = (length) => {
  let out = '';
  while (out.length < length) out += String(crypto.randomInt(0, 1000000000)).padStart(9, '0');
  return out.slice(0, length);
};

const randomHex = (length) => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();

// Clearly fake, unique AWB: MOCK + 10 digits (e.g. MOCK8392017465).
export function generateMockAwb() {
  return `MOCK${randomDigits(10)}`;
}

export function generateMockShipmentId() {
  return `MOCK-SHP-${randomHex(8)}`;
}

export function generateMockPickupId() {
  return `MOCK-PCK-${randomHex(8)}`;
}

const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Printable test-only label. Rendered from order data, never a courier asset.
export function buildMockLabelHtml(order, shipment) {
  const address = order.shippingAddress || {};
  const customer = order.customerSnapshot || {};
  const name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
  const rows = (Array.isArray(order.items) ? order.items : []).map((item) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(item.productName || item.name || 'Item')} (${escapeHtml(item.size || '')} / ${escapeHtml(item.color || '')}) × ${Number(item.quantity || 1)}</td>
      </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Mock shipping label ${escapeHtml(shipment.shipmentId)}</title></head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;max-width:560px;">
  <div style="border:3px dashed #b91c1c;border-radius:8px;padding:12px;text-align:center;background:#fef2f2;">
    <strong>TEST / MOCK — NOT FOR REAL SHIPPING</strong><br>AJ SPORTS · MOCK SHIPPING · provider: MOCK · isTest: true
  </div>
  <h2 style="margin:16px 0 4px;">AJ SPORTS — TEST SHIPMENT</h2>
  <p style="margin:0;font-size:13px;">Order: <strong>${escapeHtml(order.orderNumber)}</strong></p>
  <p style="margin:4px 0;font-size:13px;">Shipment: <strong>${escapeHtml(shipment.shipmentId)}</strong> · AWB: <strong>${escapeHtml(shipment.awb)}</strong></p>
  <hr>
  <p style="font-size:13px;"><strong>Deliver to:</strong><br>${escapeHtml(name)}<br>${escapeHtml(address.addressLine1 || address.street || '')}<br>${escapeHtml(address.city || '')}, ${escapeHtml(address.state || '')} — ${escapeHtml(address.postalCode || address.pincode || '')}<br>Phone: ${escapeHtml(maskPhone(address.phone || customer.phone))}</p>
  <hr>
  <table style="width:100%;border-collapse:collapse;">${rows}</table>
  <hr>
  <p style="font-size:11px;color:#555;">Generated ${new Date().toUTCString()} · mock record only, no courier involved.</p>
</body></html>`;
}

// Structured mock creation payload. Callers persist it; nothing here touches
// the database or the network.
export function createMockShipmentPayload() {
  const now = new Date();
  const estimated = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  return {
    provider: MOCK_PROVIDER_NAME,
    isTest: true,
    shipmentId: generateMockShipmentId(),
    awb: generateMockAwb(),
    status: 'READY_FOR_PICKUP',
    trackingUrl: '',
    estimatedDeliveryDate: estimated,
    createdAt: now,
  };
}

// Realistic mock pickup values (next-day slot).
export function scheduleMockPickupPayload() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(11, 0, 0, 0);
  return {
    requestId: generateMockPickupId(),
    status: 'SCHEDULED',
    date,
    slot: '11:00–14:00',
    provider: MOCK_PROVIDER_NAME,
  };
}

// Admin simulation buttons → internal carrier statuses. Delhivery events will
// map into these same statuses later, so the downstream path is shared.
export const MOCK_SIMULATION_EVENTS = {
  pickup: 'PICKED_UP',
  shipped: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  ndr: 'NDR',
  rto: 'RTO_INITIATED',
  rto_transit: 'RTO_IN_TRANSIT',
  returned: 'RETURNED',
};

// Valid mock shipment transitions (adjacency). Terminal states accept nothing
// new; everything else follows the forward lifecycle with NDR/RTO branches.
export const MOCK_ALLOWED_TRANSITIONS = {
  READY_FOR_PICKUP: ['PICKUP_SCHEDULED', 'PICKED_UP'],
  PICKUP_SCHEDULED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'NDR'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'NDR'],
  NDR: ['OUT_FOR_DELIVERY', 'RTO_INITIATED'],
  RTO_INITIATED: ['RTO_IN_TRANSIT'],
  RTO_IN_TRANSIT: ['RETURNED'],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
  FAILED: [],
};
