import { env } from './env.js';

export const shippingConfig = {
  provider: env.shippingProvider,
  mockShippingEnabled: env.mockShippingEnabled,
  apiKey: env.shippingApiKey,
  apiSecret: env.shippingApiSecret,
  pickupLocation: env.shippingPickupLocation,
  webhookSecret: env.shippingWebhookSecret,
  baseUrl: 'https://api.shiprocket.in',
  package: { weightKg: env.shippingWeightKg, lengthCm: env.shippingLengthCm, breadthCm: env.shippingBreadthCm, heightCm: env.shippingHeightCm },
};

export const shippingProviderMap = {
  shiprocket: 'shiprocket',
  mock: 'mock',
  delhivery: 'delhivery',
};
