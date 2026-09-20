import Order from '../orders/model.js';
import Product from '../products/model.js';
import User from '../users/model.js';

export const adminService = {
  async getDashboardMetrics() {
    const [userCount, productCount, orderCount, revenue, statuses, lowStockProducts, recentOrders, topSellingProducts] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Product.find({ 'variants.stock': { $lte: 5 }, status: { $ne: 'ARCHIVED' } }).select('name slug variants').limit(20).lean(),
      Order.find().select('orderNumber status paymentStatus grandTotal createdAt').sort({ createdAt: -1 }).limit(10).lean(),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.finalPrice' } } },
        { $sort: { quantity: -1 } }, { $limit: 10 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, quantity: 1, revenue: 1, name: '$product.name', slug: '$product.slug' } },
      ]),
    ]);

    const statusCounts = Object.fromEntries(statuses.map((item) => [item._id.toLowerCase(), item.count]));
    return {
      totalUsers: userCount,
      totalProducts: productCount,
      totalOrders: orderCount,
      totalRevenue: revenue[0]?.total || 0,
      pendingOrders: statusCounts.pending || 0,
      confirmedOrders: statusCounts.confirmed || 0,
      shippedOrders: statusCounts.shipped || 0,
      deliveredOrders: statusCounts.delivered || 0,
      cancelledOrders: statusCounts.cancelled || 0,
      lowStockProducts,
      recentOrders,
      topSellingProducts,
    };
  },
};
