import crypto from 'node:crypto';
import { env } from '../config/env.js';

const allowedOrigins = new Set([env.clientUrl, env.adminUrl]);

export function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  return next();
}

export function csrfOriginGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.cookies?.accessToken) return next();
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ success: false, message: 'Invalid request origin', requestId: req.requestId });
  return next();
}
