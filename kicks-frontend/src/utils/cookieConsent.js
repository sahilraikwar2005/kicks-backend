// Versioned cookie-consent storage helpers (pure, framework-free so the
// behavior is unit-testable). Only preference flags are stored — never
// identifiers, tokens, or any sensitive information.

export const COOKIE_CONSENT_VERSION = '1';
export const COOKIE_CONSENT_KEY = 'kicks_cookie_consent';

function readRawStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
}

export function parseConsent(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (String(parsed.version) !== COOKIE_CONSENT_VERSION) return null;
    if (parsed.essential !== true) return null;
    return {
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      optional: parsed.optional === true,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export function readConsent() {
  return parseConsent(readRawStorage());
}

export function hasValidConsent() {
  return readConsent() !== null;
}

export function saveConsent({ optional }) {
  const record = {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    optional: optional === true,
    timestamp: Date.now(),
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(record));
    }
  } catch {
    // storage unavailable (private mode) — consent simply won't persist
  }
  return record;
}

export function clearConsent() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
    }
  } catch {
    // ignore storage failures
  }
}
