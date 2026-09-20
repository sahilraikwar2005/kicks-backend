import Product from '../products/model.js';

export const recommendationService = {
  async forProduct(slug, limit = 8) {
    const product = await Product.findOne({ slug, status: 'PUBLISHED' }).lean();
    if (!product) { const error = new Error('Product not found'); error.statusCode = 404; throw error; }
    const query = { status: 'PUBLISHED', _id: { $ne: product._id }, $or: [{ category: product.category }, { brand: product.brand }, { gender: product.gender }, { tags: { $in: product.tags || [] } }] };
    return Product.find(query).sort({ bestSeller: -1, featured: -1, createdAt: -1 }).limit(Number(limit)).populate('brand category').lean();
  },
};
