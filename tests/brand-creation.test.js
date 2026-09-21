import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Brand from '../src/modules/brands/model.js';
import { brandService } from '../src/modules/brands/service.js';

test.before(async () => {
  await connectDatabase();
});

test.after(async () => {
  await closeDatabase();
});

const uniqueName = (prefix) => `${prefix} ${Date.now()}-${Math.random().toString(36).substring(7)}`;

const cleanupBrand = async (id) => {
  if (id) await Brand.deleteOne({ _id: id });
};

test('brand creation trims the name and derives a clean slug', async () => {
  const name = uniqueName('Test Brand');
  const brand = await brandService.create({ name: `  ${name}  ` });
  try {
    assert.equal(brand.name, name);
    assert.match(brand.slug, /^[a-z0-9-]+$/);
    assert.equal(brand.isActive, true);
  } finally {
    await cleanupBrand(brand._id);
  }
});

test('brand creation rejects empty and oversized names', async () => {
  await assert.rejects(
    () => brandService.create({ name: '   ' }),
    (error) => error.statusCode === 400 && /required/i.test(error.message),
  );
  await assert.rejects(
    () => brandService.create({ name: 'x'.repeat(61) }),
    (error) => error.statusCode === 400 && /60/i.test(error.message),
  );
});

test('brand creation prevents case-insensitive duplicates', async () => {
  const name = uniqueName('Dupe Brand');
  const brand = await brandService.create({ name });
  try {
    await assert.rejects(
      () => brandService.create({ name: name.toLowerCase() }),
      (error) => error.statusCode === 409 && /already exists/i.test(error.message),
    );
    await assert.rejects(
      () => brandService.create({ name: `  ${name.toUpperCase()}  ` }),
      (error) => error.statusCode === 409 && /already exists/i.test(error.message),
    );
    assert.equal(await Brand.countDocuments({ slug: brand.slug }), 1);
  } finally {
    await cleanupBrand(brand._id);
  }
});
