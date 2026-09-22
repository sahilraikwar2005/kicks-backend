import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { transporter } from '../src/config/email.js';
import app from '../src/app.js';
import User from '../src/modules/users/model.js';
import RegistrationRequest from '../src/modules/auth/registration.model.js';
import { authService } from '../src/modules/auth/service.js';
import { verifyCaptchaToken } from '../src/services/captcha.service.js';
import {
  OTP_MAX_ATTEMPTS,
  generateOtp,
  maskEmail,
  normalizeEmail,
  registrationService,
  splitFullName,
} from '../src/modules/auth/registration.service.js';

const originalFetch = globalThis.fetch;
const originalSendMail = transporter.sendMail;

let mailOutbox = [];
let captchaMode = 'valid';

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}/api/v1`;

test.before(async () => {
  await connectDatabase();
  process.env.RECAPTCHA_SECRET_KEY = 'test-secret-key';
  env.smtpUser = 'mock-user@example.com';
  env.smtpPassword = 'mock-password';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => {
      if (captchaMode === 'valid') return { success: true };
      if (captchaMode === 'expired') return { success: false, 'error-codes': ['timeout-or-duplicate'] };
      if (captchaMode === 'invalid') return { success: false, 'error-codes': ['invalid-input-response'] };
      throw new Error('provider down');
    },
  });
  transporter.sendMail = async (mailOptions) => {
    mailOutbox.push(mailOptions);
    return { messageId: `mock-${Date.now()}` };
  };
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  transporter.sendMail = originalSendMail;
  delete process.env.RECAPTCHA_SECRET_KEY;
  await User.deleteMany({ email: /otp-test/i });
  await RegistrationRequest.deleteMany({ email: /otp-test/i });
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDatabase();
});

test.beforeEach(() => {
  mailOutbox = [];
  captchaMode = 'valid';
});

const uniq = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testEmail = () => `${uniq('otp-test')}@otp-test.kicks.test`;

async function startEmail(email, overrides = {}) {
  return registrationService.startRegistration({
    name: 'Aisha Patel',
    email,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    captchaToken: 'test-captcha-token',
    ...overrides,
  });
}

function lastSentCode() {
  const html = mailOutbox[mailOutbox.length - 1]?.html || '';
  return html.match(/(\d{6})/)[1];
}

// ---------- CAPTCHA ----------

test('missing CAPTCHA token is rejected', async () => {
  await assert.rejects(() => verifyCaptchaToken(''), (error) => error.statusCode === 400);
});

test('invalid CAPTCHA token is rejected', async () => {
  captchaMode = 'invalid';
  await assert.rejects(() => verifyCaptchaToken('bad-token'), (error) => error.statusCode === 400);
});

test('expired CAPTCHA token is rejected', async () => {
  captchaMode = 'expired';
  await assert.rejects(() => verifyCaptchaToken('stale-token'), (error) => error.statusCode === 400);
});

test('valid CAPTCHA token is accepted', async () => {
  assert.equal(await verifyCaptchaToken('good-token'), true);
});

test('CAPTCHA provider failure is handled without leaking details', async () => {
  captchaMode = 'down';
  await assert.rejects(
    () => verifyCaptchaToken('any-token'),
    (error) => [502, 503].includes(error.statusCode) && !/secret|key/i.test(error.message),
  );
});

test('registration without CAPTCHA is rejected before any account work', async () => {
  await assert.rejects(
    () => registrationService.startRegistration({
      name: 'No Captcha', email: testEmail(), password: 'Password123!', captchaToken: '',
    }),
    (error) => error.statusCode === 400,
  );
  assert.equal(await RegistrationRequest.countDocuments({ firstName: 'No Captcha' }), 0);
});

// ---------- helpers ----------

test('full name splits into first and last names', () => {
  assert.deepEqual(splitFullName('Aisha Patel'), { firstName: 'Aisha', lastName: 'Patel' });
  assert.deepEqual(splitFullName('  Ravi Kumar Singh  '), { firstName: 'Ravi', lastName: 'Kumar Singh' });
  assert.throws(() => splitFullName('A'), /full name/i);
});

test('email normalization trims and lowercases', () => {
  assert.equal(normalizeEmail('  Aisha@Example.COM '), 'aisha@example.com');
  assert.throws(() => normalizeEmail('not-an-email'), /valid email/i);
});

test('generated OTPs are 6 digits and identifiers are masked', () => {
  assert.match(generateOtp(), /^\d{6}$/);
  assert.equal(maskEmail('sanya@gmail.com'), 's***@gmail.com');
});

test('phone-based registration payloads are rejected', async () => {
  const response = await originalFetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Phone User',
      phone: '+919876543210',
      password: 'Password123!',
      captchaToken: 'test-captcha-token',
    }),
  });
  assert.equal(response.status, 400);
});

// ---------- EMAIL SIGNUP FLOW ----------

test('1. email-only registration succeeds and 2. email is normalized', async () => {
  const email = testEmail();
  const result = await startEmail(email);
  assert.equal(result.identifier, maskEmail(email.toLowerCase()));
  const pending = await RegistrationRequest.findOne({ email: email.toLowerCase() });
  assert.ok(pending);
  assert.equal(pending.email, email.toLowerCase());
  await RegistrationRequest.deleteOne({ _id: pending._id });
});

test('3-4. invalid and missing emails are rejected', async () => {
  await assert.rejects(() => startEmail('not-an-email'), (error) => error.statusCode === 400);
  await assert.rejects(
    () => registrationService.startRegistration({
      name: 'No Email', password: 'Password123!', captchaToken: 'test-captcha-token',
    }),
    (error) => error.statusCode === 400,
  );
});

test('8. pending registration created, 10. OTP email sent, 11-12. OTP hashed and never in response', async () => {
  const email = testEmail();
  const result = await startEmail(email);
  assert.equal(mailOutbox.length, 1);
  assert.equal(mailOutbox[0].to, email);
  assert.match(mailOutbox[0].subject, /verification code/i);
  assert.match(mailOutbox[0].html, /\d{6}/);
  const serialized = JSON.stringify(result).replace(/expiresInSeconds|resendAfterSeconds/gi, '');
  assert.ok(!/\d{6}/.test(serialized));
  const pending = await RegistrationRequest.findOne({ email }).select('+otpHash +passwordHash');
  assert.match(pending.otpHash, /^[0-9a-f]{64}$/);
  assert.ok(pending.passwordHash.startsWith('$2'));
  await RegistrationRequest.deleteOne({ _id: pending._id });
});

test('13-14. wrong and expired OTPs are rejected', async () => {
  const email = testEmail();
  await startEmail(email);
  await assert.rejects(
    () => registrationService.verifyOtp({ identifier: email, code: '000000' }),
    (error) => error.statusCode === 400,
  );
  const pending = await RegistrationRequest.findOne({ email });
  assert.equal(pending.attempts, 1);
  await RegistrationRequest.updateOne({ _id: pending._id }, { $set: { otpExpiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(
    () => registrationService.verifyOtp({ identifier: email, code: '000000' }),
    (error) => error.statusCode === 400,
  );
  await RegistrationRequest.deleteOne({ _id: pending._id });
});

test('15-16. max attempts and resend cooldown are enforced', async () => {
  const email = testEmail();
  await startEmail(email);
  for (let index = 0; index < OTP_MAX_ATTEMPTS; index += 1) {
    await assert.rejects(() => registrationService.verifyOtp({ identifier: email, code: '222222' }));
  }
  await assert.rejects(
    () => registrationService.verifyOtp({ identifier: email, code: '222222' }),
    (error) => error.statusCode === 429,
  );
  await assert.rejects(
    () => registrationService.resendOtp({ identifier: email }),
    (error) => error.statusCode === 429,
  );
  const pending = await RegistrationRequest.findOne({ email });
  await RegistrationRequest.deleteOne({ _id: pending._id });
});

test('17-18. resend invalidates the previous OTP, correct OTP verifies', async () => {
  const email = testEmail();
  await startEmail(email);
  const firstCode = lastSentCode();
  const pending = await RegistrationRequest.findOne({ email });
  await RegistrationRequest.updateOne({ _id: pending._id }, { $set: { resendAvailableAt: new Date(Date.now() - 1000) } });
  await registrationService.resendOtp({ identifier: email });
  assert.equal(mailOutbox.length, 2);
  const secondCode = lastSentCode();
  await assert.rejects(
    () => registrationService.verifyOtp({ identifier: email, code: firstCode }),
    (error) => error.statusCode === 400,
  );
  const result = await registrationService.verifyOtp({ identifier: email, code: secondCode });
  assert.equal(result.user.email, email.toLowerCase());
  assert.equal(result.user.role, 'CUSTOMER');
  assert.ok(result.accessToken && result.refreshToken);
  await User.deleteOne({ _id: result.user.id });
  await RegistrationRequest.deleteMany({ email });
});

test('19-20. account created exactly once; OTP invalidated after success', async () => {
  const email = testEmail();
  await startEmail(email);
  const code = lastSentCode();
  const outcomes = await Promise.allSettled([
    registrationService.verifyOtp({ identifier: email, code }),
    registrationService.verifyOtp({ identifier: email, code }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  assert.equal(await User.countDocuments({ email }), 1);
  await assert.rejects(
    () => registrationService.verifyOtp({ identifier: email, code }),
    (error) => error.statusCode === 400 || error.statusCode === 409,
  );
  await User.deleteMany({ email });
  await RegistrationRequest.deleteMany({ email });
});

test('9. pending registration creates no user; unverified users cannot login', async () => {
  const email = testEmail();
  await startEmail(email);
  assert.equal(await User.countDocuments({ email }), 0);
  await assert.rejects(() => authService.login({ email, password: 'Password123!' }), (error) => error.statusCode === 401);
  const pending = await RegistrationRequest.findOne({ email });
  await RegistrationRequest.deleteOne({ _id: pending._id });
});

test('duplicate verified email is protected; verified user is CUSTOMER', async () => {
  const email = testEmail();
  await startEmail(email);
  const result = await registrationService.verifyOtp({ identifier: email, code: lastSentCode() });
  assert.equal(result.user.role, 'CUSTOMER');
  assert.equal(result.user.emailVerified, true);
  await assert.rejects(() => startEmail(email), (error) => error.statusCode === 409);
  const login = await authService.login({ email, password: 'Password123!' });
  assert.equal(login.user.email, email.toLowerCase());
  await User.deleteOne({ _id: result.user.id });
  await RegistrationRequest.deleteMany({ email });
});

test('ADMIN role enum is unchanged and admins are unaffected', async () => {
  assert.deepEqual(User.schema.path('role').enumValues, ['CUSTOMER', 'ADMIN']);
  await assert.rejects(User.create({ firstName: 'X', lastName: 'Y', email: testEmail(), password: 'x'.repeat(60), role: 'SUPER_ADMIN' }));
});

test('expired pending registrations are rejected and TTL-cleaned', async () => {
  const email = testEmail();
  await startEmail(email);
  const pending = await RegistrationRequest.findOne({ email });
  await RegistrationRequest.updateOne({ _id: pending._id }, { $set: { otpExpiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(
    () => registrationService.verifyOtp({ identifier: email, code: '123456' }),
    (error) => error.statusCode === 400,
  );
  const indexes = await RegistrationRequest.collection.indexes();
  assert.ok(indexes.some((index) => index.expireAfterSeconds === 0 && index.key && index.key.expiresAt === 1));
  await RegistrationRequest.deleteOne({ _id: pending._id });
});

test('route: POST /auth/register without CAPTCHA token returns 400', async () => {
  const response = await originalFetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Route Test', email: 'otp-test-route@otp-test.kicks.test', password: 'Password123!' }),
  });
  assert.equal(response.status, 400);
});

test('route: POST /auth/register/verify-otp rejects malformed codes', async () => {
  const response = await originalFetch(`${apiBase}/auth/register/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'otp-test-route@otp-test.kicks.test', code: '12' }),
  });
  assert.equal(response.status, 400);
});

test('route: POST /auth/register/resend-otp without pending record returns 400', async () => {
  const response = await originalFetch(`${apiBase}/auth/register/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'otp-test-nothing@otp-test.kicks.test' }),
  });
  assert.equal(response.status, 400);
});
