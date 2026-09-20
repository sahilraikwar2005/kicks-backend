import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

for (const path of [
  '/api/v1/admin/dashboard',
  '/api/v1/admin/products',
  '/api/v1/admin/ai/product-generate',
  '/api/v1/admin/ai/product-regenerate',
  '/api/v1/admin/orders/000000000000000000000000/ship',
  '/api/v1/admin/orders/000000000000000000000000/refund',
  '/api/v1/admin/orders/000000000000000000000000/invoice/resend',
  '/api/v1/orders/000000000000000000000000/invoice',
  '/api/v1/orders/000000000000000000000000/tracking',
  '/api/v1/products/000000000000000000000000/reviews',
  '/api/v1/payments/orders/000000000000000000000000',
  '/api/v1/payments/verify',
]) {
  test(`${path} requires authentication`, async () => {
    const method = path.includes('/ai/') || path.includes('/ship') || path.includes('/refund') || path.includes('/resend') || path.includes('/payments/') || path.endsWith('/reviews') ? 'POST' : 'GET';
    const response = await fetch(`${baseUrl}${path}`, { method });
    assert.equal(response.status, 401);
  });
}
