// Pure helpers resolving which images belong to a selected color and how the
// product gallery falls back. Priority: variant.images → colorImages[color] →
// product.images[] → []. Callers append their own neutral placeholder.
import { colorKey, normalizeColorName } from './variantMatrix.js';

export function urlList(value) {
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
    if (colorKey(name) === wanted) return urlList(urls);
  }
  return [];
}

// All colors that have a dedicated gallery, in stored order.
export function colorsWithGalleries(product) {
  const source = product?.colorImages;
  if (!source) return [];
  const entries = typeof source.entries === 'function' ? [...source.entries()] : Object.entries(source);
  return entries.filter(([, urls]) => urlList(urls).length > 0).map(([name]) => String(name));
}

// Full gallery resolution for a selected variant + color.
export function resolveGalleryImages({ product, variant, color }) {
  const variantImages = urlList(variant?.images);
  if (variantImages.length > 0) return variantImages;
  const colorImages = getColorImages(product, color);
  if (colorImages.length > 0) return colorImages;
  return urlList(product?.images);
}

// Preferred single thumbnail for a color swatch:
// colorImages[color][0] → first matching variant image → product.images[0].
export function colorThumbnail(product, color) {
  const gallery = getColorImages(product, color);
  if (gallery.length > 0) return gallery[0];
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const wanted = colorKey(color);
  const match = variants.find((variant) => colorKey(variant?.color) === wanted && urlList(variant?.images).length > 0);
  if (match) return urlList(match.images)[0];
  const general = urlList(product?.images);
  return general.length > 0 ? general[0] : '';
}

// Cart/order line image: exact variant's gallery (color-aware) → neutral fallback.
export function cartLineImage(item, fallback = '') {
  const product = item?.product || (typeof item?.productId === 'object' ? item.productId : null) || null;
  const variantId = item?.variantId || item?.variant?._id;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const variant = variants.find((entry) => String(entry?._id) === String(variantId))
    || (item?.variant && typeof item.variant === 'object' ? item.variant : null);
  const resolved = resolveGalleryImages({ product, variant, color: variant?.color || item?.color });
  return resolved.length > 0 ? resolved[0] : fallback;
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
