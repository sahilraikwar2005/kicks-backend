import { apiSuccess } from '../../utils/apiResponse.js';
import { addressService } from './service.js';

export const addressController = {
  list: async (req, res) => res.status(200).json(apiSuccess('Addresses fetched', { addresses: await addressService.list(req.user._id) })),
  get: async (req, res) => res.status(200).json(apiSuccess('Address fetched', { address: await addressService.get(req.user._id, req.params.id) })),
  create: async (req, res) => res.status(201).json(apiSuccess('Address created', { address: await addressService.create(req.user._id, req.body) })),
  update: async (req, res) => res.status(200).json(apiSuccess('Address updated', { address: await addressService.update(req.user._id, req.params.id, req.body) })),
  remove: async (req, res) => res.status(200).json(apiSuccess('Address deleted', { ok: await addressService.remove(req.user._id, req.params.id) })),
  setDefault: async (req, res) => res.status(200).json(apiSuccess('Default address updated', { address: await addressService.setDefault(req.user._id, req.params.id) })),
};
