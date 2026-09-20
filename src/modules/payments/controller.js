import { apiSuccess } from '../../utils/apiResponse.js';
import { paymentService } from './service.js';

export const paymentController = {
  createOrder: async (req, res) => {
    const result = await paymentService.createOrder(req.user._id, req.params.orderId);
    return res.status(201).json(apiSuccess('Payment order created', result));
  },

  verify: async (req, res) => {
    const payment = await paymentService.verifyPayment(req.user._id, req.body);
    return res.status(200).json(apiSuccess('Payment verified', { payment }));
  },

  webhook: async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    if (!rawBody) {
      const error = new Error('Webhook body is required');
      error.statusCode = 400;
      throw error;
    }

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      const parseError = new Error('Malformed webhook payload');
      parseError.statusCode = 400;
      throw parseError;
    }

    const result = await paymentService.handleWebhook(rawBody, req.headers['x-razorpay-signature'], payload);
    return res.status(200).json(apiSuccess('Webhook received', result));
  },
};
