import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

// Sentry error tracking. Disabled unless SENTRY_DSN is set, so local
// development stays clean. Secrets are scrubbed in beforeSend — passwords,
// OTPs, tokens, cookies and credentials must never leave the server.
const SENSITIVE_KEYS = ['password', 'newpassword', 'currentpassword', 'confirmpassword', 'otp', 'code', 'resettoken', 'token', 'secret', 'api_secret', 'api_key', 'webhook_secret', 'smtp', 'authorization', 'cookie', 'set-cookie', 'pass'];

const scrubValue = (key, value) => {
  if (SENSITIVE_KEYS.some((needle) => String(key || '').toLowerCase().includes(needle))) return '[REDACTED]';
  return value;
};

const scrubObject = (input, depth = 0) => {
  if (depth > 4 || input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((item) => scrubObject(item, depth + 1));
  if (typeof input !== 'object') return input;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = scrubObject(scrubValue(key, value), depth + 1);
  }
  return output;
};

export function initSentry() {
  if (!env.sentryDsn) return false;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv || 'development',
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) event.request.headers = scrubObject(event.request.headers);
      if (event.request?.cookies) event.request.cookies = '[REDACTED]';
      if (event.request?.data) event.request.data = scrubObject(event.request.data);
      if (event.extra) event.extra = scrubObject(event.extra);
      return event;
    },
  });
  return true;
}

export function reportError(error, context = {}) {
  if (!env.sentryDsn) return;
  try {
    Sentry.withScope((scope) => {
      if (context.requestId) scope.setTag('requestId', String(context.requestId));
      if (context.route) scope.setTag('route', String(context.route));
      scope.setExtra('context', scrubObject(context));
      Sentry.captureException(error);
    });
  } catch {
    // Error reporting must never break request handling.
  }
}
