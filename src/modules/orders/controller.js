import { apiSuccess } from '../../utils/apiResponse.js';
import { orderService } from './service.js';
import { auditService } from '../audit/service.js';

export const orderController = {
  checkout: async (req, res) => {
    const order = await orderService.createOrderFromCart(req.user._id, req.body);
    return res.status(201).json(apiSuccess('Order created successfully', { order }));
  },

  listForUser: async (req, res) => {
    const orders = await orderService.listForUser(req.user._id);
    return res.status(200).json(apiSuccess('Orders fetched successfully', { orders }));
  },

  getById: async (req, res) => {
    const order = await orderService.getById(req.user._id, req.params.id);
    return res.status(200).json(apiSuccess('Order fetched successfully', { order }));
  },

  cancel: async (req, res) => {
    const order = await orderService.cancelByCustomer(req.user._id, req.params.id);
    return res.status(200).json(apiSuccess('Order cancelled', { order }));
  },

  listAdmin: async (req, res) => {
    const orders = await orderService.listAdmin();
    return res.status(200).json(apiSuccess('All orders fetched successfully', { orders }));
  },

  updateStatus: async (req, res) => {
    const order = await orderService.updateStatus(req.params.id, req.body.status);
    await auditService.record({ actor: req.user._id, action: 'ORDER_STATUS_CHANGED', resource: 'order', resourceId: order._id, metadata: { status: order.status }, ip: req.ip });
    return res.status(200).json(apiSuccess('Order status updated', { order }));
  },
};
