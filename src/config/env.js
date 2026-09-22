import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'CLIENT_URL',
  'ADMIN_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SHIPPING_API_KEY',
  'SHIPPING_API_SECRET',
  'SHIPPING_WEBHOOK_SECRET',
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');

if (missingEnvVars.length > 0 && isProduction) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv,
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  clientUrl: process.env.CLIENT_URL,
  adminUrl: process.env.ADMIN_URL,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'AJ SPORTS <noreply@example.com>',
  shippingProvider: process.env.SHIPPING_PROVIDER || 'shiprocket',
  shippingApiKey: process.env.SHIPPING_API_KEY || '',
  shippingApiSecret: process.env.SHIPPING_API_SECRET || '',
  shippingPickupLocation: process.env.SHIPPING_PICKUP_LOCATION || '',
  shippingWebhookSecret: process.env.SHIPPING_WEBHOOK_SECRET || '',
  shippingWeightKg: Number(process.env.SHIPPING_WEIGHT_KG) || 1,
  shippingLengthCm: Number(process.env.SHIPPING_LENGTH_CM) || 10,
  shippingBreadthCm: Number(process.env.SHIPPING_BREADTH_CM) || 10,
  shippingHeightCm: Number(process.env.SHIPPING_HEIGHT_CM) || 10,
  sessionSecret: process.env.SESSION_SECRET || (isProduction ? '' : 'development-session-secret'),
  logLevel: process.env.LOG_LEVEL || 'info',
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB) || 5,
  maxRequestBodySize: process.env.MAX_REQUEST_BODY_SIZE || '10mb',
  captchaEnabled: process.env.CAPTCHA_ENABLED || '',
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY || '',
};
