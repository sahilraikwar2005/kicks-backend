import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { closeDatabase } from '../src/config/database.js';

const server = app.listen(0);

await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await closeDatabase();
});

test('GET /api/v1/health returns KICKS API running', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
  const body = await response.json();

  assert.ok([200, 503].includes(response.status));
  assert.equal(body.success, true);
  assert.equal(body.message, 'KICKS API is running');
  assert.ok(['connected', 'unavailable'].includes(body.database));
});

test('GET /api/v1/auth/me without token returns 401', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});

test('POST /api/v1/auth/register validates body', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid-email' }),
  });

  assert.equal(response.status, 400);
});
