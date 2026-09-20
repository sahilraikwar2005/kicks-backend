import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import app from '../src/app.js';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import User from '../src/modules/users/model.js';
import UserSession from '../src/modules/auth/session.model.js';
import { authService } from '../src/modules/auth/service.js';

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/api/v1`;

const cleanup = async () => {
  await UserSession.deleteMany({});
  await User.deleteMany({ email: { $regex: /security|admin|customer/i } });
};

test.after(async () => {
  await cleanup();
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await closeDatabase();
});

test.before(async () => {
  await connectDatabase();
});

test('admin security: forged elevated-role token is rejected', async () => {
  const email = 'security-admin-role@kicks.test';
  const user = await User.create({
    firstName: 'Test',
    lastName: 'Customer',
    email,
    password: await bcrypt.hash('SecurePass123!', 12),
    role: 'CUSTOMER',
    isActive: true,
  });

  const forgedToken = jwt.sign({ sub: String(user._id), role: 'ADMIN' }, env.jwtAccessSecret, { expiresIn: '15m' });
  const response = await fetch(`${baseUrl}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${forgedToken}` },
  });

  assert.equal(response.status, 401);
  await User.deleteOne({ _id: user._id });
});

test('admin security: customer cannot access admin endpoints', async () => {
  const email = 'security-customer@kicks.test';
  const user = await User.create({
    firstName: 'Customer',
    lastName: 'Tester',
    email,
    password: await bcrypt.hash('SecurePass123!', 12),
    role: 'CUSTOMER',
    isActive: true,
  });

  const token = jwt.sign({ sub: String(user._id), role: 'CUSTOMER' }, env.jwtAccessSecret, { expiresIn: '15m' });
  const response = await fetch(`${baseUrl}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 403);
  await User.deleteOne({ _id: user._id });
});

test('auth security: registering with a privileged role is rejected', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Privilege',
      lastName: 'Attempt',
      email: 'security-escalation@kicks.test',
      password: 'SecurePass123!',
      role: 'ADMIN',
    }),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(Array.isArray(body.errors) && body.errors.some((error) => /role|unknown/i.test(error)));
  await User.deleteOne({ email: 'security-escalation@kicks.test' });
});

test('auth security: password change invalidates active sessions', async () => {
  const email = 'security-password@kicks.test';
  const password = 'SecurePass123!';
  const user = await User.create({
    firstName: 'Session',
    lastName: 'User',
    email,
    password: await bcrypt.hash(password, 12),
    role: 'CUSTOMER',
    isActive: true,
  });

  const login = await authService.login({ email, password });
  const oldRefresh = login.refreshToken;
  await authService.changePassword(user._id, password, 'NewSecurePass456!');

  await assert.rejects(() => authService.refresh(oldRefresh), /Refresh token reuse detected|Session expired|invalid|expired/i);
  const activeSessions = await UserSession.countDocuments({ user: user._id, revokedAt: null });
  assert.equal(activeSessions, 0);

  await User.deleteOne({ _id: user._id });
  await UserSession.deleteMany({ user: user._id });
});
