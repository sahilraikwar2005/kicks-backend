import { apiSuccess } from '../../utils/apiResponse.js';
import { shipmentService } from './service.js';

export const shipmentController = {
  create: async (req, res) => res.status(201).json(apiSuccess('Shipment created', { shipment: await shipmentService.createForOrder(req.params.id) })),
  listAdmin: async (req, res) => {
    const result = await shipmentService.listAdmin(req.query);
    res.status(200).json(apiSuccess('Shipments fetched', result));
  },
  getAdminDetails: async (req, res) => {
    const shipment = await shipmentService.getAdminDetails(req.params.id);
    res.status(200).json(apiSuccess('Shipment details fetched', { shipment }));
  },
  tracking: async (req, res) => res.status(200).json(apiSuccess('Tracking fetched', { shipment: await shipmentService.getForCustomer(req.params.id, req.user._id) })),
  webhook: async (req, res) => {
    let payload = req.body;
    if (Buffer.isBuffer(req.body)) {
      try {
        payload = JSON.parse(req.body.toString('utf8'));
      } catch (error) {
        error.statusCode = 400;
        error.message = 'Malformed shipping webhook payload';
        throw error;
      }
    }
    const result = await shipmentService.handleWebhook(req.body, req.get('x-shiprocket-signature') || req.get('x-kicks-shipping-signature'), payload);
    res.status(200).json(apiSuccess('Shipping webhook received', result));
  },
};
