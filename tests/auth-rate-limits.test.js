import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import app from '../src/app.js';

// Auth rate-limit wiring tests. Each test uses a DISTINCT spoofed client IP
// (X-Forwarded-For, honored via trust proxy = 1 hop) so every endpoint gets
// a fresh 10-request budget and tests stay independent. Unknown emails and
// garbage tokens are used throughout: no emails are sent, no users created.
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}/api/v1`;

let ipCounter = 0;
const freshIp = () => `203.0.113.${(ipCounter += 1)}`;

const post = async (path, body, ip) => {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
};

test.before(async () => {
  await connectDatabase();
});
test.after(async () => {
  server.close();
  await closeDatabase();
});

test('legacy forgot-password: generic 200s then 429 (email endpoint now throttled)', async () => {
  const ip = freshIp();
  const body = { email: 'ratelimit-unknown@example.com' };
  for (let i = 0; i < 10; i += 1) {
    const { status, json } = await post('/auth/forgot-password', body, ip);
    assert.equal(status, 200);
    assert.match(json.message || '', /if the account exists/i);
  }
  const limited = await post('/auth/forgot-password', body, ip);
  assert.equal(limited.status, 429);
  assert.match(limited.json.message || '', /too many authentication attempts/i);
});

test('legacy reset-password: invalid token 400 passes, then 429', async () => {
  const ip = freshIp();
  const body = { token: '0'.repeat(64), password: 'ResetPass123' };
  const first = await post('/auth/reset-password', body, ip);
  assert.equal(first.status, 400);
  for (let i = 0; i < 9; i += 1) await post('/auth/reset-password', body, ip);
  const limited = await post('/auth/reset-password', body, ip);
  assert.equal(limited.status, 429);
});

test('verify-email: invalid token 400 passes, then 429', async () => {
  const ip = freshIp();
  const body = { token: '0'.repeat(64) };
  const first = await post('/auth/verify-email', body, ip);
  assert.equal(first.status, 400);
  for (let i = 0; i < 9; i += 1) await post('/auth/verify-email', body, ip);
  const limited = await post('/auth/verify-email', body, ip);
  assert.equal(limited.status, 429);
});

test('resend-verification: limiter runs before auth (401s, then 429)', async () => {
  const ip = freshIp();
  for (let i = 0; i < 10; i += 1) {
    const { status } = await post('/auth/resend-verification', {}, ip);
    assert.equal(status, 401);
  }
  const limited = await post('/auth/resend-verification', {}, ip);
  assert.equal(limited.status, 429);
});

test('trust proxy: exhausted IP-A does not consume IP-B budget', async () => {
  const ipA = freshIp();
  const ipB = freshIp();
  const body = { email: 'ratelimit-other@example.com' };
  for (let i = 0; i < 10; i += 1) await post('/auth/forgot-password', body, ipA);
  assert.equal((await post('/auth/forgot-password', body, ipA)).status, 429);
  const fresh = await post('/auth/forgot-password', body, ipB);
  assert.equal(fresh.status, 200);
});

test('login still serves legitimate traffic (wrong creds 401, not 429)', async () => {
  const ip = freshIp();
  const { status } = await post('/auth/login', { email: 'ratelimit-login@example.com', password: 'WrongPass123' }, ip);
  assert.equal(status, 401);
});

test('shipment webhook has no per-IP auth limiter (repeated 400s, never 429)', async () => {
  const ip = freshIp();
  let last = 0;
  for (let i = 0; i < 11; i += 1) {
    const response = await fetch(`${apiBase}/shipments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({}),
    });
    last = response.status;
  }
  assert.notEqual(last, 429);
});
