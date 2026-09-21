import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { analyzeProductSchema } from '../src/modules/ai/validation.js';
import {
  analyzeProductImage,
  isAiConfigured,
  isAllowedAnalysisImageUrl,
  sanitizeAnalysis,
  slugifyProductName,
} from '../src/modules/ai/service.js';

const server = app.listen(0);

await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;
const endpoint = `http://127.0.0.1:${port}/api/v1/admin/ai/product-analyze`;
const cloudName = String(env.cloudinaryCloudName || 'demo').trim() || 'demo';
const pipelineImage = (name) => `https://res.cloudinary.com/${cloudName}/image/upload/kicks/products/${name}`;

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await closeDatabase();
});

test('POST /admin/ai/product-analyze without token returns 401', async () => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: pipelineImage('test.png') }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
});

test('AI analyze validation rejects missing, non-https and oversized image URLs', () => {
  assert.ok(analyzeProductSchema.validate({}).error);
  assert.ok(analyzeProductSchema.validate({ imageUrl: 'not-a-url' }).error);
  assert.ok(analyzeProductSchema.validate({ imageUrl: 'http://res.cloudinary.com/demo/x.png' }).error);
  assert.ok(analyzeProductSchema.validate({ imageUrl: `https://res.cloudinary.com/demo/${'x'.repeat(2100)}.png` }).error);
  const { error, value } = analyzeProductSchema.validate({ imageUrl: pipelineImage('test.png') });
  assert.equal(error, undefined);
  assert.ok(value.imageUrl.startsWith('https://'));
});

test('AI analysis only allows KICKS Cloudinary image URLs', () => {
  assert.equal(isAllowedAnalysisImageUrl(pipelineImage('a.png')), true);
  assert.equal(isAllowedAnalysisImageUrl(pipelineImage('a.png').replace('https://', 'http://')), false);
  assert.equal(isAllowedAnalysisImageUrl('https://evil.example.com/kicks/products/a.png'), false);
  assert.equal(isAllowedAnalysisImageUrl('https://res.cloudinary.com.evil.example.com/kicks/a.png'), false);
  assert.equal(isAllowedAnalysisImageUrl('https://res.cloudinary.com/other-cloud/image/upload/kicks/products/a.png'), cloudName === 'other-cloud');
  assert.equal(isAllowedAnalysisImageUrl('not-a-url'), false);
  assert.equal(isAllowedAnalysisImageUrl(''), false);
});

test('AI sanitizer marks uncertain results for review instead of inventing identity', () => {
  const result = sanitizeAnalysis({
    brand: null,
    model: '  ',
    category: 'running',
    brandConfidence: 'low',
    modelConfidence: 'bogus',
    categoryConfidence: 'medium',
  });

  assert.equal(result.brand, null);
  assert.equal(result.model, null);
  assert.equal(result.category, 'running');
  assert.equal(result.confidence.brand, 'low');
  assert.equal(result.confidence.model, 'low');
  assert.equal(result.needsReview, true);
  assert.deepEqual(result.sources, []);
  assert.equal(result.webVerified, false);
});

test('AI sanitizer strips authenticity claims and caps untrusted content', () => {
  const result = sanitizeAnalysis({
    brand: '100% authentic Nike',
    model: 'Air Force 1 official authorized',
    productName: 'Verified authentic shoe',
    gender: 'mens',
    tags: ['running', 'running', 42, '  court  '],
    seoKeywords: 'not-an-array',
    brandConfidence: 'HIGH',
    modelConfidence: 'high',
    categoryConfidence: 'high',
  });

  assert.equal(result.brand, null);
  assert.equal(result.model, null);
  assert.equal(result.productName, null);
  assert.equal(result.gender, null);
  assert.deepEqual(result.tags, ['running', 'court']);
  assert.equal(result.seoTitle, undefined);
  assert.equal(result.seoDescription, undefined);
  assert.equal(result.seoKeywords, undefined);
  assert.equal(result.confidence.brand, 'low');
  assert.equal(result.needsReview, true);
});

test('AI sanitizer keeps confident results review-free with a usable slug', () => {
  const result = sanitizeAnalysis({
    brand: 'Nike',
    model: "Air Force 1 '07",
    productName: "Nike Air Force 1 '07 White",
    category: 'Lifestyle',
    gender: 'men',
    brandConfidence: 'high',
    modelConfidence: 'high',
    categoryConfidence: 'high',
    evidence: ['visible swoosh logo'],
    reasoningSummary: 'Clear logo and silhouette match.',
  });

  assert.equal(result.brand, 'Nike');
  assert.equal(result.model, "Air Force 1 '07");
  assert.equal(result.gender, 'MEN');
  assert.equal(result.slug, 'nike-air-force-1-07-white');
  assert.equal(result.needsReview, false);
  assert.deepEqual(result.evidence, ['visible swoosh logo']);
});

test('AI slug helper degrades to an empty string instead of junk', () => {
  assert.equal(slugifyProductName('Nike Air Force 1 \'07 White'), 'nike-air-force-1-07-white');
  assert.equal(slugifyProductName('   '), '');
  assert.equal(slugifyProductName(null), '');
});

test('AI analyze rejects non-pipeline URLs before touching any provider', async () => {
  await assert.rejects(
    () => analyzeProductImage({ imageUrl: 'https://evil.example.com/kicks/products/a.png' }),
    (error) => error.statusCode === 400 && /media pipeline/i.test(error.message),
  );
});

test('AI analyze reports unconfigured provider without making network calls', async () => {
  const previous = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    assert.equal(isAiConfigured(), false);
    await assert.rejects(
      () => analyzeProductImage({ imageUrl: pipelineImage('a.png') }),
      (error) => error.statusCode === 503 && /not configured/i.test(error.message),
    );
  } finally {
    if (previous === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previous;
  }
});
