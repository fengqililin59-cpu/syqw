/**
 * @file 审计日志写入（失败不阻断业务）。
 */
import { AuditLog } from '../models/index.js';

/**
 * @param {{ tenantId: number; userId?: number | null }} auth
 * @param {{
 *  action: string;
 *  targetType: string;
 *  targetId?: string | number | null;
 *  detail?: Record<string, unknown> | null;
 *  ip?: string | null;
 *  userAgent?: string | null;
 * }} payload
 */
export async function writeAuditLog(auth, payload) {
  try {
    await AuditLog.create({
      tenant_id: Number(auth.tenantId),
      actor_user_id: auth.userId ? Number(auth.userId) : null,
      action: String(payload.action || '').slice(0, 64),
      target_type: String(payload.targetType || '').slice(0, 32),
      target_id: payload.targetId == null ? null : String(payload.targetId).slice(0, 64),
      detail_json: payload.detail || null,
      ip: payload.ip ? String(payload.ip).slice(0, 45) : null,
      user_agent: payload.userAgent ? String(payload.userAgent).slice(0, 512) : null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[audit-log] write failed', e);
  }
}
