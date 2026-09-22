// Pure helpers resolving which images belong to a selected color and how the
// product gallery falls back. Priority: variant.images → colorImages[color] →
// product.images[] → []. Callers append their own neutral placeholder.
import { colorKey, normalizeColorName } from './variantMatrix.js';

function toUrlList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((url) => typeof url === 'string' && url.trim()).map((url) => url.trim());
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

// colorImages may arrive as a plain object (JSON) or a Map-like. Returns the
// gallery for `color` (case-insensitive) or [].
export function getColorImages(product, color) {
  const source = product?.colorImages;
  if (!source) return [];
  const wanted = colorKey(color);
  if (!wanted) return [];
  const entries = typeof source.entries === 'function' ? [...source.entries()] : Object.entries(source);
  for (const [name, urls] of entries) {
    if (colorKey(name) === wanted) return toUrlList(urls);
  }
  return [];
}

// All colors that have a dedicated gallery, in stored order.
export function colorsWithGalleries(product) {
  const source = product?.colorImages;
  if (!source) return [];
  const entries = typeof source.entries === 'function' ? [...source.entries()] : Object.entries(source);
  return entries.filter(([, urls]) => toUrlList(urls).length > 0).map(([name]) => String(name));
}

// Full gallery resolution for a selected variant + color.
export function resolveGalleryImages({ product, variant, color }) {
  const variantImages = toUrlList(variant?.images);
  if (variantImages.length > 0) return variantImages;
  const colorImages = getColorImages(product, color);
  if (colorImages.length > 0) return colorImages;
  return toUrlList(product?.images);
}

// Distinct colors present on variants, preserving first-seen casing.
export function variantColors(variants) {
  const seen = new Set();
  const result = [];
  for (const variant of Array.isArray(variants) ? variants : []) {
    const name = normalizeColorName(variant?.color);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }
  return result;
}

// Sizes available for one color (variant order preserved).
export function sizesForColor(variants, color) {
  const wanted = colorKey(color);
  const seen = new Set();
  const result = [];
  for (const variant of Array.isArray(variants) ? variants : []) {
    const size = String(variant?.size || '').trim();
    if (!size || colorKey(variant?.color) !== wanted || seen.has(size.toLowerCase())) continue;
    seen.add(size.toLowerCase());
    result.push(size);
  }
  return result;
}

// Exact Size + Color variant or null (never a cross-color fallback).
export function variantForSelection(variants, size, color) {
  const list = Array.isArray(variants) ? variants : [];
  return list.find(
    (variant) => String(variant?.size) === String(size) && colorKey(variant?.color) === colorKey(color),
  ) || null;
}
