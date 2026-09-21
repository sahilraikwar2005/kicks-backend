import { env } from './env.js';

const normalizeOrigin = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const match = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/]*)(.*)$/);
  if (!match) return trimmed.toLowerCase();
  return `${match[1].toLowerCase()}://${match[2].toLowerCase()}${match[3] || ''}`;
};

const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const configuredOrigins = () => [env.clientUrl, env.adminUrl].map(normalizeOrigin).filter(Boolean);

/**
 * Single source of truth for trusted browser origins, shared by CORS and the
 * cookie-auth origin guard so the two can never disagree.
 *
 * - Exact configured origins (CLIENT_URL, ADMIN_URL), compared after
 *   normalization (trailing slashes and scheme/host casing are ignored).
 * - Localhost / 127.0.0.1 development origins are additionally trusted, but
 *   ONLY when the backend is not running in production.
 * - Everything else (including `*`) is untrusted.
 */
export function isTrustedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (configuredOrigins().includes(normalized)) return true;
  if (env.nodeEnv !== 'production' && LOCAL_DEV_ORIGIN_PATTERN.test(normalized)) return true;
  return false;
}

export function trustedOriginList() {
  return [...new Set(configuredOrigins())];
}
