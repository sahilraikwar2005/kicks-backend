import CmsContent from './model.js';

const allowed = ['key', 'type', 'content', 'sortOrder', 'active'];
const pick = (body) => Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

export const cmsService = {
  publicList: () => CmsContent.find({ active: true }).sort({ sortOrder: 1 }).lean(),
  adminList: () => CmsContent.find().sort({ sortOrder: 1 }),
  create: (body) => CmsContent.create(pick(body)),
  update: (id, body) => CmsContent.findByIdAndUpdate(id, pick(body), { new: true, runValidators: true }),
};
