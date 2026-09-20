import AuditLog from './model.js';

export const auditService = {
  record({ actor, action, resource = '', resourceId = '', metadata = {}, ip = '' }) {
    return AuditLog.create({ actor, action, resource, resourceId: String(resourceId || ''), metadata, ip });
  },
};
