/**
 * @file 线索分配：轮询、渠道映射、企微跟进人优先；新线索企微提醒。
 */
import Joi from 'joi';
import { TenantLeadSetting, User, Tenant } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin } from '../utils/permissions.js';
import { sendAgentTextMessage } from './wework.service.js';
import { env } from '../config/env.js';

export const ASSIGN_MODES = ['first_user', 'round_robin', 'channel_map'];

const settingsSchema = Joi.object({
  assign_mode: Joi.string()
    .valid(...ASSIGN_MODES)
    .optional(),
  channel_owner_map: Joi.object()
    .pattern(Joi.string().max(64), Joi.number().integer().positive())
    .max(50)
    .optional(),
  default_owner_id: Joi.number().integer().positive().allow(null).optional(),
  notify_wework: Joi.boolean().optional(),
}).unknown(false);

function normalizeChannelMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k || '').trim().toLowerCase();
    const id = Number(v);
    if (key && Number.isFinite(id) && id > 0) out[key] = id;
  }
  return out;
}

function pickChannelKeys(context = {}) {
  const keys = [];
  for (const k of [context.utm_source, context.channel_key, context.channel_name, context.state]) {
    const s = String(k || '').trim().toLowerCase();
    if (s) keys.push(s);
  }
  return keys;
}

async function assertActiveUser(tenantId, userId) {
  if (!userId) return null;
  return User.findOne({
    where: { id: Number(userId), tenant_id: Number(tenantId), status: 1 },
    attributes: ['id', 'username', 'real_name', 'wework_userid'],
  });
}

/**
 * @param {number} tenantId
 */
export async function getOrCreateLeadSettings(tenantId) {
  const tid = Number(tenantId);
  let row = await TenantLeadSetting.findByPk(tid);
  if (!row) {
    try {
      row = await TenantLeadSetting.create({
        tenant_id: tid,
        assign_mode: 'round_robin',
        channel_owner_map: {},
        notify_wework: true,
      });
    } catch (e) {
      row = await TenantLeadSetting.findByPk(tid);
      if (!row) throw e;
    }
  }
  return row;
}

/**
 * @param {number} tenantId
 * @param {import('./tenantLeadSetting.model.js').TenantLeadSetting} settings
 */
async function resolveRoundRobinOwner(tenantId, settings) {
  const users = await User.findAll({
    where: { tenant_id: Number(tenantId), status: 1 },
    order: [['id', 'ASC']],
    attributes: ['id', 'username', 'real_name', 'wework_userid'],
  });
  if (!users.length) return null;

  const ids = users.map((u) => u.id);
  let lastId = settings.round_robin_last_user_id != null ? Number(settings.round_robin_last_user_id) : null;
  let idx = lastId ? ids.indexOf(lastId) : -1;
  const nextIdx = (idx + 1) % ids.length;
  const nextUser = users[nextIdx];

  await settings.update({ round_robin_last_user_id: nextUser.id });
  return nextUser;
}

/**
 * @param {number} tenantId
 * @param {{
 *   utm_source?: string | null;
 *   channel_key?: string | null;
 *   channel_name?: string | null;
 *   state?: string | null;
 *   follow_userid?: string | null;
 *   prefer_wework_follow?: boolean;
 * }} context
 */
export async function resolveLeadOwnerId(tenantId, context = {}) {
  const tid = Number(tenantId);
  const followUid = String(context.follow_userid || '').trim();

  if (context.prefer_wework_follow !== false && followUid) {
    const mapped = await User.findOne({
      where: { tenant_id: tid, status: 1, wework_userid: followUid },
      attributes: ['id', 'username', 'real_name', 'wework_userid'],
    });
    if (mapped) {
      return { owner_id: mapped.id, assign_method: 'wework_follow', owner: mapped };
    }
  }

  let settings;
  try {
    settings = await getOrCreateLeadSettings(tid);
  } catch {
    const first = await User.findOne({
      where: { tenant_id: tid, status: 1 },
      order: [['id', 'ASC']],
      attributes: ['id', 'username', 'real_name', 'wework_userid'],
    });
    return first
      ? { owner_id: first.id, assign_method: 'first_user_fallback', owner: first }
      : null;
  }

  const map = normalizeChannelMap(settings.channel_owner_map);
  const channelKeys = pickChannelKeys(context);

  const tryChannelMap = settings.assign_mode === 'channel_map' || Object.keys(map).length > 0;
  if (tryChannelMap) {
    for (const key of channelKeys) {
      if (map[key]) {
        const u = await assertActiveUser(tid, map[key]);
        if (u) return { owner_id: u.id, assign_method: 'channel_map', owner: u, channel_key: key };
      }
    }
    if (map['*'] || map._default) {
      const u = await assertActiveUser(tid, map['*'] || map._default);
      if (u) return { owner_id: u.id, assign_method: 'channel_map_default', owner: u };
    }
  }

  if (settings.assign_mode === 'round_robin') {
    const u = await resolveRoundRobinOwner(tid, settings);
    if (u) return { owner_id: u.id, assign_method: 'round_robin', owner: u };
  }

  if (settings.default_owner_id) {
    const u = await assertActiveUser(tid, settings.default_owner_id);
    if (u) return { owner_id: u.id, assign_method: 'default_owner', owner: u };
  }

  const first = await User.findOne({
    where: { tenant_id: tid, status: 1 },
    order: [['id', 'ASC']],
    attributes: ['id', 'username', 'real_name', 'wework_userid'],
  });
  return first
    ? { owner_id: first.id, assign_method: 'first_user', owner: first }
    : null;
}

/**
 * @param {number} tenantId
 * @param {number} ownerId
 * @param {{ customer_id: number; name?: string; phone?: string; source?: string }} payload
 */
export async function notifyOwnerNewLead(tenantId, ownerId, payload) {
  let settings;
  try {
    settings = await getOrCreateLeadSettings(tenantId);
  } catch {
    return { notified: false, reason: 'settings_unavailable' };
  }
  if (!settings.notify_wework) return { notified: false, reason: 'disabled' };

  const [tenant, user] = await Promise.all([
    Tenant.findByPk(tenantId, { attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id'] }),
    User.findByPk(ownerId, { attributes: ['id', 'wework_userid', 'real_name', 'username'] }),
  ]);
  if (!tenant?.wework_corp_id || !tenant?.wework_secret || !user?.wework_userid) {
    return { notified: false, reason: 'wework_not_ready' };
  }

  const label = payload.name || payload.phone || `客户#${payload.customer_id}`;
  const url = `${env.appUrl.replace(/\/$/, '')}/app/customers/${payload.customer_id}`;
  const content = [
    '【新线索】请及时跟进',
    `客户：${label}`,
    payload.phone ? `手机：${payload.phone}` : null,
    payload.source ? `来源：${payload.source}` : null,
    `详情：${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await sendAgentTextMessage(tenant, { touser: user.wework_userid, content });
    return { notified: true };
  } catch (e) {
    console.error('[lead-assign] notify failed', e?.message || e);
    return { notified: false, reason: 'send_failed' };
  }
}

export async function getLeadAssignmentSettings(auth) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const settings = await getOrCreateLeadSettings(auth.tenantId);
  const users = await User.findAll({
    where: { tenant_id: auth.tenantId, status: 1 },
    attributes: ['id', 'username', 'real_name', 'wework_userid'],
    order: [['id', 'ASC']],
  });
  const plain = settings.get({ plain: true });
  return {
    assign_mode: plain.assign_mode || 'round_robin',
    channel_owner_map: normalizeChannelMap(plain.channel_owner_map),
    default_owner_id: plain.default_owner_id ?? null,
    notify_wework: Boolean(plain.notify_wework),
    round_robin_last_user_id: plain.round_robin_last_user_id ?? null,
    mode_options: ASSIGN_MODES.map((m) => ({
      value: m,
      label:
        m === 'round_robin'
          ? '轮询分配（推荐）'
          : m === 'channel_map'
            ? '按渠道映射'
            : '固定首位员工',
    })),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      real_name: u.real_name,
      wework_bound: Boolean(u.wework_userid),
    })),
  };
}

export async function updateLeadAssignmentSettings(auth, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const { error, value } = settingsSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const settings = await getOrCreateLeadSettings(auth.tenantId);
  const patch = {};

  if (value.assign_mode !== undefined) patch.assign_mode = value.assign_mode;
  if (value.channel_owner_map !== undefined) {
    const map = normalizeChannelMap(value.channel_owner_map);
    for (const uid of Object.values(map)) {
      const u = await assertActiveUser(auth.tenantId, uid);
      if (!u) {
        throw new HttpError(400, `渠道映射中的用户 #${uid} 不存在或已停用`, 400);
      }
    }
    patch.channel_owner_map = map;
  }
  if (value.default_owner_id !== undefined) {
    if (value.default_owner_id != null) {
      const u = await assertActiveUser(auth.tenantId, value.default_owner_id);
      if (!u) throw new HttpError(400, '默认负责人不存在或已停用', 400);
    }
    patch.default_owner_id = value.default_owner_id;
  }
  if (value.notify_wework !== undefined) patch.notify_wework = Boolean(value.notify_wework);

  if (Object.keys(patch).length) await settings.update(patch);
  return getLeadAssignmentSettings(auth);
}
