/**
 * @file 渠道活码：分组 CRUD、员工活码创建（写库 + 调企微）。
 * @description 员工活码 = 企业微信「联系我」二维码：单人(type=1)/多人(type=2)分流，config_id 持久有效；
 *              后台可更新成员与备注而无需更换对外物料；state 回穿回调用于渠道归因。
 */
import crypto from 'crypto';
import Joi from 'joi';
import { HttpError } from '../utils/httpError.js';
import { Tenant, WeworkChannelGroup, WeworkChannel, WeworkCustomerAddRecord } from '../models/index.js';
import * as contactWay from './weworkContactWay.service.js';
import { processInviteFromContactState } from './campaign.service.js';
import * as migrationService from './migration.service.js';
import { ensureCustomerFromWeworkContactAdd } from './weworkContactAdd.service.js';

/**
 * 生成「联系我」渠道 state：租户可追溯片段 + 随机数，总长度 ≤30（与企微限制一致）
 */
function buildContactWayState(tenantId) {
  const tid = Number(tenantId).toString(36).padStart(4, '0').slice(-4);
  const rand = crypto.randomBytes(12).toString('hex').slice(0, 22);
  const s = `t${tid}x${rand}`;
  return s.slice(0, contactWay.CONTACT_WAY_STATE_MAX_LEN);
}

const groupCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(64).required(),
  sort: Joi.number().integer().min(0).optional(),
}).unknown(false);

const groupUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(64).optional(),
  sort: Joi.number().integer().min(0).optional(),
}).unknown(false);

const employeeChannelSchema = Joi.object({
  name: Joi.string().trim().min(1).max(128).required(),
  group_id: Joi.number().integer().positive().allow(null).optional(),
  user: Joi.array().items(Joi.string().trim().min(1).max(64)).min(1).max(100).required(),
  remark: Joi.string().allow('', null).max(200).optional(),
  skip_verify: Joi.boolean().optional(),
  style: Joi.number().integer().min(1).max(4).optional(),
}).unknown(false);

const channelUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(128).optional(),
  group_id: Joi.number().integer().positive().allow(null).optional(),
  user: Joi.array().items(Joi.string().trim().min(1).max(64)).min(1).max(100).optional(),
  remark: Joi.string().allow('', null).max(200).optional(),
  skip_verify: Joi.boolean().optional(),
  style: Joi.number().integer().min(1).max(4).optional(),
}).unknown(false);

export async function listGroups(auth) {
  const rows = await WeworkChannelGroup.findAll({
    where: { tenant_id: auth.tenantId },
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map((r) => r.get({ plain: true }));
}

export async function createGroup(auth, body) {
  const { error, value } = groupCreateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await WeworkChannelGroup.create({
    tenant_id: auth.tenantId,
    name: value.name,
    sort: value.sort ?? 0,
  });
  return row.get({ plain: true });
}

export async function updateGroup(auth, id, body) {
  const { error, value } = groupUpdateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await WeworkChannelGroup.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '分组不存在', 404);
  }
  if (value.name !== undefined) row.name = value.name;
  if (value.sort !== undefined) row.sort = value.sort;
  await row.save();
  return row.get({ plain: true });
}

export async function deleteGroup(auth, id) {
  const row = await WeworkChannelGroup.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '分组不存在', 404);
  }
  await row.destroy();
  return { id: Number(id) };
}

export async function listChannels(auth) {
  const rows = await WeworkChannel.findAll({
    where: { tenant_id: auth.tenantId },
    include: [{ model: WeworkChannelGroup, as: 'group', attributes: ['id', 'name'], required: false }],
    order: [['id', 'DESC']],
  });
  return rows.map((r) => r.get({ plain: true }));
}

/**
 * 创建员工活码（多人自动为 type=2）
 */
export async function createEmployeeChannel(auth, body) {
  const { error, value } = employeeChannelSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const tenant = await Tenant.findByPk(auth.tenantId);
  if (!tenant?.wework_corp_id || !tenant.wework_secret) {
    throw new HttpError(400, '请先在系统设置中配置企业微信 CorpID 与 Secret', 400);
  }

  if (value.group_id != null) {
    const g = await WeworkChannelGroup.findOne({
      where: { id: value.group_id, tenant_id: auth.tenantId },
    });
    if (!g) {
      throw new HttpError(400, '分组不存在', 400);
    }
  }

  const state = buildContactWayState(auth.tenantId);

  const wxRes = await contactWay.addContactWay(tenant, {
    user: value.user,
    state,
    remark: value.remark ?? '',
    skip_verify: value.skip_verify !== false,
    style: value.style ?? 1,
  });

  if (wxRes.errcode !== 0) {
    throw new HttpError(400, wxRes.errmsg || `企微接口失败 (${wxRes.errcode})`, 400);
  }

  const row = await WeworkChannel.create({
    tenant_id: auth.tenantId,
    group_id: value.group_id ?? null,
    name: value.name,
    type: 'employee',
    state,
    wework_config_id: wxRes.config_id ?? null,
    config: {
      ...wxRes,
      user: value.user,
      remark: value.remark ?? '',
    },
  });

  return row.get({ plain: true });
}

export async function updateEmployeeChannel(auth, id, body) {
  const { error, value } = channelUpdateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const row = await WeworkChannel.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '活码不存在', 404);
  }
  if (row.type !== 'employee') {
    throw new HttpError(400, '当前仅支持更新员工活码', 400);
  }
  if (!row.wework_config_id) {
    throw new HttpError(400, '缺少企微 config_id，无法更新', 400);
  }

  const tenant = await Tenant.findByPk(auth.tenantId);
  if (!tenant?.wework_corp_id || !tenant.wework_secret) {
    throw new HttpError(400, '请先在系统设置中配置企业微信', 400);
  }

  const prev = row.config && typeof row.config === 'object' ? row.config : {};
  const userList = value.user ?? prev.user;
  if (!userList?.length) {
    throw new HttpError(400, '无法推断成员列表，请传入 user', 400);
  }
  const needWx =
    value.user ||
    value.remark !== undefined ||
    value.skip_verify !== undefined ||
    value.style !== undefined;
  if (needWx) {
    const wxPayload = {
      config_id: row.wework_config_id,
      user: userList,
      remark: value.remark !== undefined ? value.remark ?? '' : (prev.remark ?? ''),
      skip_verify: value.skip_verify !== undefined ? value.skip_verify : prev.skip_verify !== false,
      style: value.style !== undefined ? value.style : (prev.style ?? 1),
    };
    const wxRes = await contactWay.updateContactWay(tenant, wxPayload);
    if (wxRes.errcode !== 0) {
      throw new HttpError(400, wxRes.errmsg || `企微更新失败 (${wxRes.errcode})`, 400);
    }
  }

  if (value.name !== undefined) row.name = value.name;
  if (value.group_id !== undefined) {
    if (value.group_id != null) {
      const g = await WeworkChannelGroup.findOne({
        where: { id: value.group_id, tenant_id: auth.tenantId },
      });
      if (!g) {
        throw new HttpError(400, '分组不存在', 400);
      }
    }
    row.group_id = value.group_id;
  }

  const prevConfig = row.config && typeof row.config === 'object' ? row.config : {};
  row.config = {
    ...prevConfig,
    user: userList,
    remark: value.remark !== undefined ? value.remark : prevConfig.remark,
    skip_verify: value.skip_verify !== undefined ? value.skip_verify : prevConfig.skip_verify,
    style: value.style !== undefined ? value.style : prevConfig.style,
  };

  await row.save();
  return row.get({ plain: true });
}

export async function deleteChannel(auth, id) {
  const row = await WeworkChannel.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '活码不存在', 404);
  }
  await row.destroy();
  return { id: Number(id) };
}

/**
 * 供后续回调使用：按 state 解析 channel_id 并写入记录
 * @param {{ tenantId: number; state?: string | null; external_userid?: string; follow_userid?: string; raw?: object }} payload
 */
export async function recordCustomerAdd(payload) {
  const { tenantId, state, external_userid, follow_userid, raw } = payload;
  let channelId = null;
  if (state) {
    const ch = await WeworkChannel.findOne({
      where: { tenant_id: tenantId, state: String(state) },
      attributes: ['id'],
    });
    channelId = ch?.id ?? null;
  }
  const rec = await WeworkCustomerAddRecord.create({
    tenant_id: tenantId,
    channel_id: channelId,
    external_userid: external_userid ?? null,
    follow_userid: follow_userid ?? null,
    state: state ?? null,
    raw_payload: raw ?? null,
  });
  try {
    await processInviteFromContactState({
      tenantId,
      inviteCode: state,
      externalUserid: external_userid,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[campaign] processInviteFromContactState', e);
  }
  migrationService
    .onCustomerMigrated(tenantId, external_userid, state, follow_userid)
    .catch((e) => console.error('[migration] onCustomerMigrated', e));

  try {
    await ensureCustomerFromWeworkContactAdd({
      tenantId,
      external_userid,
      follow_userid,
      state,
      channelId,
    });
  } catch (e) {
    console.error('[wework] ensureCustomerFromWeworkContactAdd', e);
  }

  return rec.get({ plain: true });
}
