import { useCallback, useEffect, useRef, useState } from 'react';
// Pincode lookup provider layer. All provider specifics live here —
// components only consume lookupPincode()/usePincodeLookup() and never call
// external APIs directly.
//
// Provider: India Post data via api.postalpincode.in (free, no key).
// Response: { pincode, state, city (district), areas (post-office names) }.

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const PINCODE_DEBOUNCE_MS = 700;
export const PINCODE_CACHE_LIMIT = 200;

const cache = new Map(); // code -> result (FIFO eviction)

const cacheSet = (code, result) => {
  if (cache.has(code)) cache.delete(code);
  cache.set(code, result);
  while (cache.size > PINCODE_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
};

export class PincodeNotFoundError extends Error {
  constructor(message = 'This pincode does not appear to exist. Please check the number.') {
    super(message);
    this.name = 'PincodeNotFoundError';
  }
}

const fetchWithTimeout = async (url, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const lookupPincode = async (code) => {
  const pin = String(code || '').trim();
  if (!PINCODE_RE.test(pin)) {
    throw new PincodeNotFoundError('Enter a valid 6-digit PIN code.');
  }
  if (cache.has(pin)) return { ...cache.get(pin), cached: true };

  let response;
  try {
    response = await fetchWithTimeout(`https://api.postalpincode.in/pincode/${pin}`);
  } catch {
    const error = new Error('Pincode service is unreachable. Check your connection and try again.');
    error.code = 'PROVIDER_UNREACHABLE';
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Pincode lookup failed. Please try again.');
    error.code = 'PROVIDER_ERROR';
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (!payload) {
    const error = new Error('Pincode lookup failed. Please try again.');
    error.code = 'PROVIDER_ERROR';
    throw error;
  }
  const head = Array.isArray(payload) ? payload[0] : null;
  const offices = Array.isArray(head?.PostOffice) ? head.PostOffice : [];
  if (head?.Status !== 'Success' || offices.length === 0) {
    throw new PincodeNotFoundError();
  }
  const first = offices[0];
  const result = {
    pincode: pin,
    state: String(first.State || '').trim(),
    city: String(first.District || '').trim(),
    areas: offices.slice(0, 4).map((office) => String(office.Name || '').trim()).filter(Boolean),
    cached: false,
  };
  cacheSet(pin, result);
  return result;
};

// Debounced, race-safe pincode field state machine.
// Statuses: idle | typing | checking | valid | invalid | unknown
// (unknown = provider unreachable/failed: format is fine but existence is
// unverified — the form may still submit and the backend re-validates.)
//
// Sync transitions happen as render-time adjustments (no setState-in-effect);
// only the debounced network resolution runs inside an effect.
export const usePincodeLookup = ({ value, debounceMs = PINCODE_DEBOUNCE_MS, onVerified } = {}) => {
  const pin = String(value || '').trim();
  const [snap, setSnap] = useState({ pin: null, status: 'idle', result: null, error: '' });
  const requestId = useRef(0);
  const verifiedFor = useRef('');
  const onVerifiedRef = useRef(null);
  useEffect(() => { onVerifiedRef.current = onVerified; });

  if (snap.pin !== pin) {
    if (!pin) {
      setSnap({ pin, status: 'idle', result: null, error: '' });
    } else if (!PINCODE_RE.test(pin)) {
      setSnap({
        pin,
        status: pin.length >= 6 ? 'invalid' : 'typing',
        result: null,
        error: pin.length >= 6 ? 'Enter a valid 6-digit PIN code.' : '',
      });
    } else if (cache.has(pin)) {
      setSnap({ pin, status: 'valid', result: { ...cache.get(pin), cached: true }, error: '' });
    } else {
      setSnap({ pin, status: 'checking', result: null, error: '' });
    }
  }

  // Stable identity: PincodeField subscribes `reset` as an unmount cleanup, so
  // this MUST NOT change every render — otherwise each parent re-render would
  // invalidate the in-flight request id and the lookup could never resolve.
  const reset = useCallback(() => {
    requestId.current += 1;
    verifiedFor.current = '';
    setSnap((current) => (current.status === 'idle' && current.result === null ? current : { pin: null, status: 'idle', result: null, error: '' }));
  }, [setSnap]);

  // Notify once per verified code (guarded, never during render).
  useEffect(() => {
    if (snap.status === 'valid' && snap.result && snap.pin && verifiedFor.current !== snap.pin) {
      verifiedFor.current = snap.pin;
      onVerifiedRef.current?.(snap.result);
    }
  }, [snap]);

  // Debounced network resolution for complete, uncached codes only.
  useEffect(() => {
    if (snap.pin !== pin || snap.status !== 'checking' || !PINCODE_RE.test(pin)) return undefined;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const found = await lookupPincode(pin);
        if (requestId.current !== id) return; // stale response: ignore
        setSnap({ pin, status: 'valid', result: found, error: '' });
      } catch (lookupError) {
        if (requestId.current !== id) return; // stale response: ignore
        if (lookupError?.code === 'PROVIDER_UNREACHABLE' || lookupError?.code === 'PROVIDER_ERROR') {
          setSnap({ pin, status: 'unknown', result: null, error: 'Unable to verify pincode right now. Please try again.' });
        } else {
          setSnap({ pin, status: 'invalid', result: null, error: lookupError?.message || 'This pincode does not appear to exist. Please check the number.' });
        }
      }
    }, debounceMs);
    return () => {
      requestId.current += 1;
      clearTimeout(timer);
    };
  }, [snap, pin, debounceMs]);

  return { status: snap.status, result: snap.result, error: snap.error, reset };
};
