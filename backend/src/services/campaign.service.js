/**
 * @file 裂变活动：活动 CRUD、报名发码、邀请计数、企微 state 回传匹配、统计。
 */
import { randomBytes } from 'crypto';
import Joi from 'joi';
import { sequelize, Campaign, CampaignEnrollment, InviteRecord, Customer } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';
import { paginated } from '../utils/response.js';
import { enqueueCampaignRewardJob } from './campaignRewardJob.service.js';

const TYPES = ['task_treasure', 'group_share', 'red_packet'];
const REWARD_TYPES = ['points', 'coupon', 'redpacket', 'exchange_code'];
const STATUSES = ['draft', 'active', 'paused', 'ended'];

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string()
    .valid(...TYPES)
    .default('task_treasure'),
  target_count: Joi.number().integer().min(1).max(1000).required(),
  reward_type: Joi.string()
    .valid(...REWARD_TYPES)
    .required(),
  reward_value: Joi.alternatives().try(Joi.string().min(1), Joi.object()).required(),
  start_time: Joi.date().required(),
  end_time: Joi.date().required(),
}).unknown(false);

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  type: Joi.string()
    .valid(...TYPES)
    .optional(),
  target_count: Joi.number().integer().min(1).max(1000).optional(),
  reward_type: Joi.string()
    .valid(...REWARD_TYPES)
    .optional(),
  reward_value: Joi.alternatives().try(Joi.string().min(1), Joi.object()).optional(),
  start_time: Joi.date().optional(),
  end_time: Joi.date().optional(),
  status: Joi.string()
    .valid(...STATUSES)
    .optional(),
}).unknown(false);

function serializeRewardValue(value) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function parseRewardValue(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { description: text };
  }
}

export function generateInviteCode() {
  return `i${randomBytes(6).toString('hex')}`;
}

function rewardDelayHours(campaign) {
  const cfg = parseRewardValue(campaign.reward_value);
  const v = Number(cfg.delay_hours ?? cfg.delayHours ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(24 * 30, Math.floor(v));
}

async function enqueueRewardMilestone({ campaign, enrollment, inviter, milestoneIndex, transaction }) {
  const delayH = rewardDelayHours(campaign);
  const scheduledAt = delayH > 0 ? new Date(Date.now() + delayH * 3600 * 1000) : null;
  try {
    await enqueueCampaignRewardJob(
      {
        tenant_id: inviter.tenant_id,
        campaign_id: campaign.id,
        customer_id: inviter.id,
        enrollment_id: enrollment.id,
        milestone_index: milestoneIndex,
        reward_type: campaign.reward_type,
        reward_payload: parseRewardValue(campaign.reward_value),
      },
      { scheduledAt, transaction },
    );
  } catch (e) {
    if (e?.name !== 'SequelizeUniqueConstraintError') throw e;
  }
}

function campaignOpen(campaign) {
  const now = Date.now();
  const start = new Date(campaign.start_time).getTime();
  const end = new Date(campaign.end_time).getTime();
  return campaign.status === 'active' && now >= start && now <= end;
}

async function getCampaignScoped(auth, id) {
  const row = await Campaign.findOne({
    where: { id, tenant_id: auth.tenantId },
  });
  if (!row) {
    throw new HttpError(404, '活动不存在', 404);
  }
  return row;
}

export async function listCampaigns(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: auth.tenantId };
  if (query.status && STATUSES.includes(String(query.status))) {
    where.status = String(query.status);
  }
  const { rows, count } = await Campaign.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['created_at', 'DESC']],
  });
  return paginated(
    rows.map((r) => {
      const p = r.get({ plain: true });
      return { ...p, reward_value: parseRewardValue(p.reward_value) };
    }),
    count,
    page,
    size,
  );
}

export async function createCampaign(auth, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  if (new Date(value.end_time) <= new Date(value.start_time)) {
    throw new HttpError(400, '结束时间须晚于开始时间', 400);
  }
  const row = await Campaign.create({
    tenant_id: auth.tenantId,
    name: value.name,
    type: value.type,
    target_count: value.target_count,
    reward_type: value.reward_type,
    reward_value: serializeRewardValue(value.reward_value),
    start_time: value.start_time,
    end_time: value.end_time,
    status: 'draft',
  });
  const p = row.get({ plain: true });
  return { ...p, reward_value: parseRewardValue(p.reward_value) };
}

export async function updateCampaign(auth, id, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const { error, value } = updateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await getCampaignScoped(auth, id);
  if (value.reward_value != null) {
    value.reward_value = serializeRewardValue(value.reward_value);
  }
  if (value.start_time != null || value.end_time != null) {
    const st = value.start_time ?? row.start_time;
    const et = value.end_time ?? row.end_time;
    if (new Date(et) <= new Date(st)) {
      throw new HttpError(400, '结束时间须晚于开始时间', 400);
    }
  }
  await row.update(value);
  const p = row.get({ plain: true });
  return { ...p, reward_value: parseRewardValue(p.reward_value) };
}

export async function getCampaign(auth, id) {
  const row = await getCampaignScoped(auth, id);
  const p = row.get({ plain: true });
  return { ...p, reward_value: parseRewardValue(p.reward_value) };
}

export async function startCampaign(auth, id) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const row = await getCampaignScoped(auth, id);
  if (row.status === 'ended') {
    throw new HttpError(400, '已结束的活动不可启动', 400);
  }
  await row.update({ status: 'active' });
  const p = row.get({ plain: true });
  return { ...p, reward_value: parseRewardValue(p.reward_value) };
}

export async function pauseCampaign(auth, id) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const row = await getCampaignScoped(auth, id);
  await row.update({ status: 'paused' });
  const p = row.get({ plain: true });
  return { ...p, reward_value: parseRewardValue(p.reward_value) };
}

export async function endCampaign(auth, id) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const row = await getCampaignScoped(auth, id);
  await row.update({ status: 'ended' });
  const p = row.get({ plain: true });
  return { ...p, reward_value: parseRewardValue(p.reward_value) };
}

export async function duplicateCampaign(auth, id) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const src = await getCampaignScoped(auth, id);
  const p = src.get({ plain: true });
  const row = await Campaign.create({
    tenant_id: auth.tenantId,
    name: `${p.name}（副本）`,
    type: p.type,
    target_count: p.target_count,
    reward_type: p.reward_type,
    reward_value: p.reward_value,
    start_time: p.start_time,
    end_time: p.end_time,
    status: 'draft',
  });
  const out = row.get({ plain: true });
  return { ...out, reward_value: parseRewardValue(out.reward_value) };
}

export async function getCampaignStats(auth, id) {
  await getCampaignScoped(auth, id);
  const enrollments = await CampaignEnrollment.count({ where: { campaign_id: id } });
  const achieved = await CampaignEnrollment.count({
    where: { campaign_id: id, is_achieved: true },
  });
  const totalInvites = await InviteRecord.count({ where: { campaign_id: id } });
  const avgInvite = enrollments > 0 ? totalInvites / enrollments : 0;

  const recent = await InviteRecord.findAll({
    where: { campaign_id: id },
    include: [
      { model: Customer, as: 'inviter', attributes: ['id', 'name', 'nickname', 'external_userid'] },
      { model: Customer, as: 'invitee', attributes: ['id', 'name', 'nickname', 'external_userid'] },
    ],
    order: [['created_at', 'DESC']],
    limit: 50,
  });

  return {
    enrollment_count: enrollments,
    achieved_count: achieved,
    total_invite_count: totalInvites,
    avg_invite_per_participant: Math.round(avgInvite * 100) / 100,
    recent_invites: recent.map((r) => {
      const x = r.get({ plain: true });
      return {
        id: x.id,
        created_at: x.created_at,
        inviter: x.inviter,
        invitee: x.invitee,
        invitee_external_userid: x.invitee_external_userid,
      };
    }),
  };
}

export async function enrollCampaign(auth, campaignId, body) {
  const schema = Joi.object({
    customer_id: Joi.number().integer().positive().required(),
  }).unknown(false);
  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const campaign = await getCampaignScoped(auth, campaignId);
  if (!campaignOpen(campaign)) {
    throw new HttpError(400, '活动未在进行中或已过期', 400);
  }

  const cust = await Customer.findOne({
    where: {
      id: value.customer_id,
      ...customerWhereScope(auth),
    },
  });
  if (!cust) {
    throw new HttpError(404, '客户不存在或无权操作', 404);
  }

  let enrollment = await CampaignEnrollment.findOne({
    where: { campaign_id: campaignId, customer_id: value.customer_id },
  });
  if (!enrollment) {
    let code = generateInviteCode();
    for (let i = 0; i < 5; i += 1) {
      try {
        enrollment = await CampaignEnrollment.create({
          campaign_id: Number(campaignId),
          customer_id: value.customer_id,
          invite_code: code,
        });
        break;
      } catch (e) {
        if (e?.name === 'SequelizeUniqueConstraintError') {
          code = generateInviteCode();
        } else {
          throw e;
        }
      }
    }
    if (!enrollment) {
      throw new HttpError(500, '生成邀请码失败', 500);
    }
  }

  const p = enrollment.get({ plain: true });
  const compositeState = `inv_${p.id}_${campaignId}`;
  return {
    ...p,
    poster_url: null,
    contact_way_state_hint:
      '创建「联系我」渠道活码时，将 state 设为邀请码或复合 state（inv_报名ID_活动ID），≤30 字符时优先短码。',
    contact_way_state: {
      invite_code: p.invite_code,
      composite: compositeState,
    },
  };
}

/**
 * 解析获客联系我上的 state：支持 invite_code（i 前缀）或 inv_{enrollmentId}_{campaignId}。
 * @param {string | null | undefined} raw
 */
async function findEnrollmentByContactState(raw) {
  const code = String(raw ?? '').trim();
  if (!code) {
    return null;
  }
  const invMatch = /^inv_(\d+)_(\d+)$/.exec(code);
  if (invMatch) {
    const enrollmentId = Number(invMatch[1]);
    const campaignId = Number(invMatch[2]);
    const enrollment = await CampaignEnrollment.findByPk(enrollmentId, {
      include: [{ model: Campaign, required: true }],
    });
    if (!enrollment || Number(enrollment.campaign_id) !== campaignId) {
      return null;
    }
    return enrollment;
  }
  if (!code.startsWith('i') || code.length > 32) {
    return null;
  }
  return CampaignEnrollment.findOne({
    where: { invite_code: code },
    include: [{ model: Campaign, required: true }],
  });
}

/**
 * 查询某客户在活动下的报名信息（后台侧传入 customer_id）。
 */
export async function getCampaignEnrollmentForCustomer(auth, campaignId, query) {
  const schema = Joi.object({
    customer_id: Joi.number().integer().positive().required(),
  }).unknown(false);
  const { error, value } = schema.validate(query, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  await getCampaignScoped(auth, campaignId);
  const enrollment = await CampaignEnrollment.findOne({
    where: { campaign_id: campaignId, customer_id: value.customer_id },
    include: [{ model: Customer, attributes: ['id', 'name', 'nickname', 'external_userid'] }],
  });
  if (!enrollment) {
    return null;
  }
  const p = enrollment.get({ plain: true });
  return {
    ...p,
    contact_way_state: {
      invite_code: p.invite_code,
      composite: `inv_${p.id}_${campaignId}`,
    },
  };
}

/**
 * 与文档命名一致：等价于 enroll（生成邀请码）。
 */
export async function generateInviteCodeAlias(auth, campaignId, body) {
  return enrollCampaign(auth, campaignId, body);
}

/**
 * 企微获客回调：根据联系我 state（invite_code 或 inv_*）与新客户 external_userid 记一笔邀请。
 * @param {{ tenantId: number; inviteCode: string | null | undefined; externalUserid: string | null | undefined }} payload
 * @returns {Promise<{ recorded: boolean; reason?: string }>}
 */
export async function processInviteFromContactState(payload) {
  const { tenantId, inviteCode, externalUserid } = payload;
  if (!inviteCode || !externalUserid) {
    return { recorded: false, reason: 'missing_state_or_external_userid' };
  }

  const enrollment = await findEnrollmentByContactState(inviteCode);
  if (!enrollment || !enrollment.Campaign) {
    return { recorded: false, reason: 'unknown_invite_state' };
  }

  const campaign = enrollment.Campaign;
  if (Number(campaign.tenant_id) !== Number(tenantId)) {
    return { recorded: false, reason: 'tenant_mismatch' };
  }
  if (!campaignOpen(campaign)) {
    return { recorded: false, reason: 'campaign_closed' };
  }

  const inviterId = enrollment.customer_id;
  const inviter = await Customer.findOne({
    where: { id: inviterId, tenant_id: tenantId },
  });
  if (!inviter) {
    return { recorded: false, reason: 'inviter_not_found' };
  }

  let invitee = await Customer.findOne({
    where: { tenant_id: tenantId, external_userid: externalUserid },
  });

  if (!invitee) {
    invitee = await Customer.create({
      tenant_id: tenantId,
      owner_id: inviter.owner_id,
      external_userid: externalUserid,
      source: 'campaign_invite',
      stage: 'new',
    });
  }

  if (Number(invitee.id) === Number(inviterId)) {
    return { recorded: false, reason: 'self_invite' };
  }

  const t = await sequelize.transaction();
  try {
    const existing = await InviteRecord.findOne({
      where: { campaign_id: campaign.id, invitee_id: invitee.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing) {
      await t.commit();
      return { recorded: false, reason: 'already_invited' };
    }

    await InviteRecord.create(
      {
        campaign_id: campaign.id,
        inviter_id: inviterId,
        invitee_id: invitee.id,
        invitee_external_userid: externalUserid,
      },
      { transaction: t },
    );

    await enrollment.increment('invited_count', { by: 1, transaction: t });
    await enrollment.reload({ transaction: t, lock: t.LOCK.UPDATE });

    const target = Math.max(1, Number(campaign.target_count) || 1);
    const achieved = Math.floor(Number(enrollment.invited_count || 0) / target);
    const alreadyQueued = Number(enrollment.achieved_milestone_count || 0);
    if (achieved > alreadyQueued) {
      const campaignPlain = campaign.get({ plain: true });
      for (let i = alreadyQueued + 1; i <= achieved; i += 1) {
        await enqueueRewardMilestone({
          campaign: campaignPlain,
          enrollment,
          inviter,
          milestoneIndex: i,
          transaction: t,
        });
      }
      await enrollment.update(
        {
          achieved_milestone_count: achieved,
          is_achieved: achieved > 0,
        },
        { transaction: t },
      );
    }

    await t.commit();
    return { recorded: true };
  } catch (err) {
    await t.rollback();
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return { recorded: false, reason: 'duplicate_invitee' };
    }
    throw err;
  }
}

const simulateSchema = Joi.object({
  invite_code: Joi.string().trim().min(3).max(32).required(),
  invitee_customer_id: Joi.number().integer().positive().required(),
}).unknown(false);

/** 联调用：用已有客户模拟受邀（需填写 external_userid 或允许无） */
export async function simulateInvite(auth, campaignId, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const { error, value } = simulateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  await getCampaignScoped(auth, campaignId);

  const invitee = await Customer.findOne({
    where: { id: value.invitee_customer_id, tenant_id: auth.tenantId },
  });
  if (!invitee) {
    throw new HttpError(404, '受邀客户不存在', 404);
  }
  const externalUserid =
    invitee.external_userid || `simulate_${invitee.id}_${Date.now()}`.slice(0, 64);
  if (!invitee.external_userid) {
    await invitee.update({ external_userid: externalUserid });
  }

  const result = await processInviteFromContactState({
    tenantId: auth.tenantId,
    inviteCode: value.invite_code,
    externalUserid: invitee.external_userid,
  });
  return result;
}
