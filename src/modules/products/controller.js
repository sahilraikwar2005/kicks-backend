import { apiSuccess } from '../../utils/apiResponse.js';
import { productService } from './service.js';
import { auditService } from '../audit/service.js';

export const productController = {
  listProducts: async (req, res) => {
    const result = await productService.listProducts(req.query);
    return res.status(200).json(apiSuccess('Products fetched successfully', result));
  },

  featured: async (req, res) => {
    const result = await productService.listProducts({ featured: true, status: 'PUBLISHED', limit: req.query.limit || 12 });
    return res.status(200).json(apiSuccess('Featured products fetched successfully', result));
  },

  getProductBySlug: async (req, res) => {
    const product = await productService.getProductBySlug(req.params.slug);
    return res.status(200).json(apiSuccess('Product fetched successfully', { product }));
  },

  createProduct: async (req, res) => {
    const product = await productService.createProduct(req.body);
    await auditService.record({ actor: req.user._id, action: 'PRODUCT_CREATED', resource: 'product', resourceId: product._id, ip: req.ip });
    return res.status(201).json(apiSuccess('Product created successfully', { product }));
  },

  updateProduct: async (req, res) => {
    const product = await productService.updateProduct(req.params.id, req.body);
    await auditService.record({ actor: req.user._id, action: 'PRODUCT_UPDATED', resource: 'product', resourceId: product._id, metadata: { fields: Object.keys(req.body) }, ip: req.ip });
    return res.status(200).json(apiSuccess('Product updated successfully', { product }));
  },

  deleteProduct: async (req, res) => {
    await productService.deleteProduct(req.params.id);
    await auditService.record({ actor: req.user._id, action: 'PRODUCT_DELETED', resource: 'product', resourceId: req.params.id, ip: req.ip });
    return res.status(200).json(apiSuccess('Product deleted successfully', { ok: true }));
  },
};
