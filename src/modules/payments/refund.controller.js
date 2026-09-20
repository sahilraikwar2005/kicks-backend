import { apiSuccess } from '../../utils/apiResponse.js';
import { refundService } from './refund.service.js';

export const refundController = {
  refund: async (req, res) => res.status(200).json(apiSuccess('Refund processed', await refundService.refund(req.params.id, req.user._id, req.body.amount, {
    idempotencyKey: req.body.idempotencyKey || req.get('Idempotency-Key'),
    reason: req.body.reason || '',
    requestId: req.requestId || '',
  }))),
};
