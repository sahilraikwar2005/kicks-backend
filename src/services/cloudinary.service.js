import crypto from 'node:crypto';
import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DEFAULT_FOLDER = 'kicks/products';
const allowedFolders = new Set([DEFAULT_FOLDER]);

const normalizeFolder = (folder) => {
  const candidate = String(folder || DEFAULT_FOLDER).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
  if (!candidate) return DEFAULT_FOLDER;
  if (!candidate.startsWith('kicks/')) return DEFAULT_FOLDER;
  const sanitized = candidate.split('/').filter(Boolean).map((segment) => segment.replace(/[^a-zA-Z0-9._-]+/g, '-')).join('/');
  return sanitized || DEFAULT_FOLDER;
};

const isConfigured = () => !!(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

export const isAllowedCloudinaryPublicId = (publicId) => {
  if (!publicId || typeof publicId !== 'string') return false;
  const normalized = publicId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (normalized.includes('..') || normalized.includes('://')) return false;
  return /^kicks\/(products|products\/.*)$/.test(normalized) || normalized.startsWith('kicks/products/');
};

const normalizeFile = (file) => {
  if (!file || !file.buffer) {
    const error = new Error('Invalid upload file');
    error.statusCode = 400;
    throw error;
  }

  const mimeType = String(file.mimetype || '').toLowerCase();
  const extension = (file.originalname ? String(file.originalname).split('.').pop() : '').toLowerCase();
  const normalizedExtension = extension ? `.${extension}` : '';

  if (!ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(normalizedExtension)) {
    const error = new Error('Unsupported file type');
    error.statusCode = 415;
    throw error;
  }

  const maxBytes = Math.max(1, Number(env.uploadLimitMb || 5)) * 1024 * 1024;
  if (file.size && file.size > maxBytes) {
    const error = new Error('File exceeds the maximum supported size');
    error.statusCode = 413;
    throw error;
  }

  if (file.size === 0) {
    const error = new Error('File is empty');
    error.statusCode = 400;
    throw error;
  }

  return { mimeType, extension: normalizedExtension };
};

const buildSafePublicId = (folder) => `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

export async function uploadToCloudinary(file, folder = DEFAULT_FOLDER) {
  if (!isConfigured()) {
    const error = new Error('Cloudinary is not configured');
    error.statusCode = 503;
    throw error;
  }

  normalizeFile(file);
  const safeFolder = normalizeFolder(folder);
  if (!allowedFolders.has(safeFolder)) {
    const error = new Error('Unsafe Cloudinary folder');
    error.statusCode = 400;
    throw error;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: safeFolder,
        resource_type: 'image',
        public_id: buildSafePublicId(safeFolder),
        overwrite: false,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          const failure = new Error('Image upload failed');
          failure.statusCode = 502;
          reject(failure);
          return;
        }

        resolve(result);
      },
    );

    stream.end(file.buffer);
  });
}

export async function deleteFromCloudinary(publicId) {
  if (!isConfigured()) {
    const error = new Error('Cloudinary is not configured');
    error.statusCode = 503;
    throw error;
  }

  if (!isAllowedCloudinaryPublicId(publicId)) {
    const error = new Error('Resource is not allowed to be deleted');
    error.statusCode = 403;
    throw error;
  }

  const response = await cloudinary.uploader.destroy(publicId, { invalidate: false });
  if (response?.result && response.result !== 'ok') {
    const error = new Error('Image removal failed');
    error.statusCode = 502;
    throw error;
  }
  return response;
}

export async function replaceCloudinaryAsset({ currentPublicId, file, folder = DEFAULT_FOLDER }) {
  if (!currentPublicId) {
    const error = new Error('Current media reference is required');
    error.statusCode = 400;
    throw error;
  }

  const safeCurrentPublicId = String(currentPublicId).trim();
  if (!isAllowedCloudinaryPublicId(safeCurrentPublicId)) {
    const error = new Error('Resource ownership is not allowed');
    error.statusCode = 403;
    throw error;
  }

  const safeUpload = await uploadToCloudinary(file, folder);
  try {
    await deleteFromCloudinary(safeCurrentPublicId);
  } catch (error) {
    if (error.statusCode === 403) {
      throw error;
    }
    const wrapped = new Error('Image replacement failed');
    wrapped.statusCode = 502;
    throw wrapped;
  }

  return safeUpload;
}
