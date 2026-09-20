import { shippingConfig } from '../config/shipping.js';

export async function createShipment({ orderId, address, weightKg = 1 }) {
  return {
    provider: shippingConfig.provider,
    orderId,
    trackingNumber: `KICKS-${Date.now()}`,
    status: 'PENDING',
    weightKg,
    address,
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function fetchTrackingStatus(trackingNumber) {
  return {
    trackingNumber,
    status: 'PENDING',
    events: [],
  };
}
