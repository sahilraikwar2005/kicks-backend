// Neutral product-image placeholder used ONLY when a product genuinely has no
// image. This is intentionally not a product photo: real product images always
// win via `product.images[0]`. Never use demo/stock sneaker photos here.

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#141414"/><text x="400" y="415" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" letter-spacing="18" text-anchor="middle" fill="#2e2e2e">AJ SPORTS</text></svg>`;

export const NEUTRAL_PRODUCT_IMAGE = `data:image/svg+xml,${encodeURIComponent(svg)}`;

export function primaryProductImage(product) {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  return images.length > 0 ? images[0] : NEUTRAL_PRODUCT_IMAGE;
}

export function allProductImages(product) {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  return images.length > 0 ? images : [NEUTRAL_PRODUCT_IMAGE];
}
