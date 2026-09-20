import { env } from './env.js';

export const aiConfig = {
  apiKey: env.aiApiKey,
  model: env.aiModel,
  baseUrl: 'https://api.openai.com/v1',
};

export const aiModelDefaults = {
  temperature: 0.3,
  maxTokens: 1200,
};
