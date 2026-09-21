import { apiSuccess } from '../../utils/apiResponse.js';
import { adminService } from './service.js';
import { productService } from '../products/service.js';
import { auditService } from '../audit/service.js';
import { inventoryService } from '../inventory/service.js';
import User from '../users/model.js';
import Inventory from '../inventory/model.js';
import AuditLog from '../audit/model.js';
import { adminSettingsService } from './settings.service.js';

export const adminController = {
  listProducts: async (req, res) => {
    const filters = { ...req.query };
    if (!filters.status) filters.includeAllStatuses = true;
    const result = await productService.listProducts(filters);
    return res.status(200).json(apiSuccess('Admin products fetched successfully', result));
  },

  dashboard: async (req, res) => {
    const metrics = await adminService.getDashboardMetrics();
    res.status(200).json(apiSuccess('Admin dashboard fetched successfully', { metrics }));
  },

  listUsers: async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';
    const [items, total] = await Promise.all([
      User.find(query).select('firstName lastName email role isActive emailVerified createdAt').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      User.countDocuments(query),
    ]);
    res.status(200).json(apiSuccess('Users fetched', { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  },

  getUserById: async (req, res) => {
    const user = await User.findById(req.params.id).select('firstName lastName email role isActive emailVerified avatar phone createdAt updatedAt').lean();
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json(apiSuccess('User fetched', { user }));
  },

  updateUserStatus: async (req, res) => {
    const { isActive } = req.body;
    const target = await User.findById(req.params.id).select('firstName lastName email role isActive emailVerified');
    if (!target) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    if (String(target._id) === String(req.user._id) && !isActive) {
      const error = new Error('You cannot deactivate your own account');
      error.statusCode = 403;
      throw error;
    }
    if (target.role !== 'CUSTOMER' && req.user.role !== 'SUPER_ADMIN') {
      const error = new Error('Only Super Admins can change the status of admin accounts');
      error.statusCode = 403;
      throw error;
    }
    if (!isActive && target.role === 'SUPER_ADMIN') {
      const remaining = await User.countDocuments({ role: 'SUPER_ADMIN', isActive: true, _id: { $ne: target._id } });
      if (remaining === 0) {
        const error = new Error('Cannot deactivate the last active Super Admin');
        error.statusCode = 403;
        throw error;
      }
    }
    target.isActive = Boolean(isActive);
    await target.save();
    const user = target.toObject();
    await auditService.record({ actor: req.user._id, action: 'USER_STATUS_UPDATED', resource: 'user', resourceId: user._id, metadata: { isActive: user.isActive }, ip: req.ip });
    res.status(200).json(apiSuccess('User status updated', { user }));
  },

  listInventory: async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const query = {};
    if (req.query.productId) query.product = req.query.productId;
    if (req.query.lowStock === 'true') query.availableStock = { $lte: 5 };
    const [items, total] = await Promise.all([
      Inventory.find(query).populate('product', 'name slug').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Inventory.countDocuments(query),
    ]);
    res.status(200).json(apiSuccess('Inventory fetched', { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  },

  getLowStockInventory: async (req, res) => {
    const items = await Inventory.find({ availableStock: { $lte: 5 } }).populate('product', 'name slug').lean();
    res.status(200).json(apiSuccess('Low-stock inventory fetched', { items }));
  },

  getInventoryByVariant: async (req, res) => {
    const item = await Inventory.findOne({ variant: req.params.variantId }).populate('product', 'name slug').lean();
    if (!item) {
      const error = new Error('Inventory not found');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json(apiSuccess('Inventory item fetched', { item }));
  },

  adjustInventory: async (req, res) => {
    const delta = Number(req.body.delta);
    const existing = await Inventory.findOne({ variant: req.params.variantId }).select('_id product variant');
    if (!existing) {
      const error = new Error('Inventory not found');
      error.statusCode = 404;
      throw error;
    }
    const item = await inventoryService.adjustStock(existing.product, req.params.variantId, delta, {
      reason: req.body.reason || 'admin_adjust',
      referenceId: req.body.referenceId || '',
      metadata: { actor: String(req.user._id), source: 'admin' },
    });
    await auditService.record({ actor: req.user._id, action: 'INVENTORY_ADJUSTED', resource: 'inventory', resourceId: item._id, metadata: { delta, reason: req.body.reason || 'admin_adjust' }, ip: req.ip });
    res.status(200).json(apiSuccess('Inventory adjusted', { item }));
  },

  listInventoryMovements: async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const query = { variant: req.params.variantId };
    const [items, total] = await Promise.all([
      (await import('../inventory/model.js')).InventoryMovement.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      (await import('../inventory/model.js')).InventoryMovement.countDocuments(query),
    ]);
    res.status(200).json(apiSuccess('Inventory movement history fetched', { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  },

  listSettings: async (req, res) => {
    const settings = await adminSettingsService.list();
    res.status(200).json(apiSuccess('Settings fetched', { settings }));
  },

  updateSetting: async (req, res) => {
    const setting = await adminSettingsService.upsert(req.params.key, req.body.value, req.body.description || '', req.user._id);
    await auditService.record({ actor: req.user._id, action: 'SETTING_UPDATED', resource: 'setting', resourceId: setting._id, metadata: { key: setting.key }, ip: req.ip });
    res.status(200).json(apiSuccess('Setting updated', { setting }));
  },

  listAuditLogs: async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLog.find().skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      AuditLog.countDocuments(),
    ]);
    res.status(200).json(apiSuccess('Audit logs fetched', { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  },
};
