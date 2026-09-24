// Customer-facing product-type system for the AJ SPORTS storefront.
// Values match the backend product type enum where it exists
// (SHOES, TSHIRT, LOWER, SHORTS, SOCKS); SLIDES and CROCKS are
// frontend-only filter labels until catalog carries them.

const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

export const PRODUCT_TYPE_ORDER = ['SHOES', 'SLIDES', 'CROCKS', 'TSHIRT', 'LOWER', 'SHORTS', 'SOCKS'];

export const PRODUCT_TYPES = {
  SHOES: { label: 'Shoes', title: 'SHOES', image: img('1549298916-b41d501d3772') },
  SLIDES: { label: 'Slides', title: 'SLIDES', image: img('1603487742131-4160ec999306') },
  CROCKS: { label: 'Crocs / Clogs', title: 'CROCKS / CLOGS', image: img('1560343090-f0409e92791a') },
  TSHIRT: { label: 'T-Shirts', title: 'T-SHIRTS', image: img('1521572163474-6864f9cf17ab') },
  LOWER: { label: 'Lowers', title: 'LOWERS', image: img('1571019613454-1cb2f99b2d8b') },
  SHORTS: { label: 'Shorts', title: 'SHORTS', image: img('1461896836934-ffe607ba8211') },
  SOCKS: { label: 'Socks', title: 'SOCKS', image: img('1586350977771-b3b0abd50c82') },
};

export const FOOTWEAR_TYPES = ['SHOES', 'SLIDES', 'CROCKS'];
export const SPORTSWEAR_TYPES = ['TSHIRT', 'LOWER', 'SHORTS'];
export const ESSENTIALS_TYPES = ['SOCKS'];

export const typeLabel = (value) => PRODUCT_TYPES[value]?.label || value || '';
export const typeTitle = (value) => PRODUCT_TYPES[value]?.title || String(value || '').toUpperCase();
export const typeImage = (value) => PRODUCT_TYPES[value]?.image || '';

export const shopLinkForTypes = (types) => `/shop?type=${types.join(',')}`;
