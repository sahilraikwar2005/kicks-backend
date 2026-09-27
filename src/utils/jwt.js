import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpires });
}

// Every refresh token carries a cryptographically random jti. Without it,
// two tokens minted for one user within the same second are byte-identical
// (jsonwebtoken's iat has 1-second resolution), and their sha256 session
// hashes collide on the unique UserSession.tokenHash index (E11000).
export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpires });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}
