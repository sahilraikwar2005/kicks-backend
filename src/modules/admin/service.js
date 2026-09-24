import Order from '../orders/model.js';
import Product from '../products/model.js';
import User from '../users/model.js';
import { InventoryMovement } from '../inventory/model.js';

const SALES_RANGES = {
  today: () => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    return since;
  },
  '7d': () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  '30d': () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  all: () => null,
};

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

  async getSalesOverview(range = 'today') {
    const since = (SALES_RANGES[range] || SALES_RANGES.today)();
    const dateFilter = since ? { createdAt: { $gte: since } } : {};

    // ONLINE: completed ecommerce sales only — paid, not cancelled/refunded.
    // Offline adjustments never create orders, so the sets cannot overlap.
    const [online] = await Order.aggregate([
      { $match: { paymentStatus: 'PAID', status: { $nin: ['CANCELLED', 'REFUNDED'] }, ...dateFilter } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          items: { $sum: { $sum: '$items.quantity' } },
          revenue: { $sum: '$grandTotal' },
        },
      },
    ]);

    // OFFLINE: one-click offline sales are ADJUSTMENT movements with reason
    // "Offline sale" (optionally suffixed with " — note"). Undo creates a
    // separate +qty movement with reason "Undo offline sale", which nets out.
    // Movements store no price, so offline reports items only — never revenue.
    const [offline] = await InventoryMovement.aggregate([
      {
        $match: {
          type: 'ADJUSTMENT',
          reason: { $in: [/^Offline sale( —|$)/, /^Undo offline sale$/] },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          sold: {
            $sum: {
              $cond: [{ $eq: ['$reason', 'Undo offline sale'] }, 0, '$quantity'],
            },
          },
          undone: {
            $sum: {
              $cond: [{ $eq: ['$reason', 'Undo offline sale'] }, '$quantity', 0],
            },
          },
        },
      },
    ]);

    const onlineOrders = Number(online?.orders || 0);
    const onlineItems = Number(online?.items || 0);
    const onlineRevenue = Number(online?.revenue || 0);
    const offlineItems = Math.max(0, Number(offline?.sold || 0) - Number(offline?.undone || 0));

    return {
      range,
      online: { revenue: onlineRevenue, orders: onlineOrders, items: onlineItems },
      offline: { revenue: null, items: offlineItems },
      total: { revenue: onlineRevenue, items: onlineItems + offlineItems, orders: onlineOrders },
    };
  },
};
