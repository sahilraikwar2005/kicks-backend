// Pure helpers for the Size × Color variant matrix used by the Admin
// Add/Edit Product form. Variant identity is SIZE + COLOR (normalized,
// case-insensitive). These functions never mutate their inputs.

export const normalizeColorName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const colorKey = (value) => normalizeColorName(value).toLowerCase();

export const sizeKey = (value) => String(value || '').trim().toLowerCase();

export const comboKey = (size, color) => `${sizeKey(size)}::${colorKey(color)}`;

// Unique colors preserving first-seen display casing. "Black", "black" and
// " BLACK" collapse to a single entry.
export function dedupeColors(colors) {
  const seen = new Set();
  const result = [];
  for (const entry of Array.isArray(colors) ? colors : []) {
    const name = normalizeColorName(entry);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function distinctSizes(rows) {
  const seen = new Set();
  const result = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const size = String(row?.size || '').trim();
    if (!size || seen.has(size.toLowerCase())) continue;
    seen.add(size.toLowerCase());
    result.push(size);
  }
  return result;
}

export function distinctColors(rows) {
  return dedupeColors((Array.isArray(rows) ? rows : []).map((row) => row?.color));
}

// Returns rows with every (size × color) combination present. Existing rows
// (with their stock/price/SKU data) are preserved untouched; only genuinely
// missing combinations are appended via makeRow(size, color).
export function syncMatrixRows({ rows, sizes, colors, makeRow }) {
  const current = Array.isArray(rows) ? rows : [];
  const have = new Set(current.map((row) => comboKey(row?.size, row?.color)));
  const next = [...current];
  for (const size of Array.isArray(sizes) ? sizes : []) {
    if (!String(size || '').trim()) continue;
    for (const color of Array.isArray(colors) ? colors : []) {
      if (!normalizeColorName(color)) continue;
      const key = comboKey(size, color);
      if (have.has(key)) continue;
      have.add(key);
      next.push(makeRow(size, normalizeColorName(color)));
    }
  }
  return next;
}

// Deterministic row order: sizes in the given sizeOrder, then color order.
export function orderMatrixRows(rows, sizeOrder = [], colorOrder = []) {
  const sizeRank = new Map((Array.isArray(sizeOrder) ? sizeOrder : []).map((size, index) => [sizeKey(size), index]));
  const colorRank = new Map((Array.isArray(colorOrder) ? colorOrder : []).map((color, index) => [colorKey(color), index]));
  const rankOf = (map, value) => (map.has(value) ? map.get(value) : Number.MAX_SAFE_INTEGER);
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const sizeDiff = rankOf(sizeRank, sizeKey(a?.size)) - rankOf(sizeRank, sizeKey(b?.size));
    if (sizeDiff !== 0) return sizeDiff;
    const colorDiff = rankOf(colorRank, colorKey(a?.color)) - rankOf(colorRank, colorKey(b?.color));
    if (colorDiff !== 0) return colorDiff;
    return String(a?.size || '').localeCompare(String(b?.size || ''));
  });
}
