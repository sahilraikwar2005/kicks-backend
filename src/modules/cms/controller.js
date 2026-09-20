import { apiSuccess } from '../../utils/apiResponse.js';
import { cmsService } from './service.js';

export const cmsController = {
  publicList: async (req, res) => res.status(200).json(apiSuccess('CMS content fetched', { items: await cmsService.publicList() })),
  adminList: async (req, res) => res.status(200).json(apiSuccess('CMS content fetched', { items: await cmsService.adminList() })),
  create: async (req, res) => res.status(201).json(apiSuccess('CMS content created', { item: await cmsService.create(req.body) })),
  update: async (req, res) => res.status(200).json(apiSuccess('CMS content updated', { item: await cmsService.update(req.params.id, req.body) })),
};
