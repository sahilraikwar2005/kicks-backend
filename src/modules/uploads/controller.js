import { apiSuccess } from '../../utils/apiResponse.js';
import { deleteFromCloudinary, uploadToCloudinary, replaceCloudinaryAsset } from '../../services/cloudinary.service.js';

export const uploadController = {
  image: async (req, res) => {
    const result = await uploadToCloudinary(req.file, 'kicks/products');
    return res.status(201).json(apiSuccess('Image uploaded', { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height }));
  },

  deleteImage: async (req, res) => {
    const publicId = String(req.params.publicId || '').trim();
    await deleteFromCloudinary(publicId);
    return res.status(200).json(apiSuccess('Image deleted successfully', { ok: true }));
  },

  replaceImage: async (req, res) => {
    const publicId = String(req.params.publicId || '').trim();
    const result = await replaceCloudinaryAsset({ currentPublicId: publicId, file: req.file, folder: 'kicks/products' });
    return res.status(200).json(apiSuccess('Image replaced successfully', { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height }));
  },
};
