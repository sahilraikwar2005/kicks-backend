import { apiError } from '../utils/apiResponse.js';

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(apiError('Authentication required', ['Login required'], 401));
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json(apiError('Forbidden', ['You do not have permission to perform this action'], 403));
  }

  return next();
};

export const isAdmin = authorize('ADMIN', 'SUPER_ADMIN');
export const isSuperAdmin = authorize('SUPER_ADMIN');
