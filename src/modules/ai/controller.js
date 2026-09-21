import { apiSuccess } from '../../utils/apiResponse.js';
import { analyzeProductImage } from './service.js';

export const aiController = {
  analyzeProduct: async (req, res) => {
    const result = await analyzeProductImage({ imageUrl: req.body?.imageUrl });
    return res.status(200).json(apiSuccess('Product analysis ready', result));
  },
};
