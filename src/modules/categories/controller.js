import { apiSuccess } from '../../utils/apiResponse.js';
import { categoryService } from './service.js';

export const categoryController = {
  list: async (req, res) => {
    const data = await categoryService.list();
    return res.status(200).json(apiSuccess('Categories fetched successfully', data));
  },
  getById: async (req, res) => {
    const data = await categoryService.getById(req.params.id);
    return res.status(200).json(apiSuccess('Category fetched successfully', { category: data }));
  },
  create: async (req, res) => {
    const data = await categoryService.create(req.body);
    return res.status(201).json(apiSuccess('Category created successfully', { category: data }));
  },
  update: async (req, res) => {
    const data = await categoryService.update(req.params.id, req.body);
    return res.status(200).json(apiSuccess('Category updated successfully', { category: data }));
  },
  remove: async (req, res) => {
    await categoryService.remove(req.params.id);
    return res.status(200).json(apiSuccess('Category deleted successfully', { ok: true }));
  },
};
