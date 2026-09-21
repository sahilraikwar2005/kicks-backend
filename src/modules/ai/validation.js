import Joi from 'joi';

export const analyzeProductSchema = Joi.object({
  imageUrl: Joi.string().trim().uri({ scheme: ['https'] }).max(2048).required(),
});
