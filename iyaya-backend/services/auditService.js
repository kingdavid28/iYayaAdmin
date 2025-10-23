// services/auditService.js
// Legacy wrapper retained for backwards compatibility. Routes now use
// the Supabase-backed AuditLogService exposed from `supabaseService`.

const { AuditLogService } = require('../services/supabaseService');

function logConsole(action, payload = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT][${timestamp}] ${action}`, payload);
}

async function logAction({
  userId,
  action,
  entity = null,
  entityId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  status = 'SUCCESS'
}) {
  try {
    logConsole(action, {
      userId,
      entity,
      entityId,
      status,
      metadata
    });
    console.log('[AUDIT] adminId being logged:', userId);
    return await AuditLogService.create({
      admin_id: userId,
      action,
      entity,
      target_id: entityId,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
      status
    });
  } catch (error) {
    console.error('[AUDIT_ERROR] Failed to log action:', {
      error: error.message,
      action,
      userId,
      entity,
      entityId
    });
    return null;
  }
}

async function logSecurityEvent(eventType, metadata = {}, userId = null) {
  return logAction({
    userId,
    action: `SECURITY_${eventType}`,
    entity: 'SYSTEM',
    metadata,
    status: metadata.error ? 'FAILED' : 'SUCCESS'
  });
}

async function logActivity(action, metadata = {}) {
  return logAction({
    userId: metadata.userId || metadata.adminId || null,
    action,
    entity: metadata.entity || 'SYSTEM',
    entityId: metadata.entityId || metadata.targetId || null,
    metadata,
    status: metadata.error ? 'FAILED' : 'SUCCESS'
  });
}

module.exports = {
  logAction,
  logSecurityEvent,
  logActivity
};