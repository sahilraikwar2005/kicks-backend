import { apiError } from '../utils/apiResponse.js';

export const notFoundMiddleware = (req, res) => {
  res.status(404).json(apiError('Route not found', [`${req.originalUrl} does not exist`], 404));
};
