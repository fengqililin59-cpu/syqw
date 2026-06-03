/**
 * @file AI客服自动回复统计：供前端监控面板使用。
 */
import { Op, fn, col, literal } from 'sequelize';
import { AiReplyLog, InboxThread, Tenant } from '../models/index.js';

/**
 * @param {{ tenantId: number }} auth
 * @param {{ days?: number }} query
 */
export async function getAiCustomerServiceStats(auth, query = {}) {
  const tenantId = auth.tenantId;
  const days = Math.min(90, Math.max(1, Number(query.days) || 7));

  const since = new Date(Date.now() - days * 86400000);

  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['inbox_auto_draft_enabled', 'inbox_ai_auto_send', 'inbox_ai_auto_send_pricing'],
  });

  const mode = deriveMode(tenant);

  // 自动发送统计
  const autoStats = await AiReplyLog.findAll({
    attributes: [
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN approved_by IS NULL THEN 1 ELSE 0 END")), 'auto_sent'],
      [fn('SUM', literal("CASE WHEN approved_by IS NOT NULL THEN 1 ELSE 0 END")), 'manual_sent'],
      [fn('SUM', literal("CASE WHEN risk_level = 'p0' THEN 1 ELSE 0 END")), 'p0_count'],
      [fn('SUM', literal("CASE WHEN risk_level = 'p1' THEN 1 ELSE 0 END")), 'p1_count'],
      [fn('SUM', literal("CASE WHEN risk_level = 'p2' THEN 1 ELSE 0 END")), 'p2_count'],
      [fn('AVG', col('confidence')), 'avg_confidence'],
    ],
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: since },
      status: 'approved',
    },
    raw: true,
  });

  const stats = autoStats[0] || {};
  const total = Number(stats.total) || 0;
  const autoSent = Number(stats.auto_sent) || 0;
  const manualSent = Number(stats.manual_sent) || 0;

  // 每日趋势
  const dailyTrend = await AiReplyLog.findAll({
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN approved_by IS NULL THEN 1 ELSE 0 END")), 'auto_sent'],
    ],
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: since },
      status: 'approved',
    },
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  // 活跃会话数（容错：inbox 表可能未创建）
  let activeThreads = 0;
  try {
    activeThreads = await InboxThread.count({
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: ['open', 'pending_human'] },
      },
    });
  } catch {
    // inbox_threads 表不存在时静默降级
  }

  // 待审核草稿数
  const pendingDrafts = await AiReplyLog.count({
    where: {
      tenant_id: tenantId,
      status: 'draft',
    },
  });

  return {
    mode,
    summary: {
      total_replies: total,
      auto_sent: autoSent,
      manual_sent: manualSent,
      auto_rate: total > 0 ? Math.round((autoSent / total) * 100) : 0,
      active_threads: activeThreads,
      pending_drafts: pendingDrafts,
    },
    risk_distribution: {
      p0: Number(stats.p0_count) || 0,
      p1: Number(stats.p1_count) || 0,
      p2: Number(stats.p2_count) || 0,
    },
    avg_confidence: stats.avg_confidence ? Math.round(Number(stats.avg_confidence) * 100) : 0,
    daily_trend: dailyTrend.map((r) => ({
      date: r.date,
      total: Number(r.total),
      auto_sent: Number(r.auto_sent),
      manual: Number(r.total) - Number(r.auto_sent),
    })),
    days,
    tenant_settings: {
      inbox_auto_draft_enabled: Boolean(tenant?.inbox_auto_draft_enabled),
      inbox_ai_auto_send: Boolean(tenant?.inbox_ai_auto_send),
      inbox_ai_auto_send_pricing: Boolean(tenant?.inbox_ai_auto_send_pricing),
    },
  };
}

function deriveMode(tenant) {
  if (!tenant) return 'manual';
  const draft = tenant.inbox_auto_draft_enabled;
  const faq = tenant.inbox_ai_auto_send;
  const pricing = tenant.inbox_ai_auto_send_pricing;
  if (draft && faq && pricing) return 'full_auto';
  if (draft && faq) return 'semi_auto';
  return 'manual';
}
