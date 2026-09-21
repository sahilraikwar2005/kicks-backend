import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { isTrustedOrigin } from '../src/config/origins.js';

test('origin guard: exact configured origins are trusted', () => {
  if (env.clientUrl) assert.equal(isTrustedOrigin(env.clientUrl), true);
  if (env.adminUrl) assert.equal(isTrustedOrigin(env.adminUrl), true);
});

test('origin guard: trailing slashes and casing do not break configured origins', () => {
  if (env.clientUrl) {
    assert.equal(isTrustedOrigin(`${env.clientUrl}/`), true);
    assert.equal(isTrustedOrigin(env.clientUrl.toUpperCase()), true);
  }
});

test('origin guard: unknown, empty, and malformed origins are rejected', () => {
  assert.equal(isTrustedOrigin('https://evil.example'), false);
  assert.equal(isTrustedOrigin('https://client.evil.example'), false);
  assert.equal(isTrustedOrigin(''), false);
  assert.equal(isTrustedOrigin(null), false);
  assert.equal(isTrustedOrigin(undefined), false);
  assert.equal(isTrustedOrigin('not-a-url'), false);
});

test('origin guard: localhost dev origins only outside production', () => {
  if (env.nodeEnv !== 'production') {
    assert.equal(isTrustedOrigin('http://localhost:5173'), true);
    assert.equal(isTrustedOrigin('http://127.0.0.1:3000'), true);
  } else {
    assert.equal(isTrustedOrigin('http://localhost:5173'), false);
  }
});
