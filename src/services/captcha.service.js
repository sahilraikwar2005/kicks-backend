import { env } from '../config/env.js';

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

function captchaError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Verifies a reCAPTCHA token server-side. Never trust a frontend boolean.
// Throws 400 for missing/invalid/expired tokens and 503 when the provider
// cannot be reached or the service is not configured (fail closed).
export async function verifyCaptchaToken(token, remoteIp) {
  const responseToken = String(token || '').trim();
  if (!responseToken) {
    throw captchaError('CAPTCHA verification is required.', 400);
  }

  const secret = String(process.env.RECAPTCHA_SECRET_KEY || env.recaptchaSecretKey || '').trim();
  if (!secret) {
    throw captchaError('Verification service is not configured. Please try again later.', 503);
  }

  const params = new URLSearchParams({ secret, response: responseToken });
  if (remoteIp) params.set('remoteip', String(remoteIp));

  let response = null;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw captchaError('Verification service is unavailable. Please try again.', 503);
  }

  if (!response || response.ok !== true) {
    throw captchaError('Verification service returned an error. Please try again.', 502);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw captchaError('Verification service returned an invalid response. Please try again.', 502);
  }

  if (!payload || payload.success !== true) {
    const codes = Array.isArray(payload?.['error-codes']) ? payload['error-codes'] : [];
    if (codes.includes('timeout-or-duplicate')) {
      throw captchaError('CAPTCHA has expired. Please complete it again.', 400);
    }
    throw captchaError('CAPTCHA verification failed. Please try again.', 400);
  }

  return true;
}
