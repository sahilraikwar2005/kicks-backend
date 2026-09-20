import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin } from '../../middleware/role.middleware.js';
import { uploadController } from './controller.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!allowed) {
      return callback(new Error('Unsupported file type'));
    }
    return callback(null, true);
  },
});

router.post('/images', protect, isAdmin, upload.single('image'), asyncHandler(uploadController.image));
router.delete('/images/:publicId', protect, isAdmin, asyncHandler(uploadController.deleteImage));
router.put('/images/:publicId', protect, isAdmin, upload.single('image'), asyncHandler(uploadController.replaceImage));

export default router;
