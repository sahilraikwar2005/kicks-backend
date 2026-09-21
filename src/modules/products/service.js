import mongoose from 'mongoose';
import Product from './model.js';
import Brand from '../brands/model.js';
import { buildSku, isWellFormedSku, withUniqueSuffix } from './sku.js';

const buildProductQuery = (filters = {}) => {
  const query = filters.includeAllStatuses ? {} : { status: 'PUBLISHED' };

  if (filters.status === 'PUBLISHED' || filters.status === 'DRAFT' || filters.status === 'ARCHIVED') query.status = filters.status;
  if (filters.featured === true || filters.featured === 'true') query.featured = true;

  if (filters.category) query.category = filters.category;
  if (filters.brand) query.brand = filters.brand;
  if (filters.gender) query.gender = filters.gender;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
      { tags: { $in: [new RegExp(filters.search, 'i')] } },
    ];
  }

  if (filters.minPrice || filters.maxPrice) {
    query.price = {};
    if (filters.minPrice) query.price.$gte = Number(filters.minPrice);
    if (filters.maxPrice) query.price.$lte = Number(filters.maxPrice);
  }

  if (filters.size) {
    query['variants.size'] = filters.size;
  }

  if (filters.color) {
    query['variants.color'] = filters.color;
  }

  return query;
};

const buildSort = (sort = 'newest') => {
  const sorts = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    featured: { featured: -1, createdAt: -1 },
  };
  return sorts[sort] || sorts.newest;
};

const normalizeSku = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().toUpperCase();
};

const comboKey = (size, color) => `${String(size || '').trim().toLowerCase()}::${String(color || '').trim().toLowerCase()}`;

const resolveBrandName = async (brandRef) => {
  if (!brandRef) return '';
  if (typeof brandRef === 'object' && brandRef.name) return String(brandRef.name);
  if (!mongoose.isValidObjectId(brandRef)) return String(brandRef);
  const brand = await Brand.findById(brandRef).select('name').lean();
  return brand?.name || '';
};

const skuUsedElsewhere = async (sku, excludedProductId = null) => {
  const conflict = await Product.findOne({
    _id: excludedProductId ? { $ne: excludedProductId } : { $ne: null },
    'variants.sku': sku,
  }).select('_id').lean();
  return Boolean(conflict);
};

// Assigns final SKUs: keeps a supplied SKU when it is well-formed and free,
// otherwise generates the deterministic BRAND-MODEL-COLOR-SIZE SKU (with a
// -2/-3 suffix on collision). Existing SKUs survive ordinary edits because the
// frontend resends the stored SKU whenever size/color/name/brand are unchanged
// and the deterministic base matches it.
async function finalizeVariantSkus({ variants, brandName, modelName, excludedProductId = null, existingByCombo = new Map() }) {
  const taken = new Set();
  const finalized = [];
  for (const variant of variants) {
    const base = buildSku({ brand: brandName, model: modelName, color: variant?.color, size: variant?.size });
    const incoming = normalizeSku(variant?.sku);
    const existingSku = existingByCombo.get(comboKey(variant?.size, variant?.color)) || '';
    let sku = '';
    const supplied = incoming && isWellFormedSku(incoming) ? incoming : '';
    if (supplied && supplied === existingSku && supplied === base) {
      sku = supplied;
    } else if (supplied) {
      // An explicitly supplied SKU that collides is a conflict, never something
      // to silently rewrite. Only system-generated SKUs take the suffix path.
      if (taken.has(supplied) || (await skuUsedElsewhere(supplied, excludedProductId))) {
        const conflict = new Error('SKU already exists');
        conflict.statusCode = 409;
        throw conflict;
      }
      sku = supplied;
    } else {
      let candidate = withUniqueSuffix(base, taken);
      while (await skuUsedElsewhere(candidate, excludedProductId)) {
        taken.add(candidate);
        candidate = withUniqueSuffix(base, taken);
      }
      sku = candidate;
    }
    taken.add(sku);
    finalized.push({ ...variant, sku });
  }
  return finalized;
}

const createSkuConflictError = () => {
  const error = new Error('SKU already exists');
  error.statusCode = 409;
  return error;
};

export const productService = {
  normalizeSku,

  validateVariantSkuUniqueness(variants = []) {
    const seen = new Set();
    for (const variant of variants) {
      if (!variant?.sku) continue;
      const normalized = normalizeSku(variant.sku);
      if (!normalized) continue;
      if (seen.has(normalized)) {
        const error = new Error('Variant SKUs must be unique');
        error.statusCode = 409;
        throw error;
      }
      seen.add(normalized);
    }
    return true;
  },

  async validateGlobalVariantSkuUniqueness(variants = [], excludedProductId = null) {
    const normalizedVariants = (variants || []).map((variant) => ({ ...variant, sku: normalizeSku(variant?.sku) })).filter((variant) => variant.sku);
    if (normalizedVariants.length === 0) return;

    const seen = new Set();
    for (const variant of normalizedVariants) {
      if (seen.has(variant.sku)) {
        throw createSkuConflictError();
      }
      seen.add(variant.sku);
    }

    const conflicts = await Product.findOne({
      _id: excludedProductId ? { $ne: excludedProductId } : { $ne: null },
      'variants.sku': { $in: Array.from(seen) },
    });

    if (conflicts) {
      throw createSkuConflictError();
    }
  },

  async listProducts(filters = {}) {
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 12);
    const skip = (page - 1) * limit;
    const query = buildProductQuery(filters);

    const [items, total] = await Promise.all([
      Product.find(query)
        .populate('brand category')
        .sort(buildSort(filters.sort))
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getProductBySlug(slug) {
    const product = await Product.findOne({ slug }).populate('brand category');
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
    return product;
  },

  async createProduct(payload) {
    const allowedFields = ['name', 'slug', 'brand', 'category', 'gender', 'description', 'shortDescription', 'images', 'variants', 'tags', 'price', 'salePrice', 'status', 'featured', 'newArrival', 'bestSeller', 'seo'];
    const cleanPayload = Object.fromEntries(allowedFields.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    if (cleanPayload.salePrice !== undefined && cleanPayload.salePrice !== null && cleanPayload.salePrice > cleanPayload.price) { const error = new Error('Sale price cannot exceed price'); error.statusCode = 400; throw error; }

    const basePrice = Number(cleanPayload.price || 0);
    const slug = cleanPayload.slug || cleanPayload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const brandName = await resolveBrandName(cleanPayload.brand);
    const modelName = cleanPayload.name;
    const rawVariants = Array.isArray(cleanPayload.variants) && cleanPayload.variants.length > 0
      ? cleanPayload.variants
      : [{
        sku: '',
        size: 'US 9',
        color: 'Black',
        price: basePrice,
        stock: 10,
      }];
    const variants = await finalizeVariantSkus({ variants: rawVariants, brandName, modelName });

    productService.validateVariantSkuUniqueness(variants);
    await productService.validateGlobalVariantSkuUniqueness(variants);

    try {
      const product = await Product.create({
        ...cleanPayload,
        variants,
        price: basePrice,
        slug,
        status: payload.status || 'PUBLISHED',
      });
      return product;
    } catch (error) {
      if (error.code === 11000) {
        throw createSkuConflictError();
      }
      throw error;
    }
  },

  async updateProduct(id, payload) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid product id');
      error.statusCode = 400;
      throw error;
    }

    const allowedFields = ['name', 'slug', 'brand', 'category', 'gender', 'description', 'shortDescription', 'images', 'variants', 'tags', 'price', 'salePrice', 'status', 'featured', 'newArrival', 'bestSeller', 'seo'];
    const cleanPayload = Object.fromEntries(allowedFields.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    if (cleanPayload.salePrice !== undefined && cleanPayload.salePrice !== null && cleanPayload.price !== undefined && cleanPayload.salePrice > cleanPayload.price) { const error = new Error('Sale price cannot exceed price'); error.statusCode = 400; throw error; }

    if (cleanPayload.variants) {
      const existing = await Product.findById(id).select('name brand variants').lean();
      if (!existing) {
        const error = new Error('Product not found');
        error.statusCode = 404;
        throw error;
      }
      const brandName = await resolveBrandName(cleanPayload.brand !== undefined ? cleanPayload.brand : existing.brand);
      const modelName = cleanPayload.name !== undefined ? cleanPayload.name : existing.name;
      const existingByCombo = new Map(
        (existing.variants || []).map((variant) => [comboKey(variant?.size, variant?.color), normalizeSku(variant?.sku)]),
      );
      const finalizedVariants = await finalizeVariantSkus({
        variants: cleanPayload.variants,
        brandName,
        modelName,
        excludedProductId: id,
        existingByCombo,
      });
      productService.validateVariantSkuUniqueness(finalizedVariants);
      await productService.validateGlobalVariantSkuUniqueness(finalizedVariants, id);
      cleanPayload.variants = finalizedVariants;
    }

    try {
      const product = await Product.findByIdAndUpdate(id, cleanPayload, { new: true, runValidators: true });
      if (!product) {
        const error = new Error('Product not found');
        error.statusCode = 404;
        throw error;
      }
      return product;
    } catch (error) {
      if (error.code === 11000) {
        throw createSkuConflictError();
      }
      throw error;
    }
  },

  async deleteProduct(id) {
    if (!mongoose.isValidObjectId(id)) {
      const error = new Error('Invalid product id');
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findByIdAndUpdate(id, { status: 'ARCHIVED' }, { new: true });
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
    return true;
  },
};
