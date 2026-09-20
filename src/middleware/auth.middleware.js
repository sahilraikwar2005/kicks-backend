import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../modules/users/model.js';
import { apiError } from '../utils/apiResponse.js';

const getBearerToken = (req) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

export const protect = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json(apiError('Authentication required', ['Invalid or missing token'], 401));
    }

    const decoded = jwt.verify(token, env.jwtAccessSecret);
    const user = await User.findById(decoded.sub || decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json(apiError('Authentication failed', ['User not found or inactive'], 401));
    }

    if (decoded.role && decoded.role !== user.role) {
      return res.status(401).json(apiError('Authentication failed', ['Token role does not match the authenticated account'], 401));
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json(apiError('Authentication failed', ['Invalid or expired token'], 401));
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, env.jwtAccessSecret);
    const user = await User.findById(decoded.sub || decoded.id).select('-password');
    if (user && user.isActive) {
      if (decoded.role && decoded.role !== user.role) {
        return next();
      }
      req.user = user;
    }
    return next();
  } catch (error) {
    return next();
  }
};
