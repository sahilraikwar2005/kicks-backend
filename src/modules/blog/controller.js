import { apiSuccess } from '../../utils/apiResponse.js';
import { blogService } from './service.js';

export const blogController = {
  list: async (req, res) => res.status(200).json(apiSuccess('Blog posts fetched', { posts: await blogService.listPublic() })),
  get: async (req, res) => res.status(200).json(apiSuccess('Blog post fetched', { post: await blogService.getPublic(req.params.slug) })),
  adminList: async (req, res) => res.status(200).json(apiSuccess('Blog posts fetched', { posts: await blogService.listAdmin() })),
  create: async (req, res) => res.status(201).json(apiSuccess('Blog post created', { post: await blogService.create(req.user._id, req.body) })),
  update: async (req, res) => res.status(200).json(apiSuccess('Blog post updated', { post: await blogService.update(req.params.id, req.body) })),
};
