import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { signRefreshToken, signAccessToken, verifyRefreshToken } from '../src/utils/jwt.js';
import { authService } from '../src/modules/auth/service.js';
import User from '../src/modules/users/model.js';
import UserSession from '../src/modules/auth/session.model.js';

// Refresh-token jti collision regression tests. DB tests use jtitest-
// fixtures and remove them afterwards — shared data is untouched.
const TAG = 'jtitest';
const emailFor = (n) => `${TAG}-${n}-${Date.now()}@example.com`;

test.before(async () => {
  await connectDatabase();
});

const createdUserIds = [];

test.after(async () => {
  if (createdUserIds.length > 0) {
    await UserSession.deleteMany({ user: { $in: createdUserIds } });
  }
  await User.deleteMany({ email: new RegExp(TAG, 'i') });
  await closeDatabase();
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const makeCustomer = (n) => User.create({
  firstName: 'Jti',
  lastName: `Tester${n}`,
  email: emailFor(n),
  password: bcrypt.hashSync('JtiTest123', 12),
  role: 'CUSTOMER',
});

const cleanupCustomer = async (user) => {
  if (!user) return;
  createdUserIds.push(user._id);
  await UserSession.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });
};

test('1: two refresh tokens minted back-to-back carry distinct cryptographically random jtis', () => {
  const payload = { sub: 'test-user-id', role: 'CUSTOMER' };
  const first = signRefreshToken(payload);
  const second = signRefreshToken(payload);
  assert.notEqual(first, second);
  const decodedFirst = verifyRefreshToken(first);
  const decodedSecond = verifyRefreshToken(second);
  assert.match(decodedFirst.jti, UUID_V4);
  assert.match(decodedSecond.jti, UUID_V4);
  assert.notEqual(decodedFirst.jti, decodedSecond.jti);
  assert.equal(decodedFirst.sub, 'test-user-id');
  assert.equal(decodedFirst.role, 'CUSTOMER');
  assert.equal(typeof jwt.decode(first, { complete: true }).signature, 'string');
});

test('access tokens are unchanged (no jti added)', () => {
  const decoded = jwt.decode(signAccessToken({ sub: 'x', role: 'CUSTOMER' }));
  assert.equal(decoded.jti, undefined);
  assert.equal(decoded.sub, 'x');
});

test('2: frozen clock — two logins in the same second create two sessions, no E11000', async () => {
  const user = await makeCustomer('frozen');
  const realNow = Date.now;
  Date.now = () => 1780000000000;
  try {
    const first = await authService.login({ email: user.email, password: 'JtiTest123' });
    const second = await authService.login({ email: user.email, password: 'JtiTest123' });
    assert.notEqual(first.refreshToken, second.refreshToken);
    // Second login revokes prior sessions; exactly one live session remains.
    assert.equal(await UserSession.countDocuments({ user: user._id, revokedAt: null }), 1);
  } finally {
    Date.now = realNow;
    await cleanupCustomer(user);
  }
});
test('3/4/5: rotation succeeds once; the rotated-out token is rejected as reuse', async () => {
  const user = await makeCustomer('rotate');
  try {
    const loggedIn = await authService.login({ email: user.email, password: 'JtiTest123' });
    const rotated = await authService.refresh(loggedIn.refreshToken);
    assert.ok(rotated.accessToken && rotated.refreshToken);
    assert.notEqual(rotated.refreshToken, loggedIn.refreshToken);
    await assert.rejects(
      authService.refresh(loggedIn.refreshToken),
      (error) => error.statusCode === 401,
    );
    const again = await authService.refresh(rotated.refreshToken);
    assert.ok(again.accessToken);
  } finally {
    await cleanupCustomer(user);
  }
});

test('6: logout revokes the session so refresh fails afterwards', async () => {
  const user = await makeCustomer('logout');
  try {
    const loggedIn = await authService.login({ email: user.email, password: 'JtiTest123' });
    await authService.logout(user._id);
    await assert.rejects(
      authService.refresh(loggedIn.refreshToken),
      (error) => error.statusCode === 401,
    );
  } finally {
    await cleanupCustomer(user);
  }
});
