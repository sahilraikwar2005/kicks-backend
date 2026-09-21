// Deterministic SKU generation for KICKS variants.
// Format: BRAND-MODEL-COLOR-SIZE (segments that cannot be derived are skipped).
// Examples: NIKE-AIRFORCE1-WHT-UK8, JORDAN-1RETROHIGH-BLK-UK8, ADIDAS-SAMBA-GRN-UK7
// The frontend mirrors this algorithm so displayed SKUs match persisted ones.

const COLOR_CODES = {
  WHITE: 'WHT',
  BLACK: 'BLK',
  RED: 'RED',
  BLUE: 'BLU',
  GREEN: 'GRN',
  GREY: 'GRY',
  GRAY: 'GRY',
  YELLOW: 'YLW',
  ORANGE: 'ORG',
  PINK: 'PNK',
  PURPLE: 'PUR',
  BROWN: 'BRN',
  BEIGE: 'BGE',
  NAVY: 'NVY',
  GOLD: 'GLD',
  SILVER: 'SLV',
  CREAM: 'CRM',
  IVORY: 'IVR',
  TAN: 'TAN',
  MAROON: 'MRN',
  TEAL: 'TEA',
  CYAN: 'CYN',
  LIME: 'LIM',
  OLIVE: 'OLV',
  KHAKI: 'KHK',
  CORAL: 'COR',
  SALMON: 'SAL',
  BURGUNDY: 'BUR',
  CHARCOAL: 'CHR',
  MINT: 'MNT',
  SKY: 'SKY',
  ROYAL: 'RYL',
  CRIMSON: 'CRM',
  INDIGO: 'IND',
  VIOLET: 'VIO',
  MAGENTA: 'MAG',
  TURQUOISE: 'TRQ',
  MUSTARD: 'MUS',
  RUST: 'RST',
  COBALT: 'CBL',
  DENIM: 'DNM',
  MULTI: 'MLT',
  MULTICOLOR: 'MLT',
  MULTICOLOUR: 'MLT',
};

export function sanitizeSegment(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return cleaned;
}

export function brandToken(brandName) {
  const compact = sanitizeSegment(brandName).replace(/-/g, '').slice(0, 10);
  return compact;
}

export function modelToken(productName, brandName) {
  const brand = sanitizeSegment(brandName).replace(/-/g, '');
  let compact = sanitizeSegment(productName).replace(/-/g, '');
  if (brand && compact.startsWith(brand)) {
    compact = compact.slice(brand.length);
  }
  compact = compact.slice(0, 12);
  return compact || 'ITEM';
}

export function colorCode(color) {
  const tokens = String(color || '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
    .slice(0, 3);
  if (tokens.length === 0) return '';
  const coded = tokens.map((token) => COLOR_CODES[token] || token.slice(0, 3)).join('');
  return coded.slice(0, 9);
}

export function sizeCode(size) {
  return sanitizeSegment(size).replace(/-/g, '');
}

export function buildSku({ brand, model, color, size }) {
  const segments = [
    brandToken(brand),
    modelToken(model, brand),
    colorCode(color),
    sizeCode(size),
  ].filter(Boolean);
  if (segments.length < 2) return `KICKS-${segments.join('-') || 'ITEM'}`;
  return segments.join('-');
}

export function withUniqueSuffix(baseSku, takenSet) {
  const base = String(baseSku || '').trim().toUpperCase() || 'KICKS-ITEM';
  if (!takenSet.has(base)) return base;
  let counter = 2;
  while (takenSet.has(`${base}-${counter}`)) {
    counter += 1;
    if (counter > 9999) throw new Error('Unable to allocate a unique SKU');
  }
  return `${base}-${counter}`;
}

export function isWellFormedSku(value) {
  const sku = String(value || '').trim().toUpperCase();
  return sku.length >= 1 && sku.length <= 60 && /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(sku);
}
