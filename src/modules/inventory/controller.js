import { apiSuccess } from '../../utils/apiResponse.js';
import { inventoryService } from './service.js';

export const inventoryController = {
  list: async (req, res) => {
    const result = await inventoryService.getInventory({
      page: req.query.page,
      limit: req.query.limit,
      productId: req.query.productId,
      lowStock: req.query.lowStock === 'true',
      lowStockThreshold: 5,
    });
    return res.status(200).json(apiSuccess('Inventory fetched', result));
  },

  lowStock: async (req, res) => {
    const items = await inventoryService.getLowStock();
    return res.status(200).json(apiSuccess('Low stock inventory fetched', { items }));
  },

  getByVariant: async (req, res) => {
    const inventory = await inventoryService.getInventory({ variantId: req.params.variantId, limit: 1 });
    return res.status(200).json(apiSuccess('Inventory fetched', { item: inventory.items[0] || null }));
  },

  adjust: async (req, res) => {
    const item = await inventoryService.adjustStock(req.params.productId || req.body.productId, req.params.variantId, Number(req.body.delta), {
      referenceId: req.body.referenceId || '',
      reason: req.body.reason || 'admin_adjustment',
      metadata: { adminId: String(req.user._id) },
    });
    return res.status(200).json(apiSuccess('Inventory adjusted', { item }));
  },

  movements: async (req, res) => {
    const result = await inventoryService.getMovementHistory({
      variantId: req.params.variantId,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json(apiSuccess('Inventory movement history fetched', result));
  },
};
