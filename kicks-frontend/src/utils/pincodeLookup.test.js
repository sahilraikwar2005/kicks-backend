import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { lookupPincode, PincodeNotFoundError, PINCODE_RE } from './pincodeLookup.js';

// Provider-layer tests for the checkout pincode lookup. The network is fully
// mocked: no test may hit api.postalpincode.in or any database.
const PIN_OK = '462044';
const PIN_OTHER = '110001';
const PIN_MISSING = '999999';

const successPayload = (district = 'Bhopal', state = 'Madhya Pradesh') => ([
  {
    Status: 'Success',
    PostOffice: [
      { Name: 'Area One', District: district, State: state },
      { Name: 'Area Two', District: district, State: state },
    ],
  },
]);

const realFetch = globalThis.fetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = async (url) => {
    fetchCalls.push(url);
    assert.match(String(url), /^https:\/\/api\.postalpincode\.in\/pincode\/\d{6}$/);
    return { ok: true, json: async () => successPayload() };
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('lookupPincode', () => {
  it('valid PIN resolves with state/city/areas', async () => {
    const result = await lookupPincode(PIN_OK);
    assert.equal(result.pincode, PIN_OK);
    assert.equal(result.city, 'Bhopal');
    assert.equal(result.state, 'Madhya Pradesh');
    assert.deepEqual(result.areas, ['Area One', 'Area Two']);
    assert.equal(fetchCalls.length, 1);
  });

  it('short PIN never hits the network and throws a validation error', async () => {
    await assert.rejects(() => lookupPincode('4620'), PincodeNotFoundError);
    await assert.rejects(() => lookupPincode('46204'), PincodeNotFoundError);
    assert.equal(fetchCalls.length, 0);
    assert.equal(PINCODE_RE.test('46204'), false);
  });

  it('PIN starting with 0 never hits the network', async () => {
    await assert.rejects(() => lookupPincode('062044'), PincodeNotFoundError);
    assert.equal(fetchCalls.length, 0);
  });

  it('provider reports failure -> PincodeNotFoundError and loading can clear', async () => {
    globalThis.fetch = async () => {
      fetchCalls.push('called');
      return { ok: true, json: async () => [{ Status: 'Error', PostOffice: [] }] };
    };
    await assert.rejects(() => lookupPincode(PIN_MISSING), PincodeNotFoundError);
  });

  it('empty post-office list -> PincodeNotFoundError', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => [{ Status: 'Success', PostOffice: [] }] });
    await assert.rejects(() => lookupPincode(PIN_MISSING), PincodeNotFoundError);
  });

  it('network failure -> PROVIDER_UNREACHABLE (loading must clear, not hang)', async () => {
    globalThis.fetch = async () => { throw new Error('socket hang up'); };
    await assert.rejects(() => lookupPincode(PIN_OTHER), /unreachable/i);
    try {
      await lookupPincode('400001');
      assert.fail('should have thrown');
    } catch (error) {
      assert.equal(error.code, 'PROVIDER_UNREACHABLE');
    }
  });

  it('backend 500 (response not ok) -> PROVIDER_ERROR', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => null });
    try {
      await lookupPincode('400002');
      assert.fail('should have thrown');
    } catch (error) {
      assert.equal(error.code, 'PROVIDER_ERROR');
    }
  });

  it('malformed provider body -> PROVIDER_ERROR', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => { throw new SyntaxError('bad json'); },
    });
    try {
      await lookupPincode('400003');
      assert.fail('should have thrown');
    } catch (error) {
      assert.equal(error.code, 'PROVIDER_ERROR');
    }
  });

  it('hung provider aborts via timeout -> PROVIDER_UNREACHABLE', { timeout: 20000 }, async () => {
    globalThis.fetch = (_url, { signal } = {}) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
    try {
      await lookupPincode('400004');
      assert.fail('should have thrown');
    } catch (error) {
      assert.equal(error.code, 'PROVIDER_UNREACHABLE');
    }
  });

  it('repeat lookup of a validated PIN uses cache, no second request', async () => {
    const first = await lookupPincode('400005');
    assert.equal(first.cached ?? false, false);
    const second = await lookupPincode('400005');
    assert.equal(second.cached, true);
    assert.equal(second.city, first.city);
    assert.equal(fetchCalls.length, 1);
  });
});
