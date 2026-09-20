import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

const hasRequiredProductionConfig = !!(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
if (env.nodeEnv === 'production' && !hasRequiredProductionConfig) {
  throw new Error('Cloudinary production configuration is missing');
}

if (hasRequiredProductionConfig) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

export default cloudinary;
