// AJ SPORTS demo catalog reseed (development only).
// - Deletes ONLY orphaned inventory records (products already absent).
// - Downloads each product image once, uploads through the existing
//   Cloudinary pipeline, then creates single-color products via
//   productService (automatic SKU, validation, no manual SKUs).
// - Never touches users, addresses, orders, payments or shipments.
// - Refuses to run in production without explicit override.

import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import Brand from '../src/modules/brands/model.js';
import Category from '../src/modules/categories/model.js';
import Product from '../src/modules/products/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';
import { productService } from '../src/modules/products/service.js';
import { uploadToCloudinary } from '../src/services/cloudinary.service.js';

const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const CATALOG = [
  // SHOES — one product = one colorway, two unique images each.
  { name: 'PUMA ForeverRun NITRO 2', brand: 'Puma', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'Black/Grey', price: 12999, salePrice: 11499, flags: { bestSeller: true }, sizes: [['UK 6', 2], ['UK 7', 1], ['UK 8', 3], ['UK 9', 2], ['UK 10', 0]], images: [U('1556906781-9a412961c28c'), U('1597045566677-8cf032ed6634')] },
  { name: 'New Balance Fresh Foam X 880v15', brand: 'New Balance', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'White/Mint', price: 13499, salePrice: null, flags: { newArrival: true }, sizes: [['UK 6', 1], ['UK 7', 2], ['UK 8', 4], ['UK 9', 1]], images: [U('1539185441755-769473a23570'), U('1465453869711-7e174808ace9')] },
  { name: "Nike Air Force 1 '07", brand: 'Nike', category: 'Lifestyle', type: 'SHOES', gender: 'MEN', color: 'White', price: 8999, salePrice: 7999, flags: { featured: true, bestSeller: true }, sizes: [['UK 6', 3], ['UK 7', 2], ['UK 8', 5], ['UK 9', 0]], images: [U('1549298916-b41d501d3772'), U('1600269452121-4f2416e55c28')] },
  { name: 'Under Armour HOVR Phantom 3 SE', brand: 'Under Armour', category: 'Running', type: 'SHOES', gender: 'MEN', color: 'Black', price: 14999, salePrice: null, flags: {}, sizes: [['UK 7', 2], ['UK 8', 3], ['UK 9', 1], ['UK 10', 2]], images: [U('1512374382149-233c42b6a83b'), U('1584735175315-9d5df23860e6')] },
  { name: 'adidas Adizero Boston 12', brand: 'Adidas', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'Light Blue', price: 15999, salePrice: 14499, flags: { featured: true }, sizes: [['UK 6', 0], ['UK 7', 2], ['UK 8', 4], ['UK 9', 1]], images: [U('1533867617858-e7b97e060509'), U('1525966222134-fcfa99b8ae77')] },
  { name: 'Onitsuka Tiger MEXICO 66', brand: 'Onitsuka Tiger', category: 'Lifestyle', type: 'SHOES', gender: 'UNISEX', color: 'White/Dark Blue', price: 11999, salePrice: null, flags: { bestSeller: true }, sizes: [['UK 6', 2], ['UK 7', 1], ['UK 8', 2], ['UK 9', 3]], images: [U('1520639888713-7851133b1ed0'), U('1607522370275-f14206abe5d3')] },
  { name: 'PUMA Basket Classic XXI', brand: 'Puma', category: 'Lifestyle', type: 'SHOES', gender: 'UNISEX', color: 'White/Black', price: 7499, salePrice: 6499, flags: {}, sizes: [['UK 6', 4], ['UK 7', 3], ['UK 8', 2]], images: [U('1600185365926-3a2ce3cdb9eb'), U('1595341888016-a392ef81b7de')] },
  { name: 'Nike Air Zoom Structure 24', brand: 'Nike', category: 'Running', type: 'SHOES', gender: 'WOMEN', color: 'Black/White', price: 13999, salePrice: null, flags: { newArrival: true }, sizes: [['UK 6', 1], ['UK 7', 3], ['UK 8', 2], ['UK 9', 0]], images: [U('1603808033192-082d6919d3e1'), U('1514989940723-e8e51635b782')] },
  { name: '361° Flame ST', brand: '361 Degrees', category: 'Running', type: 'SHOES', gender: 'MEN', color: 'Lime/Blue', price: 9999, salePrice: 8999, flags: {}, sizes: [['UK 7', 2], ['UK 8', 5], ['UK 9', 3], ['UK 10', 1]], images: [U('1552346154-21d32810aba3'), U('1608231387042-66d1773070a5')] },
  { name: 'ASICS MAGIC SPEED', brand: 'ASICS', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'Red/Black', price: 16999, salePrice: null, flags: { featured: true, bestSeller: true }, sizes: [['UK 6', 2], ['UK 7', 0], ['UK 8', 3], ['UK 9', 2]], images: [U('1543508282-6319a3e2621f'), U('1606107557195-0e29a4b5b4aa')] },
  { name: 'Nike Air Zoom Alphafly NEXT% 2', brand: 'Nike', category: 'Running', type: 'SHOES', gender: 'UNISEX', color: 'White/Mint', price: 21999, salePrice: null, flags: { featured: true, newArrival: true }, sizes: [['UK 7', 1], ['UK 8', 2], ['UK 9', 1]], images: [U('1605348532760-6753d2c43329'), U('1560769629-975ec94e6a86')] },
  { name: 'PUMA Deviate NITRO Elite 4', brand: 'Puma', category: 'Running', type: 'SHOES', gender: 'MEN', color: 'Blue/White', price: 19999, salePrice: 17999, flags: { newArrival: true }, sizes: [['UK 6', 1], ['UK 7', 2], ['UK 8', 2], ['UK 9', 0]], images: [U('1595950653106-6c9ebd614d3a'), U('1491553895911-0055eca6402d')] },
  { name: 'PUMA x HYROX Deviate NITRO Elite 4', brand: 'Puma', category: 'Training', type: 'SHOES', gender: 'WOMEN', color: 'Pink/Plum', price: 20999, salePrice: null, flags: {}, sizes: [['UK 6', 2], ['UK 7', 1], ['UK 8', 3]], images: [U('1583454110551-21f2fa2afe61'), U('1552674605-db6ffd4facb5')] },
  // APPAREL — AJ SPORTS own label.
  { name: 'AJ Performance Training Tee', brand: 'AJ SPORTS', category: 'Training', type: 'TSHIRT', gender: 'UNISEX', color: 'Black', price: 899, salePrice: 749, flags: { bestSeller: true }, sizes: [['S', 2], ['M', 5], ['L', 3], ['XL', 1]], images: [U('1521572163474-6864f9cf17ab')] },
  { name: 'AJ Dry-Fit Running Tee', brand: 'AJ SPORTS', category: 'Running', type: 'TSHIRT', gender: 'UNISEX', color: 'White', price: 999, salePrice: null, flags: { newArrival: true }, sizes: [['S', 3], ['M', 4], ['L', 0], ['XL', 2]], images: [U('1576566588028-4147f3842f27')] },
  { name: 'AJ Sports Training Tee', brand: 'AJ SPORTS', category: 'Training', type: 'TSHIRT', gender: 'MEN', color: 'Grey', price: 799, salePrice: null, flags: {}, sizes: [['S', 1], ['M', 3], ['L', 2], ['XL', 0]], images: [U('1583743814966-8936f5b7be1a'), U('1503341504253-dff4815485f1')] },
  { name: 'AJ Training Lower', brand: 'AJ SPORTS', category: 'Training', type: 'LOWER', gender: 'MEN', color: 'Black', price: 1499, salePrice: 1299, flags: {}, sizes: [['S', 1], ['M', 3], ['L', 2], ['XL', 2]], images: [U('1571019613454-1cb2f99b2d8b')] },
  { name: 'AJ Performance Track Lower', brand: 'AJ SPORTS', category: 'Training', type: 'LOWER', gender: 'WOMEN', color: 'Navy', price: 1599, salePrice: null, flags: { newArrival: true }, sizes: [['S', 2], ['M', 2], ['L', 1], ['XL', 0]], images: [U('1518310383802-640c2de311b2')] },
  { name: 'AJ Football Jersey', brand: 'AJ SPORTS', category: 'Training', type: 'JERSEY', gender: 'UNISEX', color: 'Blue', price: 1799, salePrice: 1499, flags: { featured: true }, sizes: [['S', 2], ['M', 4], ['L', 2], ['XL', 1]], images: [U('1579952363873-27f3bade9f55')] },
  { name: 'AJ Training Jersey', brand: 'AJ SPORTS', category: 'Training', type: 'JERSEY', gender: 'MEN', color: 'Red', price: 1499, salePrice: null, flags: {}, sizes: [['S', 1], ['M', 3], ['L', 3], ['XL', 2]], images: [U('1522778119026-d647f0596c20')] },
  { name: 'AJ Performance Sports Socks', brand: 'AJ SPORTS', category: 'Running', type: 'SOCKS', gender: 'UNISEX', color: 'White', price: 299, salePrice: null, flags: {}, sizes: [['Free Size', 10]], images: [U('1586350977771-b3b0abd50c82')] },
  { name: 'AJ Football Socks', brand: 'AJ SPORTS', category: 'Training', type: 'SOCKS', gender: 'UNISEX', color: 'Black', price: 349, salePrice: 299, flags: {}, sizes: [['Free Size', 8]], images: [U('1614164185128-e4ec99c436d7')] },
  { name: 'AJ Training Cap', brand: 'AJ SPORTS', category: 'Lifestyle', type: 'ACCESSORIES', gender: 'UNISEX', color: 'Black', price: 599, salePrice: null, flags: {}, sizes: [['Free Size', 12]], images: [U('1588850561407-ed78c282e89b')] },
  { name: 'AJ Training Gloves', brand: 'AJ SPORTS', category: 'Training', type: 'ACCESSORIES', gender: 'UNISEX', color: 'Black/Red', price: 1299, salePrice: 1099, flags: {}, sizes: [['Free Size', 6]], images: [U('1549719386-74dfcbf7dbed')] },
  { name: 'AJ Fitness Band', brand: 'AJ SPORTS', category: 'Training', type: 'ACCESSORIES', gender: 'UNISEX', color: 'Black', price: 999, salePrice: null, flags: { newArrival: true }, sizes: [['Free Size', 7]], images: [U('1575311373937-040b8e1fd5b6')] },
  { name: 'AJ Sports Water Bottle', brand: 'AJ SPORTS', category: 'Training', type: 'ACCESSORIES', gender: 'UNISEX', color: 'Blue', price: 499, salePrice: 399, flags: {}, sizes: [['Free Size', 15]], images: [U('1523362628745-0c100150b504')] },
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
    // 0. Report + clean orphaned inventory (products already absent).
    const productIds = new Set((await Product.find({}).select('_id').lean()).map((p) => String(p._id)));
    console.log(`PRODUCTS_BEFORE=${productIds.size}`);
    const orphanInv = await Inventory.find({}).select('product').lean();
    const orphanIds = orphanInv.filter((i) => !productIds.has(String(i.product))).map((i) => i._id);
    const orphanMov = await InventoryMovement.find({}).select('product inventory').lean();
    const orphanMovIds = orphanMov.filter((m) => !productIds.has(String(m.product))).map((m) => m._id);
    if (orphanIds.length) await Inventory.deleteMany({ _id: { $in: orphanIds } });
    if (orphanMovIds.length) await InventoryMovement.deleteMany({ _id: { $in: orphanMovIds } });
    console.log(`ORPHAN_INVENTORY_REMOVED=${orphanIds.length}`);
    console.log(`ORPHAN_MOVEMENTS_REMOVED=${orphanMovIds.length}`);

    // 1. Brands (reuse existing, create missing incl. AJ SPORTS own label).
    const brandNames = [...new Set(CATALOG.map((p) => p.brand))];
    const brandMap = new Map();
    for (const name of brandNames) {
      const slug = toSlug(name);
      let brand = await Brand.findOne({ slug }).lean();
      if (!brand) {
        brand = await Brand.create({ name, slug, description: `${name} products at AJ SPORTS.`, isActive: true });
        console.log(`BRAND_CREATED=${name}`);
      }
      brandMap.set(name, brand);
    }

    // 2. Products (skip by slug for idempotency).
    let created = 0;
    let skipped = 0;
    let uploaded = 0;
    for (const item of CATALOG) {
      const slug = `${toSlug(item.name)}-${toSlug(item.color)}`;
      const existing = await Product.findOne({ slug }).lean();
      if (existing) {
        skipped += 1;
        continue;
      }
      const brand = brandMap.get(item.brand);
      const category = await Category.findOne({ name: item.category }).lean();
      if (!brand || !category) throw new Error(`Missing brand/category for ${item.name}`);
      const images = [];
      for (const url of item.images) {
        const file = await downloadImage(url);
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
        description: `${item.name} in ${item.color}. Premium AJ SPORTS demo product.`,
        shortDescription: `${item.name} — ${item.color}.`,
        tags: [item.type.toLowerCase(), item.color.toLowerCase().split('/')[0]],
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
      console.log(`PRODUCT_CREATED=${item.name} | ${item.color} | variants=${product.variants.length}`);
    }

    // 3. Verification.
    const products = await Product.find({}).lean();
    let variants = 0;
    let zeroStock = 0;
    const skus = new Set();
    let dupSkus = 0;
    let badImages = 0;
    const byType = {};
    for (const p of products) {
      byType[p.type || 'MISSING'] = (byType[p.type || 'MISSING'] || 0) + 1;
      for (const v of p.variants || []) {
        variants += 1;
        if (Number(v.stock) === 0) zeroStock += 1;
        if (skus.has(v.sku)) dupSkus += 1;
        skus.add(v.sku);
        if (!v.sku) dupSkus += 1;
      }
      for (const url of p.images || []) {
        if (typeof url !== 'string' || !/^https:\/\//.test(url)) badImages += 1;
      }
      if ((p.images || []).length === 0) badImages += 1;
    }
    const allUrls = products.flatMap((p) => p.images || []);
    const uniqueUrls = new Set(allUrls);
    console.log('VERIFY_PRODUCTS=' + products.length);
    console.log('VERIFY_BY_TYPE=' + JSON.stringify(byType));
    console.log('VERIFY_VARIANTS=' + variants);
    console.log('VERIFY_ZERO_STOCK_VARIANTS=' + zeroStock);
    console.log('VERIFY_DUP_SKUS=' + dupSkus);
    console.log('VERIFY_BAD_IMAGES=' + badImages);
    console.log('VERIFY_IMAGE_URLS=' + allUrls.length + '/' + uniqueUrls.size + ' (total/unique)');
    console.log(`SUMMARY created=${created} skipped=${skipped} uploaded=${uploaded}`);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('DEMO SEED FAILED');
  console.error(error);
  process.exit(1);
});
