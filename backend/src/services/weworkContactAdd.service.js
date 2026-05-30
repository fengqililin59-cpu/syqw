/**
 * @file 企微 add_external_contact 回调：自动入库客户并触发新客户流程。
 */
import { Tenant, Customer, WeworkChannel } from '../models/index.js';
import { env } from '../config/env.js';
import { getAccessToken } from './wework.service.js';
import { fetchExternalDetail, pickFollowInfo, strOrNull } from './wework-sync.service.js';
import { dispatchNewCustomerFlows } from './flowEngine.service.js';
import { resolveLeadOwnerId, notifyOwnerNewLead } from './leadAssignment.service.js';

const WEWORK_ADD_SOURCE = '企微加好友';

async function resolveOwner(tenantId, followUserid, channelId, state) {
  let channelName = null;
  if (channelId) {
    const ch = await WeworkChannel.findByPk(channelId, { attributes: ['name', 'state'] });
    channelName = ch?.name ?? null;
  }
  const resolved = await resolveLeadOwnerId(tenantId, {
    follow_userid: followUserid,
    channel_key: state || channelName,
    channel_name: channelName,
    state,
    prefer_wework_follow: true,
  });
  if (resolved?.owner) return resolved.owner;
  return null;
}

async function resolveSourceLabel(tenantId, channelId, state) {
  if (channelId) {
    const ch = await WeworkChannel.findByPk(channelId, { attributes: ['name'] });
    if (ch?.name) return `活码·${ch.name}`;
  }
  const st = String(state || '').trim();
  if (st) return `活码·${st.slice(0, 40)}`;
  return WEWORK_ADD_SOURCE;
}

function buildFieldsFromDetail(got, followUserid) {
  const ec = got.data.external_contact;
  const fi = followUserid ? pickFollowInfo(got.data, String(followUserid)) : null;
  let addedAt = new Date();
  if (fi) {
    const raw = fi.createtime ?? fi.create_time;
    if (raw != null) {
      const ts = Number(raw);
      if (!Number.isNaN(ts) && ts > 0) addedAt = new Date(ts * 1000);
    }
  }
  return {
    external_userid: ec.external_userid,
    name: strOrNull(ec.name),
    nickname: strOrNull(fi?.remark) || strOrNull(ec.name),
    avatar_url: strOrNull(ec.avatar),
    gender: ec.gender != null ? Number(ec.gender) : 0,
    company: strOrNull(ec.corp_name || ec.corp_full_name),
    position: strOrNull(ec.position),
    added_at: addedAt,
  };
}

/**
 * 加好友事件后确保客户存在于 CRM；新建时触发流程编排（new_customer）。
 * @param {{ tenantId: number; external_userid?: string | null; follow_userid?: string | null; state?: string | null; channelId?: number | null }} payload
 */
export async function ensureCustomerFromWeworkContactAdd(payload) {
  if (!env.autoCreateCustomerOnWeworkAdd) {
    return { skipped: true, reason: 'disabled' };
  }

  const tenantId = Number(payload.tenantId);
  const extId = String(payload.external_userid || '').trim();
  if (!extId) return { skipped: true, reason: 'no_external_userid' };

  const existing = await Customer.findOne({
    where: { tenant_id: tenantId, external_userid: extId },
    paranoid: false,
  });
  if (existing) {
    if (existing.deleted_at) await existing.restore();
    return { created: false, customer_id: existing.id, reason: 'exists' };
  }

  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
    return { skipped: true, reason: 'wework_not_configured' };
  }

  const owner = await resolveOwner(tenantId, payload.follow_userid, payload.channelId, payload.state);
  if (!owner) return { skipped: true, reason: 'no_owner' };

  const source = await resolveSourceLabel(tenantId, payload.channelId, payload.state);

  let detailFields = {
    external_userid: extId,
    name: '企微客户',
    nickname: null,
    avatar_url: null,
    gender: 0,
    company: null,
    position: null,
    added_at: new Date(),
  };

  try {
    const accessToken = await getAccessToken(tenant);
    const got = await fetchExternalDetail(accessToken, extId);
    if (got.ok && got.data?.external_contact?.external_userid) {
      detailFields = buildFieldsFromDetail(got, payload.follow_userid);
    }
  } catch (e) {
    console.warn('[wework-contact-add] fetch detail failed, creating minimal row', e?.message || e);
  }

  const row = await Customer.create({
    tenant_id: tenantId,
    owner_id: owner.id,
    source,
    stage: 'new',
    phone: null,
    wechat_id: null,
    ...detailFields,
  });

  dispatchNewCustomerFlows(tenantId, row.id).catch((err) =>
    console.error('[flow-engine] dispatchNewCustomerFlows from wework add', err),
  );

  notifyOwnerNewLead(tenantId, owner.id, {
    customer_id: row.id,
    name: detailFields.name,
    phone: null,
    source,
  }).catch((err) => console.error('[lead-assign] wework add notify', err));

  return { created: true, customer_id: row.id, owner_id: owner.id, source };
}
