import { apiSuccess } from '../../utils/apiResponse.js';
import { brandService } from './service.js';

export const brandController = {
  list: async (req, res) => {
    const data = await brandService.list();
    return res.status(200).json(apiSuccess('Brands fetched successfully', data));
  },
  getById: async (req, res) => {
    const data = await brandService.getById(req.params.id);
    return res.status(200).json(apiSuccess('Brand fetched successfully', { brand: data }));
  },
  create: async (req, res) => {
    const data = await brandService.create(req.body);
    return res.status(201).json(apiSuccess('Brand created successfully', { brand: data }));
  },
  update: async (req, res) => {
    const data = await brandService.update(req.params.id, req.body);
    return res.status(200).json(apiSuccess('Brand updated successfully', { brand: data }));
  },
  remove: async (req, res) => {
    await brandService.remove(req.params.id);
    return res.status(200).json(apiSuccess('Brand deleted successfully', { ok: true }));
  },
};
