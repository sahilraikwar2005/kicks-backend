import Joi from 'joi';
import AdminSetting from './settings.model.js';

const stringSetting = (min, max) => Joi.string().trim().min(min).max(max).required();
const optionalStringSetting = (max) => Joi.string().trim().max(max).allow('').required();

export const SETTING_DEFINITIONS = {
  'store.name': { defaultValue: 'AJ SPORTS', schema: stringSetting(1, 80) },
  'store.tagline': { defaultValue: 'Premium sneakers for movement and everyday expression', schema: stringSetting(1, 160) },
  'store.description': { defaultValue: 'AJ SPORTS brings together premium craftsmanship, performance-driven design, and effortless street style.', schema: optionalStringSetting(500) },
  'store.logoUrl': { defaultValue: '', schema: Joi.string().trim().uri().max(500).allow('').required() },
  'store.currency': { defaultValue: 'INR', schema: stringSetting(1, 10) },
  'store.country': { defaultValue: 'India', schema: stringSetting(1, 60) },
  'store.timezone': { defaultValue: 'Asia/Kolkata', schema: stringSetting(1, 60) },
  'contact.email': { defaultValue: 'support@kicks.example', schema: Joi.string().trim().email({ tlds: false }).max(120).allow('').required() },
  'contact.phone': { defaultValue: '+91 98765 43210', schema: optionalStringSetting(30) },
  'contact.address': { defaultValue: '12 MG Road, Bengaluru, India', schema: optionalStringSetting(240) },
  'contact.hours': { defaultValue: '', schema: optionalStringSetting(120) },
  'checkout.reviewsEnabled': { defaultValue: true, schema: Joi.boolean().required() },
  'notifications.orderEmails': { defaultValue: true, schema: Joi.boolean().required() },
  'notifications.paymentEmails': { defaultValue: true, schema: Joi.boolean().required() },
  'notifications.shippingEmails': { defaultValue: true, schema: Joi.boolean().required() },
  'notifications.deliveryEmails': { defaultValue: true, schema: Joi.boolean().required() },
};

const invalidSettingError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateSettingValue = (key, value) => {
  const definition = SETTING_DEFINITIONS[key];
  if (!definition) throw invalidSettingError(`Unknown setting: ${key}`);
  const { error, value: clean } = definition.schema.validate(value);
  if (error) throw invalidSettingError(`Invalid value for ${key}: ${error.details[0]?.message || 'validation failed'}`);
  return clean;
};

export const adminSettingsService = {
  async list() {
    const stored = await AdminSetting.find().lean();
    const byKey = new Map(stored.map((item) => [item.key, item]));
    return Object.entries(SETTING_DEFINITIONS)
      .map(([key, definition]) => {
        const existing = byKey.get(key);
        if (existing) return { ...existing, persisted: true };
        return { key, value: definition.defaultValue, description: '', persisted: false };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  },

  async get(key) {
    const definition = SETTING_DEFINITIONS[key];
    if (!definition) throw invalidSettingError(`Unknown setting: ${key}`, 404);
    const existing = await AdminSetting.findOne({ key }).lean();
    return existing || { key, value: definition.defaultValue, description: '', persisted: false };
  },

  async getValue(key) {
    const setting = await adminSettingsService.get(key);
    return setting?.value ?? SETTING_DEFINITIONS[key].defaultValue;
  },

  async upsert(key, value, description = '', updatedBy = null) {
    const clean = validateSettingValue(key, value);
    return AdminSetting.findOneAndUpdate(
      { key },
      { $set: { value: clean, description: String(description || '').slice(0, 200), updatedBy } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  },

  async isEmailEnabled(category) {
    const value = await adminSettingsService.getValue(`notifications.${category}Emails`);
    return value !== false;
  },

  async isReviewsEnabled() {
    const value = await adminSettingsService.getValue('checkout.reviewsEnabled');
    return value !== false;
  },
};
