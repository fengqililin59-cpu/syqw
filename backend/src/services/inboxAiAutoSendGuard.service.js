/**
 * @file 收件箱 AI 自动发送护栏：仅企微出站 + 日/会话上限。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op } from 'sequelize';
import { InboxThread, OmniChannel, AiReplyLog, Customer } from '../models/index.js';
import { env } from '../config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const WEWORK_CODE = 'wework';

/** @type {Record<string, string>} */
export const AUTO_SEND_SKIP_MESSAGES = {
  not_wework_channel: '仅企微会话支持 AI 自动发送；抖音/小红书等公域请在平台内人工回复',
  daily_cap: '已达本租户今日 AI 自动发送上限，请人工回复或明日再试',
  thread_cap: '本会话今日 AI 自动发送次数已达上限，请改人工回复',
  no_external_userid: '企微客户缺少 external_userid，无法自动发送，请人工回复',
};

function todayStart() {
  return dayjs().tz(TZ).startOf('day').toDate();
}

function autoSentWhere(tenantId, extra = {}) {
  return {
    tenant_id: Number(tenantId),
    status: 'approved',
    approved_by: null,
    created_at: { [Op.gte]: todayStart() },
    ...extra,
  };
}

/**
 * @param {number} tenantId
 * @param {number} threadId
 * @returns {Promise<{ ok: boolean; reason?: string; message?: string; channel_code?: string; channel_name?: string; daily_count?: number; daily_cap?: number; thread_count?: number; thread_cap?: number }>}
 */
export async function getInboxAiAutoSendGuard(tenantId, threadId) {
  const thread = await InboxThread.findOne({
    where: { id: Number(threadId), tenant_id: Number(tenantId) },
    include: [{ model: OmniChannel, as: 'channel', attributes: ['code', 'name'] }],
  });
  if (!thread) {
    return { ok: false, reason: 'no_thread', message: '会话不存在' };
  }
  if (thread.status === 'closed' || thread.status === 'pending_human') {
    return { ok: false, reason: 'thread_closed', message: AUTO_SEND_SKIP_MESSAGES.thread_closed };
  }

  const channelCode = String(thread.channel?.code || '');
  if (channelCode !== WEWORK_CODE) {
    return {
      ok: false,
      reason: 'not_wework_channel',
      message: AUTO_SEND_SKIP_MESSAGES.not_wework_channel,
      channel_code: channelCode,
      channel_name: thread.channel?.name || channelCode,
    };
  }

  const meta =
    thread.metadata_json && typeof thread.metadata_json === 'object' ? thread.metadata_json : {};
  let externalUserid = meta.external_userid ? String(meta.external_userid) : '';
  if (!externalUserid && thread.customer_id) {
    const c = await Customer.findByPk(thread.customer_id, { attributes: ['external_userid'] });
    externalUserid = c?.external_userid ? String(c.external_userid) : '';
  }
  if (!externalUserid) {
    return {
      ok: false,
      reason: 'no_external_userid',
      message: AUTO_SEND_SKIP_MESSAGES.no_external_userid,
      channel_code: channelCode,
    };
  }

  const dailyCap = Number(env.inboxAiAutoSendDailyCap) || 0;
  if (dailyCap > 0) {
    const dailyCount = await AiReplyLog.count({ where: autoSentWhere(tenantId) });
    if (dailyCount >= dailyCap) {
      return {
        ok: false,
        reason: 'daily_cap',
        message: AUTO_SEND_SKIP_MESSAGES.daily_cap,
        daily_count: dailyCount,
        daily_cap: dailyCap,
      };
    }
  }

  const threadCap = Number(env.inboxAiAutoSendThreadDailyCap) || 0;
  if (threadCap > 0) {
    const threadCount = await AiReplyLog.count({
      where: autoSentWhere(tenantId, { thread_id: Number(threadId) }),
    });
    if (threadCount >= threadCap) {
      return {
        ok: false,
        reason: 'thread_cap',
        message: AUTO_SEND_SKIP_MESSAGES.thread_cap,
        thread_count: threadCount,
        thread_cap: threadCap,
      };
    }
  }

  return {
    ok: true,
    channel_code: channelCode,
    channel_name: thread.channel?.name,
  };
}

/**
 * @param {number} tenantId
 */
export async function getInboxAiAutoSendUsageToday(tenantId) {
  const dailyCount = await AiReplyLog.count({ where: autoSentWhere(tenantId) });
  const dailyCap = Number(env.inboxAiAutoSendDailyCap) || 0;
  const threadCap = Number(env.inboxAiAutoSendThreadDailyCap) || 0;
  return {
    daily_count: dailyCount,
    daily_cap: dailyCap,
    thread_cap: threadCap,
    wework_only: true,
  };
}
