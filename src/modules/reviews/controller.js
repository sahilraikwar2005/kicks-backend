import { apiSuccess } from '../../utils/apiResponse.js';
import { reviewService } from './service.js';

export const reviewController = {
  list: async (req, res) => res.status(200).json(apiSuccess('Reviews fetched', { reviews: await reviewService.listApproved(req.params.productId) })),
  create: async (req, res) => res.status(201).json(apiSuccess('Review submitted for moderation', { review: await reviewService.create(req.user._id, req.params.productId, req.body) })),
};
