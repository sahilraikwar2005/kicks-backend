// Absolute URL of the standalone admin application (kicks-admin).
// Returns null when unconfigured so callers can hide admin shortcuts
// instead of linking into a dead route.
export const adminAppUrl = (path = '') => {
  const base = String(import.meta.env.VITE_ADMIN_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  const suffix = String(path || '');
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
};
