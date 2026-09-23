import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    size: { type: String, required: true },
    color: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
    gender: { type: String, enum: ['MEN', 'WOMEN', 'UNISEX', 'KIDS'], default: 'UNISEX' },
    // Generic product type drives the admin size UI (shoe sizes vs apparel
    // sizes vs quantity-only). Optional for backward compatibility; missing
    // values are treated as SHOES by the admin and storefront.
    type: {
      type: String,
      enum: ['SHOES', 'TSHIRT', 'LOWER', 'JERSEY', 'SOCKS', 'ACCESSORIES', 'OTHER'],
      default: 'SHOES',
      index: true,
    },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    images: [{ type: String }],
    // Optional per-color galleries: { "Black": ["https://..."], "White": [...] }.
    // Priority on the storefront: variant.images → colorImages[color] → images[].
    colorImages: { type: Map, of: [String] },
    variants: [variantSchema],
    tags: [{ type: String, index: true }],
    price: { type: Number, default: 0 },
    salePrice: { type: Number, default: null },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true },
    featured: { type: Boolean, default: false, index: true },
    newArrival: { type: Boolean, default: false, index: true },
    bestSeller: { type: Boolean, default: false, index: true },
    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ brand: 1, status: 1 });
productSchema.index({ featured: 1, status: 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

const Product = mongoose.model('Product', productSchema);

export default Product;
