// AJ SPORTS 57-product demo catalog: 10 SHOES + 10 SLIDES + 10 SOCKS +
// 10 TSHIRT + 10 LOWER + 3 SHORTS + 4 CROCKS. Additive only.
// NOTE: the brief's §1 totals 54 without shorts while §7 requires 3 shorts;
// all 57 are created and the discrepancy is reported.
// - Development database only (kicks-dev guard + production refusal).
// - ONE PRODUCT = ONE COLOR; slugs are name+color to avoid collisions.
// - Each product gets unique image(s): download once, upload through the
//   existing Cloudinary pipeline, store only Cloudinary URLs. Two shoes
//   (Power Lift, Urban Runner) intentionally have no image because no
//   verified distinct photo was available — left blank per instructions.
// - Creation goes through productService (automatic SKU, validation).

import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import Brand from '../src/modules/brands/model.js';
import Category from '../src/modules/categories/model.js';
import Product from '../src/modules/products/model.js';
import Inventory from '../src/modules/inventory/model.js';
import { productService } from '../src/modules/products/service.js';

const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
const F = (flags = {}) => ({ featured: false, newArrival: false, bestSeller: false, ...flags });
// Products intentionally imageless (no verified distinct photo available).
const IMAGELESS = new Set(['aj-power-lift-navy', 'aj-urban-runner-maroon']);

const CATALOG = [
  // ---------------- SHOES (10) ----------------
  { name: 'AJ Sprint Runner', type: 'SHOES', color: 'Black', price: 2999, salePrice: 2499, category: 'Running', flags: F({ bestSeller: true }), sizes: [['UK 6', 2], ['UK 7', 3], ['UK 8', 1], ['UK 9', 4], ['UK 10', 0]], images: [U('1543508282-6319a3e2621f')], desc: 'Lightweight daily runner with responsive cushioning.' },
  { name: 'AJ Velocity Runner', type: 'SHOES', color: 'Blue', price: 3499, salePrice: null, category: 'Running', flags: F({ newArrival: true }), sizes: [['UK 6', 1], ['UK 7', 2], ['UK 8', 5], ['UK 9', 2]], images: [U('1542291026-7eec264c27ff')], desc: 'Steady-mileage trainer with a stable, breathable build.' },
  { name: 'AJ Court Flex', type: 'SHOES', color: 'White', price: 2799, salePrice: 2299, category: 'Lifestyle', flags: F(), sizes: [['UK 7', 3], ['UK 8', 1], ['UK 9', 0], ['UK 10', 2]], images: [U('1600185365483-26d7a4cc7519')], desc: 'Clean court-inspired sneaker for everyday rotation.' },
  { name: 'AJ Street Force', type: 'SHOES', color: 'Grey', price: 3999, salePrice: null, category: 'Lifestyle', flags: F({ bestSeller: true }), sizes: [['UK 6', 2], ['UK 7', 4], ['UK 8', 3]], images: [U('1606107557195-0e29a4b5b4aa')], desc: 'Durable street staple built for all-day wear.' },
  { name: 'AJ Trail Motion', type: 'SHOES', color: 'Green', price: 4599, salePrice: null, category: 'Running', flags: F(), sizes: [['UK 6', 0], ['UK 7', 2], ['UK 8', 3], ['UK 9', 1]], images: [U('1491553895911-0055eca6402d')], desc: 'Grippy trail silhouette for park loops and light trails.' },
  { name: 'AJ Training Pro', type: 'SHOES', color: 'Black/Red', price: 3299, salePrice: 2899, category: 'Training', flags: F(), sizes: [['UK 6', 3], ['UK 7', 2], ['UK 8', 1]], images: [U('1460353581641-37baddab0fa2')], desc: 'Stable training shoe for lifts and circuits.' },
  { name: 'AJ Marathon X', type: 'SHOES', color: 'Orange', price: 5499, salePrice: null, category: 'Running', flags: F({ featured: true }), sizes: [['UK 7', 1], ['UK 8', 2], ['UK 9', 0], ['UK 10', 1]], images: [U('1595950653106-6c9ebd614d3a')], desc: 'Long-distance comfort for marathon preparation.' },
  { name: 'AJ Power Lift', type: 'SHOES', color: 'Navy', price: 4499, salePrice: null, category: 'Training', flags: F(), sizes: [['UK 6', 1], ['UK 7', 0], ['UK 8', 3], ['UK 9', 2]], images: [], desc: 'Flat planted base for heavy strength sessions.' },
  { name: 'AJ Football Speed', type: 'SHOES', color: 'White/Blue', price: 3799, salePrice: null, category: 'Training', flags: F({ newArrival: true }), sizes: [['UK 7', 2], ['UK 8', 4], ['UK 9', 3]], images: [U('1519415943484-9fa1873496d4')], desc: 'Light and quick for pitch sessions and drills.' },
  { name: 'AJ Urban Runner', type: 'SHOES', color: 'Maroon', price: 2499, salePrice: 1999, category: 'Lifestyle', flags: F(), sizes: [['UK 6', 4], ['UK 7', 5], ['UK 8', 2]], images: [], desc: 'Everyday comfort runner styled for city miles.' },
  // ---------------- SLIDES (10) ----------------
  { name: 'AJ Sport Slide Core', type: 'SLIDES', color: 'Black', price: 799, salePrice: 649, category: 'Lifestyle', flags: F({ bestSeller: true }), sizes: [['UK 7', 4], ['UK 8', 6], ['UK 9', 3]], images: [U('1603487742131-4160ec999306')], desc: 'Cushioned everyday slide for recovery and rest days.' },
  { name: 'AJ Motion Slide', type: 'SLIDES', color: 'Navy', price: 899, salePrice: null, category: 'Lifestyle', flags: F(), sizes: [['UK 6', 2], ['UK 7', 3], ['UK 8', 5]], images: [U('1602293589930-45aad59ba3ab')], desc: 'Easy slip-on comfort with a secure strap fit.' },
  { name: 'AJ Active Slide', type: 'SLIDES', color: 'Grey', price: 699, salePrice: null, category: 'Training', flags: F(), sizes: [['UK 7', 1], ['UK 8', 2], ['UK 9', 0]], images: [U('1596703263926-eb0762ee17e4')], desc: 'Poolside-to-gym slide with quick-dry comfort.' },
  { name: 'AJ Street Slide', type: 'SLIDES', color: 'White', price: 999, salePrice: null, category: 'Lifestyle', flags: F({ newArrival: true }), sizes: [['UK 6', 3], ['UK 7', 4], ['UK 8', 2]], images: [U('1622470953794-aa9c70b0fb9d')], desc: 'Clean street slide with soft footbed cushioning.' },
  { name: 'AJ Comfort Slide', type: 'SLIDES', color: 'Black', price: 599, salePrice: 499, category: 'Lifestyle', flags: F(), sizes: [['UK 7', 5], ['UK 8', 3], ['UK 9', 1]], images: [U('1582588678413-dbf45f4823e9')], desc: 'Value comfort slide for everyday lounging.' },
  { name: 'AJ Sprint Slide', type: 'SLIDES', color: 'Blue', price: 1099, salePrice: null, category: 'Running', flags: F(), sizes: [['UK 6', 1], ['UK 7', 2], ['UK 8', 0]], images: [U('1562273138-f46be4ebdf33')], desc: 'Light pre- and post-run recovery slide.' },
  { name: 'AJ Recovery Slide', type: 'SLIDES', color: 'Grey', price: 1299, salePrice: null, category: 'Training', flags: F(), sizes: [['UK 7', 2], ['UK 8', 4], ['UK 9', 2]], images: [U('1620138546344-7b2c38516edf')], desc: 'Extra-soft recovery slide for tired feet.' },
  { name: 'AJ Performance Slide', type: 'SLIDES', color: 'Red', price: 1199, salePrice: 999, category: 'Training', flags: F(), sizes: [['UK 6', 0], ['UK 7', 3], ['UK 8', 2]], images: [U('1608667508764-33cf0726b13a')], desc: 'Sport slide with grippy outsole for wet surfaces.' },
  { name: 'AJ Everyday Slide', type: 'SLIDES', color: 'Brown', price: 649, salePrice: null, category: 'Lifestyle', flags: F(), sizes: [['UK 7', 6], ['UK 8', 4], ['UK 9', 2]], images: [U('1614252235316-8c857d38b5f4')], desc: 'Simple daily slide that goes with everything.' },
  { name: 'AJ Pro Slide', type: 'SLIDES', color: 'White/Black', price: 1499, salePrice: null, category: 'Training', flags: F(), sizes: [['UK 8', 2], ['UK 9', 3], ['UK 10', 1]], images: [U('1562183241-b937e95585b6')], desc: 'Premium training slide with contoured support.' },
  // ---------------- SOCKS (10) ----------------
  { name: 'AJ Performance Crew Socks', type: 'SOCKS', color: 'White', price: 299, salePrice: null, category: 'Running', flags: F(), sizes: [['Free Size', 12]], images: [U('1610384104075-e05c8cf200c3')], desc: 'Cushioned crew socks for daily training.' },
  { name: 'AJ Running Ankle Socks', type: 'SOCKS', color: 'Black', price: 249, salePrice: null, category: 'Running', flags: F(), sizes: [['Free Size', 15]], images: [U('1576871337622-98d48d1cf531')], desc: 'Low-cut ankle socks that stay put on runs.' },
  { name: 'AJ Football Grip Socks', type: 'SOCKS', color: 'Red', price: 349, salePrice: 299, category: 'Training', flags: F(), sizes: [['Free Size', 10]], images: [U('1582966772680-860e372bb558')], desc: 'Grip-dotted football socks for planted cuts.' },
  { name: 'AJ Training Crew Socks', type: 'SOCKS', color: 'Grey', price: 279, salePrice: null, category: 'Training', flags: F(), sizes: [['Free Size', 8]], images: [U('1620799140408-edc6dcb6d633')], desc: 'Durable crew socks for gym sessions.' },
  { name: 'AJ Athletic Quarter Socks', type: 'SOCKS', color: 'White/Black', price: 329, salePrice: null, category: 'Training', flags: F({ newArrival: true }), sizes: [['Free Size', 20]], images: [U('1519238263530-99bdd11df2ea')], desc: 'Quarter-length socks with arch support.' },
  { name: 'AJ Compression Sports Socks', type: 'SOCKS', color: 'Black', price: 599, salePrice: 499, category: 'Running', flags: F(), sizes: [['Free Size', 6]], images: [U('1611312449408-fcece27cdbb7')], desc: 'Graduated compression for circulation on long efforts.' },
  { name: 'AJ Everyday Sports Socks', type: 'SOCKS', color: 'Navy', price: 199, salePrice: null, category: 'Running', flags: F(), sizes: [['Free Size', 18]], images: [U('1588359348347-9bc6cbbb689e')], desc: 'Everyday value socks in a breathable knit.' },
  { name: 'AJ Sprint Running Socks', type: 'SOCKS', color: 'Green', price: 399, salePrice: null, category: 'Running', flags: F(), sizes: [['Free Size', 9]], images: [U('1622445275576-721325763afe')], desc: 'Thin speed socks for race day.' },
  { name: 'AJ Court Sports Socks', type: 'SOCKS', color: 'White', price: 289, salePrice: null, category: 'Training', flags: F(), sizes: [['Free Size', 0]], images: [U('1556905055-8f358a7a47b2')], desc: 'Padded court socks for indoor sessions.' },
  { name: 'AJ Pro Training Socks', type: 'SOCKS', color: 'Maroon', price: 449, salePrice: null, category: 'Training', flags: F(), sizes: [['Free Size', 11]], images: [U('1591195853828-11db59a44f6b')], desc: 'Pro-grade training socks with reinforced heel and toe.' },
  // ---------------- TSHIRTS (10) ----------------
  { name: 'AJ Performance Dry-Fit Tee', type: 'TSHIRT', color: 'Black', price: 999, salePrice: 849, category: 'Training', flags: F({ bestSeller: true }), sizes: [['S', 2], ['M', 5], ['L', 3], ['XL', 1], ['XXL', 0]], images: [U('1571945153237-4929e783af4a')], desc: 'Sweat-wicking dry-fit tee for hard sessions.' },
  { name: 'AJ Training Core Tee', type: 'TSHIRT', color: 'Grey', price: 749, salePrice: null, category: 'Training', flags: F(), sizes: [['S', 1], ['M', 3], ['L', 4], ['XL', 2]], images: [U('1618354691373-d851c5c3a990')], desc: 'Soft core training tee with athletic fit.' },
  { name: 'AJ Running Motion Tee', type: 'TSHIRT', color: 'White', price: 1099, salePrice: 899, category: 'Running', flags: F({ newArrival: true }), sizes: [['S', 3], ['M', 2], ['L', 1], ['XL', 0]], images: [U('1523381210434-271e8be1f52b')], desc: 'Light running tee with reflective details.' },
  { name: 'AJ Active Mesh Tee', type: 'TSHIRT', color: 'Blue', price: 899, salePrice: 749, category: 'Training', flags: F({ newArrival: true }), sizes: [['S', 2], ['M', 3], ['L', 1], ['XL', 0]], images: [U('1617137968427-85924c800a22')], desc: 'Ventilated mesh panels keep airflow high.' },
  { name: 'AJ Sprint Performance Tee', type: 'TSHIRT', color: 'Red', price: 1199, salePrice: null, category: 'Running', flags: F(), sizes: [['S', 1], ['M', 2], ['L', 2], ['XL', 1]], images: [U('1562157873-818bc0726f68')], desc: 'Featherlight sprint tee with flat seams.' },
  { name: 'AJ Football Training Tee', type: 'TSHIRT', color: 'Green', price: 999, salePrice: null, category: 'Training', flags: F(), sizes: [['S', 4], ['M', 4], ['L', 3], ['XL', 2]], images: [U('1596755094514-f87e34085b2c')], desc: 'Durable pitch-ready training tee.' },
  { name: 'AJ Gym Essential Tee', type: 'TSHIRT', color: 'Black', price: 649, salePrice: 599, category: 'Training', flags: F(), sizes: [['S', 5], ['M', 6], ['L', 4], ['XL', 3]], images: [U('1602810318383-e386cc2a3ccf')], desc: 'Everyday gym essential at an honest price.' },
  { name: 'AJ Court Training Tee', type: 'TSHIRT', color: 'Navy', price: 1299, salePrice: null, category: 'Training', flags: F({ featured: true }), sizes: [['S', 1], ['M', 1], ['L', 2], ['XL', 1]], images: [U('1586790170083-2f9ceadc732d')], desc: 'Premium court tee with structured drape.' },
  { name: 'AJ Everyday Sport Tee', type: 'TSHIRT', color: 'White', price: 699, salePrice: null, category: 'Running', flags: F(), sizes: [['S', 2], ['M', 2], ['L', 2], ['XL', 2]], images: [U('1529374255404-311a2a4f1fd9')], desc: 'Simple sport tee for daily movement.' },
  { name: 'AJ Pro Performance Tee', type: 'TSHIRT', color: 'Maroon', price: 1499, salePrice: 1299, category: 'Training', flags: F({ newArrival: true }), sizes: [['S', 0], ['M', 1], ['L', 2], ['XL', 1]], images: [U('1554568218-0f1715e72254')], desc: 'Pro-tier performance tee with bonded seams.' },
  // ---------------- LOWERS (10) ----------------
  { name: 'AJ Performance Track Lower', type: 'LOWER', color: 'Black', price: 1499, salePrice: 1299, category: 'Training', flags: F(), sizes: [['S', 1], ['M', 3], ['L', 2], ['XL', 2], ['XXL', 0]], images: [U('1518611012118-696072aa579a')], desc: 'Tapered track lower with zip pockets.' },
  { name: 'AJ Training Flex Lower', type: 'LOWER', color: 'Grey', price: 1399, salePrice: null, category: 'Training', flags: F(), sizes: [['S', 2], ['M', 4], ['L', 3], ['XL', 1]], images: [U('1534438327276-14e5300c3a48')], desc: 'Four-way stretch lower for deep movements.' },
  { name: 'AJ Pro Running Lower', type: 'LOWER', color: 'Navy', price: 1699, salePrice: null, category: 'Running', flags: F({ newArrival: true }), sizes: [['S', 1], ['M', 2], ['L', 2], ['XL', 1], ['XXL', 1]], images: [U('1581009146145-b5ef050c2e1e')], desc: 'Weather-ready running lower with ankle zips.' },
  { name: 'AJ Active Motion Lower', type: 'LOWER', color: 'Black', price: 1199, salePrice: 999, category: 'Training', flags: F(), sizes: [['S', 3], ['M', 3], ['L', 1], ['XL', 0]], images: [U('1544367567-0f2fcb009e0b')], desc: 'Flexible everyday training lower.' },
  { name: 'AJ Sprint Track Lower', type: 'LOWER', color: 'Blue', price: 1899, salePrice: null, category: 'Running', flags: F({ featured: true }), sizes: [['S', 0], ['M', 2], ['L', 3], ['XL', 2]], images: [U('1552902865-b72c031ac5ea')], desc: 'Aero sprint lower built for fast sessions.' },
  { name: 'AJ Football Training Lower', type: 'LOWER', color: 'Green', price: 1599, salePrice: null, category: 'Training', flags: F(), sizes: [['S', 2], ['M', 2], ['L', 4], ['XL', 1]], images: [U('1584865288642-42078afe6942')], desc: 'Roomy pitch lower with durable knees.' },
  { name: 'AJ Gym Flex Lower', type: 'LOWER', color: 'Grey', price: 899, salePrice: 799, category: 'Training', flags: F({ bestSeller: true }), sizes: [['S', 4], ['M', 5], ['L', 3], ['XL', 2]], images: [U('1605296867304-46d5465a13f1')], desc: 'Gym-floor favorite with squat-proof stretch.' },
  { name: 'AJ Court Performance Lower', type: 'LOWER', color: 'White', price: 1999, salePrice: null, category: 'Training', flags: F(), sizes: [['S', 1], ['M', 1], ['L', 1], ['XL', 0]], images: [U('1526506118085-60ce8714f8c5')], desc: 'Crisp court lower with tailored taper.' },
  { name: 'AJ Everyday Training Lower', type: 'LOWER', color: 'Navy', price: 999, salePrice: null, category: 'Running', flags: F(), sizes: [['S', 2], ['M', 3], ['L', 2], ['XL', 1]], images: [U('1517963879433-6ad2b056d712')], desc: 'Easy everyday lower for warmups and cooldowns.' },
  { name: 'AJ Recovery Track Lower', type: 'LOWER', color: 'Black', price: 1799, salePrice: 1599, category: 'Training', flags: F(), sizes: [['S', 1], ['M', 2], ['L', 0], ['XL', 1]], images: [U('1599058917212-d750089bc07e')], desc: 'Soft recovery lower for rest days.' },
  // ---------------- SHORTS (3) ----------------
  { name: 'AJ Running Shorts', type: 'SHORTS', color: 'Black', price: 899, salePrice: 749, category: 'Running', flags: F({ bestSeller: true }), sizes: [['S', 2], ['M', 5], ['L', 3], ['XL', 1]], images: [U('1565084888279-aca607ecce0c')], desc: 'Light running shorts with liner support.' },
  { name: 'AJ Training Shorts', type: 'SHORTS', color: 'Grey', price: 799, salePrice: null, category: 'Training', flags: F(), sizes: [['S', 1], ['M', 3], ['L', 2], ['XL', 0]], images: [U('1594882645126-14020914d58d')], desc: 'Durable training shorts for gym days.' },
  { name: 'AJ Football Shorts', type: 'SHORTS', color: 'Blue', price: 999, salePrice: 849, category: 'Training', flags: F({ featured: true }), sizes: [['S', 3], ['M', 4], ['L', 2], ['XL', 1]], images: [U('1517438322307-e67111335449')], desc: 'Match-ready football shorts.' },
  // ---------------- CROCKS (4) ----------------
  { name: 'AJ Comfort Clog', type: 'CROCKS', color: 'Black', price: 1499, salePrice: 1299, category: 'Lifestyle', flags: F({ bestSeller: true }), sizes: [['UK 7', 3], ['UK 8', 5], ['UK 9', 2]], images: [U('1560343090-f0409e92791a')], desc: 'All-day comfort clog with cushioned footbed.' },
  { name: 'AJ Active Clog', type: 'CROCKS', color: 'Navy', price: 1799, salePrice: null, category: 'Training', flags: F({ newArrival: true }), sizes: [['UK 6', 2], ['UK 7', 4], ['UK 8', 1]], images: [U('1608256246200-53e635b5b65f')], desc: 'Sport clog with grippy sole for wet areas.' },
  { name: 'AJ Street Clog', type: 'CROCKS', color: 'White', price: 1299, salePrice: null, category: 'Lifestyle', flags: F(), sizes: [['UK 7', 0], ['UK 8', 3], ['UK 9', 2]], images: [U('1449505278894-297fdb3edbc1')], desc: 'Street-ready clog with easy slip-on fit.' },
  { name: 'AJ Recovery Clog', type: 'CROCKS', color: 'Grey', price: 1999, salePrice: 1799, category: 'Training', flags: F({ featured: true }), sizes: [['UK 8', 2], ['UK 9', 4], ['UK 10', 1]], images: [U('1622760807800-66cf1466fc08')], desc: 'Deep-cushion recovery clog for post-session feet.' },
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

    // Fail fast on any duplicate source image inside this batch.
    const batchUrls = CATALOG.flatMap((item) => item.images);
    if (new Set(batchUrls).size !== batchUrls.length) throw new Error('Duplicate source image inside batch');

    let brand = await Brand.findOne({ slug: 'aj-sports' }).lean();
    if (!brand) {
      brand = await Brand.create({ name: 'AJ SPORTS', slug: 'aj-sports', description: 'AJ SPORTS own-label essentials.', isActive: true });
      console.log('BRAND_CREATED=AJ SPORTS');
    }

    let created = 0;
    let skipped = 0;
    let uploaded = 0;
    for (const item of CATALOG) {
      const slug = `${toSlug(item.name)}-${toSlug(item.color)}`;
      if (await Product.findOne({ slug }).lean()) {
        skipped += 1;
        console.log(`SKIPPED (exists) slug=${slug}`);
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
        gender: 'UNISEX',
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
    let lowStock = 0;
    const skus = new Set();
    let dupSkus = 0;
    let badImages = 0;
    const imageless = [];
    const byType = {};
    for (const p of products) {
      byType[p.type || 'MISSING'] = (byType[p.type || 'MISSING'] || 0) + 1;
      for (const v of p.variants || []) {
        variants += 1;
        if (Number(v.stock) === 0) zeroStock += 1;
        else if (Number(v.stock) <= 3) lowStock += 1;
        if (!v.sku || skus.has(v.sku)) dupSkus += 1;
        skus.add(v.sku);
      }
      for (const url of p.images || []) {
        if (typeof url !== 'string' || !/^https:\/\/res\.cloudinary\.com\//.test(url)) badImages += 1;
      }
      if ((p.images || []).length === 0) {
        if (IMAGELESS.has(p.slug)) imageless.push(p.slug);
        else badImages += 1;
      }
    }
    const allUrls = products.flatMap((p) => p.images || []);
    console.log('VERIFY_PRODUCTS=' + products.length);
    console.log('VERIFY_BY_TYPE=' + JSON.stringify(byType));
    console.log('VERIFY_VARIANTS=' + variants);
    console.log('VERIFY_ZERO_STOCK_VARIANTS=' + zeroStock);
    console.log('VERIFY_LOW_STOCK_VARIANTS=' + lowStock);
    console.log('VERIFY_DUP_SKUS=' + dupSkus);
    console.log('VERIFY_BAD_IMAGES=' + badImages);
    console.log('VERIFY_IMAGELESS=' + JSON.stringify(imageless));
    console.log('VERIFY_IMAGE_URLS=' + allUrls.length + '/' + new Set(allUrls).size + ' (total/unique)');
    console.log(`SUMMARY created=${created} skipped=${skipped} uploaded=${uploaded}`);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('54 SEED FAILED');
  console.error(error);
  process.exit(1);
});
