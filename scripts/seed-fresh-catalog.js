// AJ SPORTS fresh demo catalog: 10 shoes + 3 tees + 3 lowers + 3 shorts + 3 socks.
// - Development database only (kicks-dev guard + production refusal).
// - ONE PRODUCT = ONE COLOR; SHORTS type included.
// - Each product gets unique image(s): download once, upload through the
//   existing Cloudinary pipeline, store only Cloudinary URLs.
// - Creation goes through productService (automatic SKU, validation).
// - Idempotent by slug; never touches users/orders/payments/shipping.

import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import Brand from '../src/modules/brands/model.js';
import Category from '../src/modules/categories/model.js';
import Product from '../src/modules/products/model.js';
import Inventory from '../src/modules/inventory/model.js';
import { productService } from '../src/modules/products/service.js';

const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const CATALOG = [
  { name: 'AJ Sprint Runner', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'Red', price: 3499, salePrice: 2999, flags: { featured: true, bestSeller: true }, sizes: [['UK 6', 2], ['UK 7', 4], ['UK 8', 3], ['UK 9', 1], ['UK 10', 0]], images: [U('1549298916-b41d501d3772'), U('1600269452121-4f2416e55c28')], desc: 'A lightweight daily runner with responsive cushioning for tempo days and easy miles.' },
  { name: 'AJ Velocity Run', category: 'Running', type: 'SHOES', gender: 'MEN', color: 'Blue', price: 4299, salePrice: null, flags: { newArrival: true }, sizes: [['UK 6', 1], ['UK 7', 2], ['UK 8', 5], ['UK 9', 2]], images: [U('1556906781-9a412961c28c'), U('1597045566677-8cf032ed6634')], desc: 'Built for steady mileage with a stable ride and breathable upper.' },
  { name: 'AJ Court Flex', category: 'Lifestyle', type: 'SHOES', gender: 'UNISEX', color: 'White', price: 2999, salePrice: 2499, flags: {}, sizes: [['UK 6', 3], ['UK 7', 3], ['UK 8', 1], ['UK 9', 0]], images: [U('1560769629-975ec94e6a86'), U('1605348532760-6753d2c43329')], desc: 'A clean court-inspired sneaker that pairs with everything in your rotation.' },
  { name: 'AJ Street Force', category: 'Lifestyle', type: 'SHOES', gender: 'MEN', color: 'Black', price: 3999, salePrice: null, flags: { bestSeller: true }, sizes: [['UK 7', 2], ['UK 8', 4], ['UK 9', 2], ['UK 10', 1]], images: [U('1600185365926-3a2ce3cdb9eb'), U('1595341888016-a392ef81b7de')], desc: 'Street-ready staple with durable construction for everyday wear.' },
  { name: 'AJ Trail Motion', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'Green', price: 4799, salePrice: null, flags: { newArrival: true }, sizes: [['UK 6', 0], ['UK 7', 2], ['UK 8', 3], ['UK 9', 1]], images: [U('1539185441755-769473a23570'), U('1465453869711-7e174808ace9')], desc: 'Grippy trail silhouette for park loops and light off-road miles.' },
  { name: 'AJ Training Pro', category: 'Training', type: 'SHOES', gender: 'UNISEX', color: 'Grey', price: 3299, salePrice: 2799, flags: {}, sizes: [['UK 6', 2], ['UK 7', 1], ['UK 8', 4], ['UK 9', 2]], images: [U('1603808033192-082d6919d3e1'), U('1514989940723-e8e51635b782')], desc: 'Stable training shoe for lifts, circuits and agility work.' },
  { name: 'AJ Marathon X', category: 'Running', type: 'SHOES', gender: 'MEN', color: 'Orange', price: 5499, salePrice: null, flags: { featured: true }, sizes: [['UK 7', 1], ['UK 8', 2], ['UK 9', 0], ['UK 10', 1]], images: [U('1533867617858-e7b97e060509'), U('1525966222134-fcfa99b8ae77')], desc: 'Long-distance comfort with soft landings for marathon prep.' },
  { name: 'AJ Power Lift', category: 'Training', type: 'SHOES', gender: 'UNISEX', color: 'Black/Red', price: 4999, salePrice: 4499, flags: {}, sizes: [['UK 6', 1], ['UK 7', 3], ['UK 8', 2], ['UK 9', 1]], images: [U('1512374382149-233c42b6a83b'), U('1584735175315-9d5df23860e6')], desc: 'Flat, planted base for heavy lifts and strength sessions.' },
  { name: 'AJ Football Speed', category: 'Training', type: 'SHOES', gender: 'MEN', color: 'White/Blue', price: 3799, salePrice: null, flags: { newArrival: true }, sizes: [['UK 6', 2], ['UK 7', 0], ['UK 8', 4], ['UK 9', 3]], images: [U('1608231387042-66d1773070a5'), U('1552346154-21d32810aba3')], desc: 'Light and quick for pitch sessions and speed drills.' },
  { name: 'AJ Urban Runner', category: 'Lifestyle', type: 'SHOES', gender: 'WOMEN', color: 'Navy', price: 2499, salePrice: 1999, flags: { bestSeller: true }, sizes: [['UK 6', 4], ['UK 7', 5], ['UK 8', 2]], images: [U('1520639888713-7851133b1ed0'), U('1607522370275-f14206abe5d3')], desc: 'Everyday comfort runner styled for city miles.' },
  { name: 'AJ Performance Dry-Fit Tee', category: 'Training', type: 'TSHIRT', gender: 'UNISEX', color: 'Black', price: 899, salePrice: 749, flags: { featured: true, bestSeller: true }, sizes: [['S', 2], ['M', 5], ['L', 3], ['XL', 1], ['XXL', 0]], images: [U('1521572163474-6864f9cf17ab')] },
  { name: 'AJ Training Core Tee', category: 'Training', type: 'TSHIRT', gender: 'MEN', color: 'Grey', price: 749, salePrice: null, flags: {}, sizes: [['S', 1], ['M', 3], ['L', 4], ['XL', 2]], images: [U('1576566588028-4147f3842f27')] },
  { name: 'AJ Running Motion Tee', category: 'Running', type: 'TSHIRT', gender: 'WOMEN', color: 'White', price: 1099, salePrice: 899, flags: { newArrival: true }, sizes: [['S', 3], ['M', 2], ['L', 1], ['XL', 0]], images: [U('1583743814966-8936f5b7be1a'), U('1503341504253-dff4815485f1')] },
  { name: 'AJ Performance Track Lower', category: 'Training', type: 'LOWER', gender: 'MEN', color: 'Black', price: 1499, salePrice: 1299, flags: {}, sizes: [['S', 1], ['M', 3], ['L', 2], ['XL', 2], ['XXL', 0]], images: [U('1571019613454-1cb2f99b2d8b')] },
  { name: 'AJ Training Flex Lower', category: 'Training', type: 'LOWER', gender: 'WOMEN', color: 'Navy', price: 1599, salePrice: null, flags: { newArrival: true }, sizes: [['S', 2], ['M', 4], ['L', 1], ['XL', 1]], images: [U('1518310383802-640c2de311b2')] },
  { name: 'AJ Pro Running Lower', category: 'Running', type: 'LOWER', gender: 'UNISEX', color: 'Grey', price: 1399, salePrice: null, flags: {}, sizes: [['S', 0], ['M', 2], ['L', 3], ['XL', 1]], images: [U('1506629082955-511b1aa562c8')] },
  { name: 'AJ Running Shorts', category: 'Running', type: 'SHORTS', gender: 'MEN', color: 'Black', price: 899, salePrice: 749, flags: { bestSeller: true }, sizes: [['S', 2], ['M', 5], ['L', 3], ['XL', 1]], images: [U('1461896836934-ffe607ba8211')] },
  { name: 'AJ Training Shorts', category: 'Training', type: 'SHORTS', gender: 'UNISEX', color: 'Grey', price: 799, salePrice: null, flags: {}, sizes: [['S', 1], ['M', 3], ['L', 2], ['XL', 0]], images: [U('1476480862126-209bfaa8edc8')] },
  { name: 'AJ Football Shorts', category: 'Training', type: 'SHORTS', gender: 'MEN', color: 'Blue', price: 999, salePrice: 849, flags: { featured: true }, sizes: [['S', 3], ['M', 4], ['L', 2], ['XL', 1]], images: [U('1538805060514-97d9cc17730c')] },
  { name: 'AJ Performance Crew Socks', category: 'Running', type: 'SOCKS', gender: 'UNISEX', color: 'White', price: 299, salePrice: null, flags: {}, sizes: [['Free Size', 12]], images: [U('1586350977771-b3b0abd50c82')] },
  { name: 'AJ Football Grip Socks', category: 'Training', type: 'SOCKS', gender: 'UNISEX', color: 'Black', price: 349, salePrice: 299, flags: {}, sizes: [['Free Size', 8]], images: [U('1614164185128-e4ec99c436d7')] },
  { name: 'AJ Running Ankle Socks', category: 'Running', type: 'SOCKS', gender: 'UNISEX', color: 'Grey', price: 249, salePrice: null, flags: { newArrival: true }, sizes: [['Free Size', 15]], images: [U('1548839140-29a749e1cf4d')] },
];

const toSlug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status} for ${url}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`Not an image (${contentType}) for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error(`Empty download for ${url}`);
  return { buffer, mimetype: 'image/jpeg', originalname: `seed-${Date.now()}.jpg`, size: buffer.length };
}

async function main() {
  if (env.nodeEnv === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error('SEED BLOCKED in production. Set ALLOW_SEED_IN_PRODUCTION=true to override explicitly.');
    process.exit(1);
  }
  await connectDatabase();
  try {
    const dbName = (process.env.MONGO_URI || '').split('?')[0].split('/').pop();
    console.log('TARGET_DB=' + dbName);
    if (dbName !== 'kicks-dev') {
      console.error('REFUSING: expected kicks-dev database.');
      process.exit(1);
    }
    const before = await Product.countDocuments();
    console.log('PRODUCTS_BEFORE=' + before);

    let brand = await Brand.findOne({ slug: 'aj-sports' }).lean();
    if (!brand) {
      brand = await Brand.create({ name: 'AJ SPORTS', slug: 'aj-sports', description: 'AJ SPORTS own-label training essentials.', isActive: true });
      console.log('BRAND_CREATED=AJ SPORTS');
    }

    const neededCategories = [...new Set(CATALOG.map((item) => item.category))];
    for (const name of neededCategories) {
      const slug = toSlug(name);
      const found = await Category.findOne({ slug }).lean();
      if (!found) {
        await Category.create({ name, slug, description: `${name} products at AJ SPORTS.`, isActive: true });
        console.log(`CATEGORY_CREATED=${name}`);
      }
    }

    let created = 0;
    let skipped = 0;
    let uploaded = 0;
    for (const item of CATALOG) {
      const slug = toSlug(item.name);
      if (await Product.findOne({ slug }).lean()) {
        skipped += 1;
        continue;
      }
      const category = await Category.findOne({ name: item.category }).lean();
      if (!category) throw new Error(`Missing category ${item.category} for ${item.name}`);
      const images = [];
      for (const url of item.images) {
        const file = await downloadImage(url);
        const { uploadToCloudinary } = await import('../src/services/cloudinary.service.js');
        const result = await uploadToCloudinary(file, 'kicks/products');
        if (!result?.secure_url && !result?.url) throw new Error(`Cloudinary returned no URL for ${item.name}`);
        images.push(result.secure_url || result.url);
        uploaded += 1;
      }
      const product = await productService.createProduct({
        name: item.name,
        slug,
        brand: brand._id,
        category: category._id,
        gender: item.gender,
        type: item.type,
        description: item.desc,
        shortDescription: `${item.name} — ${item.color}.`,
        tags: [item.type.toLowerCase(), item.color.split('/')[0].toLowerCase()],
        price: item.price,
        salePrice: item.salePrice,
        status: 'PUBLISHED',
        featured: Boolean(item.flags.featured),
        newArrival: Boolean(item.flags.newArrival),
        bestSeller: Boolean(item.flags.bestSeller),
        images,
        colorImages: {},
        variants: item.sizes.map(([size, stock]) => ({ size, color: item.color, price: item.price, salePrice: item.salePrice, stock, sku: '', images: [] })),
      });
      for (const variant of product.variants) {
        await Inventory.create({
          product: product._id,
          variant: variant._id,
          availableStock: variant.stock,
          reservedStock: 0,
          soldStock: 0,
          lowStockThreshold: 5,
        });
      }
      created += 1;
      console.log(`PRODUCT_CREATED=${item.name} | ${item.type} | variants=${product.variants.length}`);
    }

    const products = await Product.find({}).lean();
    let variants = 0;
    let zeroStock = 0;
    let stockTotal = 0;
    const skus = new Set();
    let dupSkus = 0;
    let badImages = 0;
    const byType = {};
    for (const p of products) {
      byType[p.type || 'MISSING'] = (byType[p.type || 'MISSING'] || 0) + 1;
      for (const v of p.variants || []) {
        variants += 1;
        stockTotal += Number(v.stock || 0);
        if (Number(v.stock) === 0) zeroStock += 1;
        if (!v.sku || skus.has(v.sku)) dupSkus += 1;
        skus.add(v.sku);
      }
      for (const url of p.images || []) {
        if (typeof url !== 'string' || !/^https:\/\/res\.cloudinary\.com\//.test(url)) badImages += 1;
      }
      if ((p.images || []).length === 0) badImages += 1;
    }
    const allUrls = products.flatMap((p) => p.images || []);
    console.log('VERIFY_PRODUCTS=' + products.length);
    console.log('VERIFY_BY_TYPE=' + JSON.stringify(byType));
    console.log('VERIFY_VARIANTS=' + variants);
    console.log('VERIFY_STOCK_TOTAL=' + stockTotal);
    console.log('VERIFY_ZERO_STOCK_VARIANTS=' + zeroStock);
    console.log('VERIFY_DUP_SKUS=' + dupSkus);
    console.log('VERIFY_BAD_IMAGES=' + badImages);
    console.log('VERIFY_IMAGE_URLS=' + allUrls.length + '/' + new Set(allUrls).size + ' (total/unique)');
    console.log(`SUMMARY created=${created} skipped=${skipped} uploaded=${uploaded}`);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('FRESH SEED FAILED');
  console.error(error);
  process.exit(1);
});
