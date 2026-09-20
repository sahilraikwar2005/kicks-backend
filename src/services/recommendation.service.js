import Product from '../modules/products/model.js';

export async function getRecommendations({ userId, category, brand, tags = [], gender }) {
  const items = await Product.find({ status: 'PUBLISHED', $or: [{ category }, { brand }, { gender }, { tags: { $in: tags } }] }).sort({ bestSeller: -1, featured: -1, createdAt: -1 }).limit(8).lean();
  return {
    userId,
    category,
    brand,
    tags,
    gender,
    items,
  };
}
