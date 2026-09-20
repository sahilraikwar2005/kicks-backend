import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  content: { type: String, required: true },
  excerpt: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [{ type: String }],
  seo: { title: String, description: String },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  publishedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('BlogPost', blogSchema);
