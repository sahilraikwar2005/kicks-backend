import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_VERSION,
  clearConsent,
  hasValidConsent,
  parseConsent,
  readConsent,
  saveConsent,
} from '../kicks-frontend/src/utils/cookieConsent.js';

function installMemoryStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

function uninstallStorage() {
  // eslint-disable-next-line no-undef
  delete globalThis.localStorage;
}

test.beforeEach(() => {
  installMemoryStorage();
});

test.afterEach(() => {
  uninstallStorage();
});

test('banner appears when no consent exists', () => {
  assert.equal(hasValidConsent(), false);
  assert.equal(readConsent(), null);
});

test('Accept Cookies stores optional=true and hides the banner', () => {
  saveConsent({ optional: true });
  const consent = readConsent();
  assert.equal(consent.version, COOKIE_CONSENT_VERSION);
  assert.equal(consent.essential, true);
  assert.equal(consent.optional, true);
  assert.equal(typeof consent.timestamp, 'number');
  assert.equal(hasValidConsent(), true);
});

test('Reject Optional stores optional=false and hides the banner', () => {
  saveConsent({ optional: false });
  const consent = readConsent();
  assert.equal(consent.essential, true);
  assert.equal(consent.optional, false);
  assert.equal(hasValidConsent(), true);
});

test('Save Preferences persists the selected optional state', () => {
  saveConsent({ optional: true });
  assert.equal(readConsent().optional, true);
  saveConsent({ optional: false });
  assert.equal(readConsent().optional, false);
});

test('essential consent can never be disabled', () => {
  saveConsent({ optional: false });
  assert.equal(readConsent().essential, true);
  const raw = JSON.parse(globalThis.localStorage.getItem(COOKIE_CONSENT_KEY));
  raw.essential = false;
  globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(raw));
  assert.equal(hasValidConsent(), false);
});

test('returning user with valid consent does not see the banner', () => {
  saveConsent({ optional: true });
  assert.equal(hasValidConsent(), true);
});

test('changed consent version invalidates stored consent', () => {
  globalThis.localStorage.setItem(
    COOKIE_CONSENT_KEY,
    JSON.stringify({ version: '0', essential: true, optional: true, timestamp: Date.now() }),
  );
  assert.equal(hasValidConsent(), false);
  assert.equal(readConsent(), null);
});

test('corrupt or foreign storage values are treated as no consent', () => {
  globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'not-json{{{');
  assert.equal(hasValidConsent(), false);
  globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: '1', essential: true }));
  assert.equal(readConsent().optional, false);
  assert.equal(hasValidConsent(), true);
});

test('clearConsent removes the stored record', () => {
  saveConsent({ optional: true });
  clearConsent();
  assert.equal(hasValidConsent(), false);
});

test('no sensitive fields are ever persisted', () => {
  saveConsent({ optional: true });
  const raw = globalThis.localStorage.getItem(COOKIE_CONSENT_KEY);
  assert.ok(!/token|secret|password|email|phone/i.test(raw));
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['essential', 'optional', 'timestamp', 'version']);
});

test('parseConsent works without any storage backend', () => {
  uninstallStorage();
  assert.equal(hasValidConsent(), false);
  assert.equal(
    parseConsent(JSON.stringify({ version: '1', essential: true, optional: false, timestamp: 1 })).optional,
    false,
  );
});
