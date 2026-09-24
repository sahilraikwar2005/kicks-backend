import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { transporter } from '../src/config/email.js';
import app from '../src/app.js';
import User from '../src/modules/users/model.js';
import PasswordResetRequest from '../src/modules/auth/passwordReset.model.js';
import { passwordResetService } from '../src/modules/auth/passwordReset.service.js';

// Scoped OTP password-reset coverage. ALL data uses the pwreset-otp-test-
// prefix and is removed in after(). The suite never touches other records.
const TAG = 'pwreset-otp-test';
const email = (n) => `${TAG}-${n}@example.com`;

const originalSendMail = transporter.sendMail;
let mailOutbox = [];
const loggedErrors = [];
const originalConsoleError = console.error;

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}/api/v1`;

const post = async (path, body, cookie) => {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json, setCookie: response.headers.get('set-cookie') || '' };
};

const otpFromOutbox = (to) => {
  const mail = [...mailOutbox].reverse().find((item) => String(item.to) === to);
  assert.ok(mail, `expected an email to ${to}`);
  const match = String(mail.text || '').match(/(\d{6})/);
  assert.ok(match, 'email must contain a 6-digit OTP');
  return match[1];
};

test.before(async () => {
  await connectDatabase();
  env.smtpUser = 'mock-user@example.com';
  env.smtpPassword = 'mock-password';
  transporter.sendMail = async (mailOptions) => {
    mailOutbox.push(mailOptions);
    return { messageId: `mock-${Date.now()}` };
  };
  console.error = (...args) => {
    loggedErrors.push(args.map(String).join(' '));
  };
});

test.after(async () => {
  console.error = originalConsoleError;
  transporter.sendMail = originalSendMail;
  await User.deleteMany({ email: new RegExp(TAG, 'i') });
  await PasswordResetRequest.deleteMany({ email: new RegExp(TAG, 'i') });
  server.close();
  await closeDatabase();
});

const createCustomer = (n) => User.create({
  firstName: 'Reset',
  lastName: `Tester${n}`,
  email: email(n),
  password: bcrypt.hashSync('OldPassword123', 12),
  role: 'CUSTOMER',
});

// 1. Existing email -> generic response + OTP generated + email sent.
test('existing email gets generic response and an OTP email', async () => {
  await createCustomer('01');
  const { status, json } = await post('/auth/password-reset/request', { email: email('01') });
  assert.equal(status, 200);
  assert.equal(json.data.message, 'If an account exists for this email, a verification code has been sent.');
  assert.ok(json.data.identifier.includes('@example.com'));
  assert.ok(!JSON.stringify(json).match(/"otp"|"resetToken"/i) || JSON.stringify(json).includes('resetToken') === false);
  const code = otpFromOutbox(email('01'));
  assert.match(code, /^\d{6}$/);
});

// 2. Unknown email -> byte-identical shape, no document, no email.
test('unknown email gets the same generic response with no side effects', async () => {
  const before = mailOutbox.length;
  const { status, json } = await post('/auth/password-reset/request', { email: email('unknown') });
  assert.equal(status, 200);
  assert.equal(json.data.message, 'If an account exists for this email, a verification code has been sent.');
  assert.ok(json.data.identifier);
  assert.equal(json.data.expiresInSeconds, 600);
  const doc = await PasswordResetRequest.findOne({ email: email('unknown') });
  assert.equal(doc, null);
  assert.equal(mailOutbox.length, before);
});

// 3 + 9 + 12 + 13 (HTTP): verify -> challenge; confirm changes password;
// challenge reuse rejected; old refresh session invalid afterwards.
test('verify issues a challenge; confirm resets password and kills old sessions', async () => {
  const loginBefore = await post('/auth/login', { email: email('01'), password: 'OldPassword123' });
  assert.equal(loginBefore.status, 200);
  const oldRefreshCookie = (loginBefore.setCookie.match(/refreshToken=[^;]+/) || [])[0] || '';

  const code = otpFromOutbox(email('01'));
  const verified = await post('/auth/password-reset/verify', { email: email('01'), code });
  assert.equal(verified.status, 200);
  assert.match(verified.json.data.resetToken, /^[a-f0-9]{64}$/);
  assert.ok(!('otp' in verified.json.data));

  const challenge = verified.json.data.resetToken;
  const confirmed = await post('/auth/password-reset/confirm', {
    email: email('01'),
    resetToken: challenge,
    newPassword: 'BrandNewPass123',
    confirmPassword: 'BrandNewPass123',
  });
  assert.equal(confirmed.status, 200);
  assert.match(confirmed.json.message, /log in again/i);

  const reuse = await post('/auth/password-reset/confirm', {
    email: email('01'),
    resetToken: challenge,
    newPassword: 'AnotherPass123',
  });
  assert.ok([400, 409].includes(reuse.status));

  const loginNew = await post('/auth/login', { email: email('01'), password: 'BrandNewPass123' });
  assert.equal(loginNew.status, 200);
  const loginOld = await post('/auth/login', { email: email('01'), password: 'OldPassword123' });
  assert.equal(loginOld.status, 401);

  const refreshOld = await post('/auth/refresh', {}, oldRefreshCookie);
  assert.equal(refreshOld.status, 401);
});

// 4. Invalid OTP rejected (service level, no rate-limiter budget spent).
test('invalid OTP is rejected', async () => {
  await createCustomer('04');
  await passwordResetService.requestReset({ email: email('04') });
  await assert.rejects(
    passwordResetService.verifyOtp({ email: email('04'), code: '000000' }),
    (error) => error.statusCode === 400,
  );
});

// 5. Expired OTP rejected.
test('expired OTP is rejected', async () => {
  await createCustomer('05');
  await passwordResetService.requestReset({ email: email('05') });
  await PasswordResetRequest.updateOne(
    { email: email('05'), status: 'pending' },
    { $set: { otpExpiresAt: new Date(Date.now() - 1000) } },
  );
  const code = otpFromOutbox(email('05'));
  await assert.rejects(
    passwordResetService.verifyOtp({ email: email('05'), code }),
    (error) => error.statusCode === 400 && /invalid or expired/i.test(error.message),
  );
});

// 6. Five failed attempts lock the OTP.
test('five failed OTP attempts lock further verification', async () => {
  await createCustomer('06');
  await passwordResetService.requestReset({ email: email('06') });
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(
      passwordResetService.verifyOtp({ email: email('06'), code: '000000' }),
      (error) => error.statusCode === 400,
    );
  }
  await assert.rejects(
    passwordResetService.verifyOtp({ email: email('06'), code: '000000' }),
    (error) => error.statusCode === 429,
  );
});

// 7 + 8. Resend cooldown enforced, then allowed after expiry.
test('resend before cooldown is rejected; after cooldown it sends again', async () => {
  await createCustomer('07');
  await passwordResetService.requestReset({ email: email('07') });
  const sent = mailOutbox.filter((mail) => String(mail.to) === email('07')).length;
  await assert.rejects(
    passwordResetService.resendOtp({ email: email('07') }),
    (error) => error.statusCode === 429 && /resend available in \d+ seconds/i.test(error.message),
  );
  await PasswordResetRequest.updateOne(
    { email: email('07'), status: 'pending' },
    { $set: { resendAvailableAt: new Date(Date.now() - 1000) } },
  );
  const resent = await passwordResetService.resendOtp({ email: email('07') });
  assert.ok(resent.identifier);
  assert.equal(mailOutbox.filter((mail) => String(mail.to) === email('07')).length, sent + 1);
});

// 10. Weak password rejected at confirm.
test('weak new password is rejected', async () => {
  await createCustomer('10');
  await passwordResetService.requestReset({ email: email('10') });
  const { resetToken } = await passwordResetService.verifyOtp({ email: email('10'), code: otpFromOutbox(email('10')) });
  await assert.rejects(
    passwordResetService.confirmReset({ email: email('10'), resetToken, newPassword: 'short' }),
    (error) => error.statusCode === 400,
  );
});

// 11. Expired reset challenge rejected.
test('expired reset challenge is rejected', async () => {
  await createCustomer('11');
  await passwordResetService.requestReset({ email: email('11') });
  const { resetToken } = await passwordResetService.verifyOtp({ email: email('11'), code: otpFromOutbox(email('11')) });
  await PasswordResetRequest.updateOne(
    { email: email('11'), status: 'verified' },
    { $set: { resetTokenExpiresAt: new Date(Date.now() - 1000) } },
  );
  await assert.rejects(
    passwordResetService.confirmReset({ email: email('11'), resetToken, newPassword: 'BrandNewPass123' }),
    (error) => error.statusCode === 400,
  );
});

// 14. OTP hash stored, raw OTP never persisted or returned.
test('raw OTP is never stored or returned', async () => {
  await createCustomer('14');
  const requested = await passwordResetService.requestReset({ email: email('14') });
  assert.ok(!JSON.stringify(requested).match(/\b\d{6}\b/));
  const raw = await PasswordResetRequest.findOne({ email: email('14') }).select('+otpHash').lean();
  const code = otpFromOutbox(email('14'));
  assert.ok(raw.otpHash);
  assert.ok(!raw.otpHash.includes(code));
  assert.equal(raw.otpHash.length, 64);
});

// 15. No sensitive values reach logs.
test('no passwords, OTPs or tokens are logged', async () => {
  const secret = 'SuperSecretPass123';
  await createCustomer('15');
  await passwordResetService.requestReset({ email: email('15') });
  const code = otpFromOutbox(email('15'));
  const { resetToken } = await passwordResetService.verifyOtp({ email: email('15'), code });
  await passwordResetService.confirmReset({ email: email('15'), resetToken, newPassword: secret });
  const leak = loggedErrors.find((line) => line.includes(secret) || line.includes(code) || line.includes(resetToken));
  assert.equal(leak, undefined);
});
