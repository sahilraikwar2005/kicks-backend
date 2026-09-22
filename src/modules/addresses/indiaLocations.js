// Shared Indian location reference for address validation.
// Used by address validation and the order-creation address guard so the
// backend never trusts contradictory or malformed location data.

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// Common abbreviations/codes accepted alongside full names.
export const INDIAN_STATE_CODES = {
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CT: 'Chhattisgarh',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  MN: 'Manipur',
  ML: 'Meghalaya',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OR: 'Odisha',
  OD: 'Odisha',
  PB: 'Punjab',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  UT: 'Uttarakhand',
  WB: 'West Bengal',
  AN: 'Andaman and Nicobar Islands',
  CH: 'Chandigarh',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  JK: 'Jammu and Kashmir',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  PY: 'Puducherry',
};

const normalize = (value) => String(value || '').trim().toLowerCase();

// Resolve any accepted state spelling/code to its canonical full name,
// or null when the value is not a recognised Indian state/UT.
export const canonicalState = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const code = INDIAN_STATE_CODES[text.toUpperCase()];
  if (code) return code;
  const wanted = normalize(text);
  return INDIAN_STATES.find((name) => normalize(name) === wanted) || null;
};

export const isIndianState = (value) => canonicalState(value) !== null;

// Indian PIN codes are 6 digits and never start with 0.
export const isIndianPincodeFormat = (value) => /^[1-9][0-9]{5}$/.test(String(value || '').trim());

// Source of truth when a verified pincode lookup exists: the selected state
// must resolve to the same canonical state the pincode belongs to.
export const pincodeStateMatches = (lookupState, selectedState) => {
  const a = canonicalState(lookupState);
  const b = canonicalState(selectedState);
  if (!a || !b) return false;
  return a === b;
};
