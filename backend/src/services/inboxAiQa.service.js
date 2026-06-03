/**
 * @file AI 自动发送抽检队列（随机入队 + 人工 pass/fail）。
 */
import { Op } from 'sequelize';
import { AiReplyLog, InboxThread, Customer, Tenant } from '../models/index.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { writeAuditLog } from './auditLog.service.js';

function sampleRate() {
  const raw = process.env.INBOX_AI_QA_SAMPLE_RATE;
  if (raw != null && String(raw).trim() !== '') {
    return Math.max(0, Math.min(1, Number(raw) || 0));
  }
  return 0.1;
}

/**
 * 自动发送成功后按概率进入抽检队列
 * @param {number} logId
 */
export async function maybeEnqueueAiAutoSendQa(logId) {
  const rate = sampleRate();
  if (rate <= 0) return;
  if (Math.random() >= rate) return;

  await AiReplyLog.update(
    { qa_status: 'pending' },
    {
      where: {
        id: Number(logId),
        status: 'approved',
        approved_by: null,
        qa_status: null,
      },
    },
  );
}

/**
 * @param {object} auth
 * @param {object} [query]
 */
export async function listAiAutoSendQaQueue(auth, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(50, Math.max(1, Number(query.size) || 20));
  const view = String(query.view || 'pending');
  const days = Math.min(30, Math.max(1, Number(query.days) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where = {
    tenant_id: auth.tenantId,
    status: 'approved',
    approved_by: null,
    created_at: { [Op.gte]: since },
  };
  if (view === 'pending') {
    where.qa_status = 'pending';
  } else if (view === 'done') {
    where.qa_status = { [Op.in]: ['passed', 'failed'] };
  } else {
    where.qa_status = { [Op.ne]: null };
  }

  const { rows, count } = await AiReplyLog.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: InboxThread,
        attributes: ['id', 'customer_id', 'status', 'sales_stage'],
        include: [{ model: Customer, attributes: ['id', 'name', 'nickname'] }],
      },
    ],
  });

  const pendingCount = await AiReplyLog.count({
    where: {
      tenant_id: auth.tenantId,
      status: 'approved',
      approved_by: null,
      qa_status: 'pending',
      created_at: { [Op.gte]: since },
    },
  });

  return {
    list: rows.map((r) => r.get({ plain: true })),
    total: count,
    page,
    size,
    pending_count: pendingCount,
    sample_rate: sampleRate(),
    days,
  };
}

/**
 * @param {object} auth
 * @param {number} logId
 * @param {{ result: string; note?: string }} body
 */
export async function submitAiAutoSendQaReview(auth, logId, body) {
  const result = String(body.result || '').trim();
  if (!['passed', 'failed'].includes(result)) {
    throw new HttpError(400, 'result 须为 passed 或 failed', 400);
  }

  const log = await AiReplyLog.findOne({
    where: { id: Number(logId), tenant_id: auth.tenantId },
  });
  if (!log) throw new HttpError(404, '记录不存在', 404);
  if (log.qa_status !== 'pending') {
    throw new HttpError(400, '该记录不在待抽检状态', 400);
  }

  const note = body.note ? String(body.note).trim().slice(0, 500) : null;
  await log.update({
    qa_status: result,
    qa_reviewed_at: new Date(),
    qa_reviewed_by: auth.userId,
    qa_note: note,
  });

  await writeAuditLog(auth, {
    action: result === 'passed' ? 'inbox_ai_qa_passed' : 'inbox_ai_qa_failed',
    targetType: 'ai_reply_log',
    targetId: log.id,
    detail: { thread_id: log.thread_id, note, risk_level: log.risk_level },
  });

  return { log: log.get({ plain: true }) };
}

/**
 * @param {number} tenantId
 */
export async function isTenantInboxAiPlatformDisabled(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['inbox_ai_platform_disabled'],
  });
  return Boolean(tenant?.inbox_ai_platform_disabled);
}
