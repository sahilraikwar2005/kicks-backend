// Indian states/UTs + major cities for searchable address comboboxes.
// City suggestions are always scoped: verified-pincode city first, then
// major cities of the selected state. Never an unfiltered mega-list.

export const INDIA_STATES = [
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

const norm = (value) => String(value || '').trim().toLowerCase();

export const canonicalStateName = (value) => {
  const wanted = norm(value);
  if (!wanted) return '';
  return INDIA_STATES.find((name) => norm(name) === wanted) || '';
};

// Major cities per state used as combobox suggestions alongside any
// pincode-verified city. Kept intentionally compact.
export const MAJOR_CITIES = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Tawang'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'],
  Delhi: ['New Delhi', 'Delhi'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru'],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  Manipur: ['Imphal'],
  Meghalaya: ['Shillong', 'Tura'],
  Mizoram: ['Aizawl'],
  Nagaland: ['Kohima', 'Dimapur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur'],
  Puducherry: ['Puducherry', 'Karaikal'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
  Sikkim: ['Gangtok'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad'],
  Tripura: ['Agartala'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida', 'Ghaziabad'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Roorkee'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'],
  Chandigarh: ['Chandigarh'],
  Ladakh: ['Leh', 'Kargil'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  Lakshadweep: ['Kavaratti'],
};

// Scoped city suggestions: verified city first, then state majors, deduped.
export const citySuggestions = (stateName, verifiedCity = '') => {
  const canonical = canonicalStateName(stateName);
  const majors = canonical ? MAJOR_CITIES[canonical] || [] : [];
  const seen = new Set();
  const out = [];
  for (const city of [verifiedCity, ...majors]) {
    const name = String(city || '').trim();
    if (!name) continue;
    const key = norm(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
};

export const stateSuggestions = (query) => {
  const q = norm(query);
  if (!q) return INDIA_STATES;
  return INDIA_STATES.filter((name) => norm(name).includes(q));
};

// Source-of-truth rule: a verified pincode owns the state. Returns a message
// when the user-selected state contradicts it, otherwise null.
export const pincodeStateConflictMessage = (lookup, selectedState) => {
  if (!lookup || lookup.status !== 'valid' || !lookup.result?.state) return null;
  const same = norm(lookup.result.state) === norm(selectedState);
  if (same || !norm(selectedState)) return null;
  return `This pincode belongs to ${lookup.result.state}, but ${selectedState} is selected. Please correct the state.`;
};
