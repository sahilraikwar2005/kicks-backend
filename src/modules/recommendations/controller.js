import { apiSuccess } from '../../utils/apiResponse.js';
import { recommendationService } from './service.js';

export const recommendationController = { list: async (req, res) => res.status(200).json(apiSuccess('Recommendations fetched', { items: await recommendationService.forProduct(req.params.slug, req.query.limit) })) };
