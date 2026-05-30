/**
 * @file 企微接收消息：解析解密后的 XML、匹配客户、写入 wework_customer_messages。
 */
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
import { Op } from 'sequelize';
import { Tenant, User, Customer, WeworkCustomerMessage } from '../models/index.js';
import { env } from '../config/env.js';
import { queueIntentScore } from '../services/intentScore.service.js';
import { recordCustomerAdd } from '../services/channelLiveCode.service.js';
import { upsertFromWeworkMessage } from './inboxSync.service.js';

const RAW_XML_MAX = 60000;

/**
 * @param {unknown} v xml2js 字段
 */
function cdata(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '_' in v) return String(/** @type {{ _: string }} */ (v)._);
  return String(v);
}

/**
 * @param {Record<string, unknown>} o
 * @param {string} key
 */
function pick(o, key) {
  return cdata(o[key]);
}

/**
 * 外部联系人 userid 常见前缀（仅启发式）
 */
function looksLikeExternalUserId(s) {
  if (!s || typeof s !== 'string') return false;
  return /^wm|^wo/i.test(s.trim()) || s.trim().length >= 18;
}

/**
 * @param {number} tenantId
 */
async function loadStaffWeworkSet(tenantId) {
  const rows = await User.findAll({
    where: {
      tenant_id: tenantId,
      status: 1,
      wework_userid: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    attributes: ['wework_userid'],
  });
  return new Set(rows.map((r) => String(r.wework_userid).trim()).filter(Boolean));
}

function qOne(query, key) {
  const v = query[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * @param {Record<string, string | string[] | undefined>} query
 */
export async function resolveTenantFromQuery(query) {
  const rawTid = qOne(query, 'tenant_id') ?? qOne(query, 'tenantId');
  if (rawTid != null && rawTid !== '') {
    const tid = Number(rawTid);
    if (Number.isInteger(tid) && tid > 0) {
      return Tenant.findByPk(tid);
    }
  }
  const corp = qOne(query, 'corp_id') ?? qOne(query, 'corpid') ?? qOne(query, 'corpId');
  if (corp) {
    return Tenant.findOne({ where: { wework_corp_id: String(corp) } });
  }
  return null;
}

/**
 * @param {any} tenant Sequelize Tenant
 * @param {string} innerXml 解密后的明文 XML
 */
export async function persistInboundXml(tenant, innerXml) {
  const trimmed = innerXml?.trim();
  if (!trimmed) return { stored: false, reason: 'empty' };

  /** @type {Record<string, unknown>} */
  let root;
  try {
    root = await parseStringPromise(trimmed, {
      trim: true,
      explicitArray: false,
      explicitRoot: false,
    });
  } catch {
    return { stored: false, reason: 'xml_parse' };
  }

  const msgType = (pick(root, 'MsgType').toLowerCase() || 'unknown').slice(0, 32);
  const from = pick(root, 'FromUserName');
  const to = pick(root, 'ToUserName');
  const agentId = pick(root, 'AgentID') || pick(root, 'AgentId');
  const createTimeSec = Number(pick(root, 'CreateTime')) || 0;
  const msgTime = createTimeSec > 0 ? new Date(createTimeSec * 1000) : new Date();

  let msgId = pick(root, 'MsgId');
  const contentText =
    msgType === 'text'
      ? pick(root, 'Content')
      : msgType === 'event'
        ? `[event] ${pick(root, 'Event')}${pick(root, 'ChangeType') ? `/${pick(root, 'ChangeType')}` : ''}`
        : `[${msgType}]`;

  const eventKey = msgType === 'event' ? pick(root, 'Event') : '';
  if (!msgId) {
    msgId = `evt:${createTimeSec}:${from}:${to}:${msgType}:${eventKey || agentId || 'na'}`;
  }
  msgId = String(msgId);
  if (msgId.length > 64) {
    msgId = crypto.createHash('sha256').update(msgId).digest('hex').slice(0, 64);
  }

  const staffSet = await loadStaffWeworkSet(tenant.id);

  let externalUserid = null;
  let staffUserid = null;
  let direction = 'customer';

  if (staffSet.has(from)) {
    staffUserid = from;
    externalUserid = looksLikeExternalUserId(to) ? to : null;
    direction = 'staff';
  } else if (staffSet.has(to)) {
    staffUserid = to;
    externalUserid = looksLikeExternalUserId(from) ? from : null;
    direction = 'customer';
  } else if (looksLikeExternalUserId(from)) {
    externalUserid = from;
    direction = 'customer';
    staffUserid = looksLikeExternalUserId(to) ? null : to || null;
  } else if (looksLikeExternalUserId(to)) {
    externalUserid = to;
    direction = 'staff';
    staffUserid = from || null;
  }

  let customerId = null;
  if (externalUserid) {
    const c = await Customer.findOne({
      where: { tenant_id: tenant.id, external_userid: externalUserid },
    });
    if (c) customerId = c.id;
  }

  const rawStore = trimmed.length > RAW_XML_MAX ? `${trimmed.slice(0, RAW_XML_MAX)}…` : trimmed;

  try {
    await WeworkCustomerMessage.create({
      tenant_id: tenant.id,
      customer_id: customerId,
      msg_id: msgId,
      external_userid: externalUserid,
      staff_userid: staffUserid,
      direction,
      msg_type: msgType,
      content: contentText || null,
      raw_plain_xml: rawStore,
      msg_time: msgTime,
    });
    setImmediate(() => {
      upsertFromWeworkMessage({
        tenant_id: tenant.id,
        customer_id: customerId,
        external_userid: externalUserid,
        staff_userid: staffUserid,
        direction,
        msg_type: msgType,
        content: contentText || null,
        msg_id: msgId,
        msg_time: msgTime,
      }).catch((e) => console.error('[inbox] upsertFromWeworkMessage', e));
    });
    if (customerId && env.scoreOnWeworkMessage) {
      queueIntentScore(tenant.id, customerId);
    }

    if (msgType === 'event') {
      const eventName = pick(root, 'Event');
      const changeType = pick(root, 'ChangeType');
      if (eventName === 'change_external_contact' && changeType === 'add_external_contact') {
        const state = pick(root, 'State') || null;
        const extAdd = pick(root, 'ExternalUserID') || pick(root, 'ExternalUserId') || '';
        const followUid = pick(root, 'UserID') || pick(root, 'UserId') || '';
        if (extAdd) {
          setImmediate(() => {
            recordCustomerAdd({
              tenantId: tenant.id,
              state: state || null,
              external_userid: extAdd,
              follow_userid: followUid || null,
              raw: root,
            }).catch((e) => console.error('[wework] recordCustomerAdd', e));
          });
        }
      }
    }

    return { stored: true, customer_id: customerId };
  } catch (e) {
    if (e?.name === 'SequelizeUniqueConstraintError') {
      return { stored: false, reason: 'duplicate' };
    }
    throw e;
  }
}
