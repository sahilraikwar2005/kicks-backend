import test from 'node:test';
import assert from 'node:assert/strict';
import { addressSchema } from '../src/modules/addresses/validation.js';
import {
  canonicalState,
  isIndianPincodeFormat,
  pincodeStateMatches,
} from '../src/modules/addresses/indiaLocations.js';

const validAddress = () => ({
  firstName: 'Aisha',
  lastName: 'Patel',
  phone: '9876543210',
  addressLine1: '221, MG Road',
  city: 'Bhopal',
  state: 'Madhya Pradesh',
  postalCode: '462001',
  country: 'India',
});

test('address validation accepts a well-formed Indian address', () => {
  const { error, value } = addressSchema.validate(validAddress());
  assert.equal(error, undefined);
  assert.equal(value.postalCode, '462001');
});

test('address validation rejects malformed pincodes (not merely non-6-digit)', () => {
  for (const postalCode of ['4620', '4620011', '062001', 'ABCDEF', '46 2001', '']) {
    const { error } = addressSchema.validate({ ...validAddress(), postalCode });
    assert.ok(error, `expected rejection for ${JSON.stringify(postalCode)}`);
  }
});

test('address validation accepts the 462001 example pincode', () => {
  const { error } = addressSchema.validate({ ...validAddress(), postalCode: '462001' });
  assert.equal(error, undefined);
});

test('address validation rejects unknown states but accepts codes', () => {
  assert.equal(addressSchema.validate({ ...validAddress(), state: 'Narnia' }).error !== undefined, true);
  const { error } = addressSchema.validate({ ...validAddress(), state: 'MH', city: 'Mumbai', postalCode: '400001' });
  assert.equal(error, undefined);
  assert.equal(canonicalState('MH'), 'Maharashtra');
});

test('pincode helpers enforce format and state consistency', () => {
  assert.equal(isIndianPincodeFormat('462001'), true);
  assert.equal(isIndianPincodeFormat('062001'), false);
  assert.equal(isIndianPincodeFormat('4620'), false);
  assert.equal(pincodeStateMatches('Madhya Pradesh', 'Madhya Pradesh'), true);
  assert.equal(pincodeStateMatches('Madhya Pradesh', 'MP'), true);
  assert.equal(pincodeStateMatches('Madhya Pradesh', 'MH'), false);
  assert.equal(pincodeStateMatches('Madhya Pradesh', 'Maharashtra'), false);
  assert.equal(pincodeStateMatches('Madhya Pradesh', ''), false);
});
