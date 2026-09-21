import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import productRoutes from '../modules/products/routes.js';
import adminRoutes from '../modules/admin/routes.js';
import brandRoutes from '../modules/brands/routes.js';
import categoryRoutes from '../modules/categories/routes.js';
import cartRoutes from '../modules/cart/routes.js';
import orderRoutes from '../modules/orders/routes.js';
import wishlistRoutes from '../modules/wishlist/routes.js';
import paymentRoutes from '../modules/payments/routes.js';
import shipmentRoutes from '../modules/shipments/routes.js';
import addressRoutes from '../modules/addresses/routes.js';
import recentlyViewedRoutes from '../modules/recentlyViewed/routes.js';
import recommendationRoutes from '../modules/recommendations/routes.js';
import blogRoutes from '../modules/blog/routes.js';
import cmsRoutes from '../modules/cms/routes.js';
import notificationRoutes from '../modules/notifications/routes.js';
import uploadRoutes from '../modules/uploads/routes.js';
import inventoryRoutes from '../modules/inventory/routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/products', recommendationRoutes);
router.use('/products', productRoutes);
router.use('/brands', brandRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/payments', paymentRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/addresses', addressRoutes);
router.use('/', recentlyViewedRoutes);
router.use('/blog', blogRoutes);
router.use('/cms', cmsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/uploads', uploadRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/admin', adminRoutes);

router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'KICKS API v1 root',
    data: { version: 'v1' },
  });
});

export default router;
