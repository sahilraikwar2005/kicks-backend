import mongoose from 'mongoose';
import BlogPost from './model.js';

const fields = ['title', 'slug', 'content', 'excerpt', 'coverImage', 'tags', 'seo', 'status'];
const pick = (body) => Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

export const blogService = {
  listPublic: () => BlogPost.find({ status: 'PUBLISHED' }).populate('author', 'firstName lastName').sort({ publishedAt: -1 }).lean(),
  getPublic: async (slug) => { const post = await BlogPost.findOne({ slug, status: 'PUBLISHED' }).populate('author', 'firstName lastName').lean(); if (!post) { const error = new Error('Blog post not found'); error.statusCode = 404; throw error; } return post; },
  listAdmin: () => BlogPost.find().sort({ updatedAt: -1 }),
  create: (userId, body) => BlogPost.create({ ...pick(body), author: userId, publishedAt: body.status === 'PUBLISHED' ? new Date() : undefined }),
  update: async (id, body) => { if (!mongoose.isValidObjectId(id)) { const error = new Error('Invalid blog post id'); error.statusCode = 400; throw error; } const post = await BlogPost.findByIdAndUpdate(id, { ...pick(body), ...(body.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}) }, { new: true, runValidators: true }); if (!post) { const error = new Error('Blog post not found'); error.statusCode = 404; throw error; } return post; },
};
