import test from 'node:test';
import assert from 'node:assert/strict';

import cloudinary from '../src/config/cloudinary.js';
import { deleteFromCloudinary, replaceCloudinaryAsset, uploadToCloudinary } from '../src/services/cloudinary.service.js';

const originalUploadStream = cloudinary.uploader.upload_stream;
const originalDestroy = cloudinary.uploader.destroy;

const buildFile = ({ mimetype = 'image/png', originalname = 'test.png', size = 1024 } = {}) => ({
  buffer: Buffer.from('secure-image-payload'),
  mimetype,
  originalname,
  size,
});

test.afterEach(() => {
  cloudinary.uploader.upload_stream = originalUploadStream;
  cloudinary.uploader.destroy = originalDestroy;
});

test('cloudinary security: rejects invalid MIME type and oversized images', async () => {
  await assert.rejects(() => uploadToCloudinary(buildFile({ mimetype: 'application/pdf', originalname: 'test.pdf' }), 'kicks/products'), /unsupported file type/i);
  await assert.rejects(() => uploadToCloudinary(buildFile({ mimetype: 'image/png', originalname: 'large.png', size: 6 * 1024 * 1024 }), 'kicks/products'), /maximum supported size/i);
});

test('cloudinary security: rejects unauthorized or cross-resource deletions', async () => {
  await assert.rejects(() => deleteFromCloudinary('other/account/file'), /not allowed|forbidden/i);
  await assert.rejects(() => deleteFromCloudinary('kicks/products/../../secret.txt'), /not allowed|forbidden/i);
});

test('cloudinary security: replacement fails cleanly without deleting the old asset when upload fails', async () => {
  let destroyCalls = 0;
  cloudinary.uploader.upload_stream = (options, callback) => {
    callback(new Error('provider unavailable'), null);
    return { end: () => {} };
  };
  cloudinary.uploader.destroy = async () => {
    destroyCalls += 1;
    return { result: 'ok' };
  };

  await assert.rejects(() => replaceCloudinaryAsset({ currentPublicId: 'kicks/products/current-asset', file: buildFile(), folder: 'kicks/products' }), /image replacement failed|upload failed/i);
  assert.equal(destroyCalls, 0);
});

test('cloudinary security: valid admin upload path still succeeds with safe server-controlled public id', async () => {
  cloudinary.uploader.upload_stream = (options, callback) => {
    assert.equal(options.folder, 'kicks/products');
    assert.ok(String(options.public_id).startsWith('kicks/products/'));
    callback(null, {
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/kicks/products/test.png',
      public_id: 'kicks/products/test.png',
      width: 600,
      height: 400,
    });
    return { end: () => {} };
  };

  const result = await uploadToCloudinary(buildFile(), 'kicks/products');
  assert.equal(result.public_id, 'kicks/products/test.png');
});
