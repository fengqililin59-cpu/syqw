/**
 * @file 跟进到期提醒：扫描 next_follow_at 已到期且未补记跟进的客户，企微提醒负责人。
 */
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { QueryTypes } from 'sequelize';
import {
  sequelize,
  Tenant,
  AutomationLog,
} from '../models/index.js';
import { env } from '../config/env.js';
import { sendAgentTextMessage } from './wework.service.js';
import { customerWhereScope } from '../utils/permissions.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TRIGGER = 'followup_due_reminder';

/**
 * 每个客户最新一条「仍有效」的到期跟进（无更晚的跟进记录覆盖）。
 * @param {{ tenantId?: number; customerId?: number; limit?: number }} opts
 */
export async function findDueFollowUps(opts = {}) {
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const replacements = { limit };
  let tenantSql = '';
  if (opts.tenantId != null) {
    tenantSql = 'AND c.tenant_id = :tenantId';
    replacements.tenantId = Number(opts.tenantId);
  }
  let customerSql = '';
  if (opts.customerId != null) {
    customerSql = 'AND c.id = :customerId';
    replacements.customerId = Number(opts.customerId);
  }

  return sequelize.query(
    `
    SELECT
      cf.id AS follow_up_id,
      cf.customer_id,
      cf.next_follow_at,
      cf.content,
      cf.created_at AS follow_created_at,
      c.tenant_id,
      c.owner_id,
      c.name AS customer_name,
      c.nickname AS customer_nickname,
      c.phone AS customer_phone,
      c.stage AS customer_stage,
      u.id AS owner_user_id,
      u.wework_userid AS owner_wework_userid,
      u.real_name AS owner_real_name,
      u.username AS owner_username
    FROM customer_follow_ups cf
    INNER JOIN customers c ON c.id = cf.customer_id AND c.deleted_at IS NULL
    INNER JOIN users u ON u.id = c.owner_id
    WHERE cf.next_follow_at IS NOT NULL
      AND cf.next_follow_at <= NOW()
      AND c.stage NOT IN ('deal', 'won', 'lost')
      ${tenantSql}
      ${customerSql}
      AND NOT EXISTS (
        SELECT 1 FROM customer_follow_ups cf2
        WHERE cf2.customer_id = cf.customer_id
          AND cf2.created_at > cf.next_follow_at
      )
      AND cf.id = (
        SELECT cf3.id FROM customer_follow_ups cf3
        WHERE cf3.customer_id = cf.customer_id
          AND cf3.next_follow_at IS NOT NULL
          AND cf3.next_follow_at <= NOW()
        ORDER BY cf3.next_follow_at ASC, cf3.id DESC
        LIMIT 1
      )
    ORDER BY cf.next_follow_at ASC
    LIMIT :limit
    `,
    { replacements, type: QueryTypes.SELECT },
  );
}

function shanghaiDayStart() {
  return dayjs().tz('Asia/Shanghai').startOf('day').toDate();
}

/**
 * @param {number} tenantId
 * @param {number} customerId
 */
async function alreadyNotifiedToday(tenantId, customerId) {
  const row = await AutomationLog.findOne({
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
      trigger_type: TRIGGER,
      executed_at: { [Op.gte]: shanghaiDayStart() },
      status: 'success',
    },
    attributes: ['id'],
  });
  return Boolean(row);
}

/**
 * @param {number} [limitPerRun]
 */
export async function runFollowUpDueReminderOnce(limitPerRun = 20) {
  const rows = await findDueFollowUps({ limit: limitPerRun * 3 });
  let scanned = 0;
  let notified = 0;
  let skipped = 0;

  for (const row of rows) {
    if (notified >= limitPerRun) break;
    scanned += 1;

    const tenantId = Number(row.tenant_id);
    const customerId = Number(row.customer_id);
    if (await alreadyNotifiedToday(tenantId, customerId)) {
      skipped += 1;
      continue;
    }

    const weworkUserid = String(row.owner_wework_userid || '').trim();
    if (!weworkUserid) {
      skipped += 1;
      continue;
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant?.wework_corp_id || !tenant?.wework_secret || !tenant?.wework_agent_id) {
      skipped += 1;
      continue;
    }

    const custLabel =
      row.customer_name ||
      row.customer_nickname ||
      row.customer_phone ||
      `客户#${customerId}`;
    const dueAt = new Date(row.next_follow_at);
    const overdueDays = Math.max(
      0,
      Math.floor((Date.now() - dueAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const detailUrl = `${env.appUrl.replace(/\/$/, '')}/app/customers/${customerId}`;
    const content = [
      '【跟进提醒】计划跟进已到期',
      `客户：${custLabel}`,
      `计划时间：${dueAt.toLocaleString('zh-CN', { hour12: false })}`,
      overdueDays > 0 ? `已逾期 ${overdueDays} 天` : '今日到期',
      row.content ? `上次备注：${String(row.content).slice(0, 120)}` : null,
      `请尽快跟进：${detailUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await sendAgentTextMessage(tenant, {
        touser: weworkUserid,
        content,
      });
      await AutomationLog.create({
        tenant_id: tenantId,
        customer_id: customerId,
        rule_id: null,
        trigger_type: TRIGGER,
        action_taken: 'notify_wework',
        status: 'success',
        message_preview: content.slice(0, 500),
        detail_json: {
          follow_up_id: Number(row.follow_up_id),
          next_follow_at: dueAt.toISOString(),
        },
        executed_at: new Date(),
      });
      notified += 1;
    } catch (e) {
      await AutomationLog.create({
        tenant_id: tenantId,
        customer_id: customerId,
        rule_id: null,
        trigger_type: TRIGGER,
        action_taken: 'notify_wework',
        status: 'failed',
        message_preview: String(e?.message || e).slice(0, 500),
        detail_json: { follow_up_id: Number(row.follow_up_id) },
        executed_at: new Date(),
      });
      // eslint-disable-next-line no-console
      console.error('[followup-due] notify failed', customerId, e?.message || e);
      skipped += 1;
    }
  }

  return { scanned, notified, skipped };
}

/**
 * 管理端：到期未跟进列表（按权限范围）。
 * @param {object} auth
 * @param {{ limit?: number }} query
 */
export async function listOverdueFollowUpsForTenant(auth, query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const scope = customerWhereScope(auth);
  const tenantId = auth.tenantId;

  const rows = await findDueFollowUps({ tenantId, limit: 200 });
  const filtered = rows.filter((r) => {
    if (scope.owner_id != null && Number(r.owner_id) !== Number(scope.owner_id)) {
      return false;
    }
    return true;
  });

  return filtered.slice(0, limit).map((r) => ({
    follow_up_id: Number(r.follow_up_id),
    customer_id: Number(r.customer_id),
    next_follow_at: r.next_follow_at,
    content: r.content || null,
    follow_created_at: r.follow_created_at,
    customer: {
      id: Number(r.customer_id),
      name: r.customer_name || null,
      nickname: r.customer_nickname || null,
      phone: r.customer_phone || null,
      stage: r.customer_stage || null,
    },
    owner: {
      id: Number(r.owner_user_id),
      real_name: r.owner_real_name || null,
      username: r.owner_username || null,
    },
    overdue_days: Math.max(
      0,
      Math.floor((Date.now() - new Date(r.next_follow_at).getTime()) / (24 * 60 * 60 * 1000)),
    ),
  }));
}

/**
 * @param {object} auth
 */
export async function countOverdueFollowUpsForTenant(auth) {
  const rows = await listOverdueFollowUpsForTenant(auth, { limit: 500 });
  return rows.length;
}
