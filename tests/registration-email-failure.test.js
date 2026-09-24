import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { transporter } from '../src/config/email.js';
import User from '../src/modules/users/model.js';
import RegistrationRequest from '../src/modules/auth/registration.model.js';
import { registrationService } from '../src/modules/auth/registration.service.js';

// Registration email-failure safety. All fixtures use the regfail- prefix
// and are removed in after(). The mail transport is fully mocked.
const TAG = 'regfail';
const emailFor = (n) => `${TAG}-${n}-${Date.now()}@example.com`;

const originalSendMail = transporter.sendMail;
const originalSmtpUser = env.smtpUser;
const originalSmtpPassword = env.smtpPassword;
let mailMode = 'ok';
let mailOutbox = [];

test.before(async () => {
  await connectDatabase();
  env.smtpUser = 'mock-user@example.com';
  env.smtpPassword = 'mock-password';
  transporter.sendMail = async (mailOptions) => {
    if (mailMode === 'auth-failure') {
      const error = new Error('Invalid login');
      error.code = 'EAUTH';
      throw error;
    }
    if (mailMode === 'down') {
      const error = new Error('Connection refused');
      error.code = 'ECONNECTION';
      throw error;
    }
    mailOutbox.push(mailOptions);
    return { messageId: 'mock' };
  };
});

test.after(async () => {
  transporter.sendMail = originalSendMail;
  env.smtpUser = originalSmtpUser;
  env.smtpPassword = originalSmtpPassword;
  await User.deleteMany({ email: new RegExp(TAG, 'i') });
  await RegistrationRequest.deleteMany({ email: new RegExp(TAG, 'i') });
  await closeDatabase();
});

const otpFromOutbox = (to) => {
  const mail = [...mailOutbox].reverse().find((item) => String(item.to) === to);
  const match = String(mail?.text || '').match(/(\d{6})/);
  assert.ok(match, 'expected an OTP email');
  return match[1];
};

test('SMTP transport has bounded timeouts so sends can never hang', () => {
  assert.ok(transporter.options.connectionTimeout > 0);
  assert.ok(transporter.options.greetingTimeout > 0);
  assert.ok(transporter.options.socketTimeout > 0);
});

test('SMTP outage: 503 surfaces, no user created, retry succeeds without duplicates', async () => {
  const email = emailFor('outage');
  mailMode = 'down';
  await assert.rejects(
    registrationService.startRegistration({ name: 'Outage Probe', email, password: 'OutagePass123', confirmPassword: 'OutagePass123' }),
    (error) => error.statusCode === 503,
  );
  assert.equal(await User.countDocuments({ email }), 0);

  mailMode = 'ok';
  const retry = await registrationService.startRegistration({ name: 'Outage Probe', email, password: 'OutagePass123', confirmPassword: 'OutagePass123' });
  assert.ok(retry.identifier);
  assert.equal(await RegistrationRequest.countDocuments({ email, status: 'pending' }), 1);

  const verified = await registrationService.verifyOtp({ identifier: email, code: otpFromOutbox(email) });
  assert.equal(verified.user.email, email);
  assert.equal(await User.countDocuments({ email }), 1);
});

test('SMTP auth failure maps to 503 without leaking credentials', async () => {
  const email = emailFor('auth');
  mailMode = 'auth-failure';
  try {
    await registrationService.startRegistration({ name: 'Auth Probe', email, password: 'AuthPass123', confirmPassword: 'AuthPass123' });
    assert.fail('should have thrown');
  } catch (error) {
    assert.equal(error.statusCode, 503);
    assert.ok(!/mock-password|secret|key/i.test(error.message));
  } finally {
    mailMode = 'ok';
  }
  assert.equal(await User.countDocuments({ email }), 0);
});

test('duplicate email is rejected deterministically', async () => {
  const email = emailFor('dupe');
  mailMode = 'ok';
  await registrationService.startRegistration({ name: 'Dupe Probe', email, password: 'DupePass123', confirmPassword: 'DupePass123' });
  await registrationService.verifyOtp({ identifier: email, code: otpFromOutbox(email) });
  await assert.rejects(
    registrationService.startRegistration({ name: 'Dupe Probe', email, password: 'DupePass123', confirmPassword: 'DupePass123' }),
    (error) => error.statusCode === 409,
  );
  assert.equal(await User.countDocuments({ email }), 1);
});

test('invalid input never touches the mail transport', async () => {
  const sent = mailOutbox.length;
  await assert.rejects(
    registrationService.startRegistration({ name: 'X', email: 'not-an-email', password: 'short', confirmPassword: 'short' }),
    (error) => error.statusCode === 400,
  );
  assert.equal(mailOutbox.length, sent);
});
