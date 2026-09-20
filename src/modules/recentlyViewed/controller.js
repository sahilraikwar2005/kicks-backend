import { apiSuccess } from '../../utils/apiResponse.js';
import { recentlyViewedService } from './service.js';

export const recentlyViewedController = {
  add: async (req, res) => res.status(201).json(apiSuccess('Product view recorded', { item: await recentlyViewedService.add(req.user._id, req.params.id) })),
  list: async (req, res) => res.status(200).json(apiSuccess('Recently viewed products fetched', { items: await recentlyViewedService.list(req.user._id) })),
  clear: async (req, res) => res.status(200).json(apiSuccess('Recently viewed products cleared', { ok: await recentlyViewedService.clear(req.user._id) })),
};
