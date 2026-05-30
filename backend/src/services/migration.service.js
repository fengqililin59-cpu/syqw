/**
 * @file 个人微信客户迁移：活动、名单、企微回调闭环。
 */
import Joi from 'joi';
import XLSX from 'xlsx';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import {
  Tenant,
  User,
  Customer,
  Tag,
  CustomerTag,
  WeworkChannel,
  MigrationCampaign,
  MigrationRecord,
} from '../models/index.js';
import { generateCopywriting } from './aiContent.service.js';
import { sendExternalTextMessage } from './weworkMessage.service.js';

const MC_STATE_RE = /^mc_(\d+)_(\d+)$/;

export function buildMigrationContactState(campaignId, tenantId) {
  return `mc_${Number(campaignId)}_${Number(tenantId)}`;
}

/**
 * @param {string | null | undefined} state
 * @returns {{ campaignId: number; tenantId: number } | null}
 */
export function parseMigrationState(state) {
  if (!state || typeof state !== 'string') return null;
  const m = state.trim().match(MC_STATE_RE);
  if (!m) return null;
  return { campaignId: Number(m[1]), tenantId: Number(m[2]) };
}

function normalizePhone(p) {
  if (p == null) return '';
  return String(p).replace(/\D/g, '');
}

const createCampaignSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow('', null).max(5000).optional(),
  channel_live_code_id: Joi.number().integer().positive().allow(null).optional(),
  welcome_msg: Joi.string().allow('', null).max(8000).optional(),
  script_template: Joi.string().allow('', null).max(8000).optional(),
  target_count: Joi.number().integer().min(0).max(10_000_000).optional(),
  status: Joi.string().valid('draft', 'active', 'ended').optional(),
  starts_at: Joi.date().allow(null).optional(),
  ends_at: Joi.date().allow(null).optional(),
}).unknown(false);

const listCampaignsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(200).default(20),
  status: Joi.string().valid('draft', 'active', 'ended', '').allow(null).optional(),
}).unknown(false);

const listRecordsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(200).default(20),
  status: Joi.string().valid('pending', 'contacted', 'migrated', 'lost', '').allow(null).optional(),
}).unknown(false);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'contacted', 'migrated', 'lost').required(),
  note: Joi.string().allow('', null).max(5000).optional(),
}).unknown(false);

const importContactsSchema = Joi.object({
  contacts: Joi.alternatives()
    .try(
      Joi.array()
        .items(
          Joi.object({
            wx_nickname: Joi.string().allow('', null).max(50).optional(),
            wx_phone: Joi.string().allow('', null).max(20).optional(),
            wx_remark: Joi.string().allow('', null).max(100).optional(),
          }).unknown(false),
        )
        .max(5000),
      Joi.string().allow('', null),
    )
    .optional(),
}).unknown(true);

const updateCampaignSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().allow('', null).max(5000).optional(),
  channel_live_code_id: Joi.number().integer().positive().allow(null).optional(),
  welcome_msg: Joi.string().allow('', null).max(8000).optional(),
  script_template: Joi.string().allow('', null).max(8000).optional(),
  target_count: Joi.number().integer().min(0).max(10_000_000).optional(),
  status: Joi.string().valid('draft', 'active', 'ended').optional(),
  starts_at: Joi.date().allow(null).optional(),
  ends_at: Joi.date().allow(null).optional(),
})
  .unknown(false)
  .min(1);

async function ensureChannelBelongs(tenantId, channelId) {
  if (channelId == null) return;
  const ch = await WeworkChannel.findOne({
    where: { id: channelId, tenant_id: tenantId },
    attributes: ['id'],
  });
  if (!ch) throw new HttpError(400, '渠道活码不存在或不属于当前租户', 400);
}

/**
 * @param {{ tenantId: number; userId: number }} auth
 * @param {object} data
 */
export async function createCampaign(auth, data) {
  const { error, value } = createCampaignSchema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  await ensureChannelBelongs(auth.tenantId, value.channel_live_code_id ?? null);

  const row = await MigrationCampaign.create({
    tenant_id: auth.tenantId,
    name: value.name,
    description: value.description ?? null,
    channel_live_code_id: value.channel_live_code_id ?? null,
    welcome_msg: value.welcome_msg ?? null,
    script_template: value.script_template ?? null,
    target_count: value.target_count ?? 0,
    status: value.status ?? 'draft',
    starts_at: value.starts_at ?? null,
    ends_at: value.ends_at ?? null,
    created_by: auth.userId,
  });
  const plain = row.get({ plain: true });
  return {
    ...plain,
    suggested_contact_state: buildMigrationContactState(plain.id, auth.tenantId),
  };
}

/**
 * @param {{ tenantId: number }} auth
 * @param {number} campaignId
 * @param {object} body
 */
export async function updateCampaign(auth, campaignId, body) {
  const { error, value } = updateCampaignSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  if (value.channel_live_code_id !== undefined) {
    await ensureChannelBelongs(auth.tenantId, value.channel_live_code_id);
  }
  const row = await MigrationCampaign.findOne({ where: { id: campaignId, tenant_id: auth.tenantId } });
  if (!row) throw new HttpError(404, '迁移活动不存在', 404);
  await row.update(value);
  const plain = row.get({ plain: true });
  return {
    ...plain,
    suggested_contact_state: buildMigrationContactState(plain.id, auth.tenantId),
  };
}

/**
 * @param {number} tenantId
 * @param {object} query
 */
export async function listCampaigns(tenantId, query) {
  const { error, value } = listCampaignsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const where = { tenant_id: tenantId };
  if (value.status) where.status = value.status;
  const { rows, count } = await MigrationCampaign.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });
  return {
    list: rows.map((r) => r.get({ plain: true })),
    total: count,
    page: value.page,
    size: value.size,
  };
}

/**
 * @param {number} tenantId
 * @param {number} campaignId
 */
export async function getCampaignDetail(tenantId, campaignId) {
  const campaign = await MigrationCampaign.findOne({
    where: { id: campaignId, tenant_id: tenantId },
    include: [{ model: WeworkChannel, as: 'live_channel', attributes: ['id', 'name', 'state'], required: false }],
  });
  if (!campaign) throw new HttpError(404, '迁移活动不存在', 404);

  const baseWhere = { tenant_id: tenantId, campaign_id: campaignId };
  const [pending, contacted, migrated, lost, total] = await Promise.all([
    MigrationRecord.count({ where: { ...baseWhere, status: 'pending' } }),
    MigrationRecord.count({ where: { ...baseWhere, status: 'contacted' } }),
    MigrationRecord.count({ where: { ...baseWhere, status: 'migrated' } }),
    MigrationRecord.count({ where: { ...baseWhere, status: 'lost' } }),
    MigrationRecord.count({ where: baseWhere }),
  ]);

  const target = Math.max(0, Number(campaign.target_count) || 0);
  const rate =
    target > 0 ? Math.round((1000 * migrated) / target) / 10 : total > 0 ? Math.round((1000 * migrated) / total) / 10 : 0;

  const plain = campaign.get({ plain: true });
  return {
    campaign: {
      ...plain,
      suggested_contact_state: buildMigrationContactState(plain.id, tenantId),
    },
    funnel: { total, pending, contacted, migrated, lost, rate },
  };
}

/**
 * @param {number} tenantId
 * @param {number} campaignId
 * @param {number} ownerId
 * @param {Array<{ wx_nickname?: string; wx_phone?: string; wx_remark?: string }>} contacts
 */
export async function batchImportWxContacts(tenantId, campaignId, ownerId, contacts) {
  const campaign = await MigrationCampaign.findOne({ where: { id: campaignId, tenant_id: tenantId } });
  if (!campaign) throw new HttpError(404, '迁移活动不存在', 404);

  const owner = await User.findOne({
    where: { id: ownerId, tenant_id: tenantId, status: 1 },
    attributes: ['id'],
  });
  if (!owner) throw new HttpError(400, '负责人不存在', 400);

  // 仅对有手机号的记录做 (campaign, phone) 去重；wx_phone 为空的不参与去重，可多条导入
  const existingRows = await MigrationRecord.findAll({
    where: {
      tenant_id: tenantId,
      campaign_id: campaignId,
      wx_phone: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    attributes: ['wx_phone'],
  });
  const existingNorm = new Set();
  for (const r of existingRows) {
    const n = normalizePhone(r.wx_phone);
    if (n) existingNorm.add(n);
  }

  const seenPhonesInBatch = new Set();
  let imported = 0;
  /** 仅统计因手机号重复而跳过的行（不含 DB 失败） */
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < contacts.length; i += 1) {
    const c = contacts[i];
    const phoneStr = c.wx_phone != null ? String(c.wx_phone).trim() : '';
    const phoneNorm = normalizePhone(phoneStr);

    if (phoneNorm) {
      if (seenPhonesInBatch.has(phoneNorm)) {
        skipped += 1;
        errors.push({ row: i + 1, reason: '同批次手机号重复' });
        continue;
      }
      if (existingNorm.has(phoneNorm)) {
        skipped += 1;
        errors.push({ row: i + 1, reason: '活动内手机号已存在' });
        continue;
      }
      seenPhonesInBatch.add(phoneNorm);
      existingNorm.add(phoneNorm);
    }

    try {
      await MigrationRecord.create({
        tenant_id: tenantId,
        campaign_id: campaignId,
        owner_id: ownerId,
        wx_nickname: c.wx_nickname?.trim() || null,
        wx_phone: phoneStr || null,
        wx_remark: c.wx_remark?.trim() || null,
        status: 'pending',
      });
      imported += 1;
    } catch (e) {
      errors.push({ row: i + 1, reason: String(e?.message || e).slice(0, 200) });
    }
  }

  return { imported, skipped, errors };
}

/**
 * 从 Excel/CSV buffer 解析联系人（首行表头：昵称/手机/备注，列名模糊匹配）。
 * @param {Buffer} buf
 * @param {string} [originalname]
 */
export function parseMigrationImportBuffer(buf, originalname = '') {
  const isCsv = /\.csv$/i.test(originalname);
  const wb = isCsv ? XLSX.read(buf.toString('utf8'), { type: 'string' }) : XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.SheetNames[0];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
  if (!rows.length) return [];
  const header = rows[0].map((h) => normalizeHeaderCell(h));
  const nickIdx = findColumnIndex(header, ['昵称', 'nick', 'nickname', '微信昵称', '名称']);
  const phoneIdx = findColumnIndex(header, ['手机', '电话', 'phone', 'mobile', '手机号']);
  const remarkIdx = findColumnIndex(header, ['备注', 'remark', '说明']);

  const out = [];
  for (let r = 1; r < rows.length; r += 1) {
    const line = rows[r];
    if (!Array.isArray(line)) continue;
    const wx_nickname = nickIdx >= 0 ? String(line[nickIdx] ?? '').trim() : '';
    const wx_phone = phoneIdx >= 0 ? String(line[phoneIdx] ?? '').trim() : '';
    const wx_remark = remarkIdx >= 0 ? String(line[remarkIdx] ?? '').trim() : '';
    if (!wx_nickname && !wx_phone && !wx_remark) continue;
    out.push({ wx_nickname: wx_nickname || null, wx_phone: wx_phone || null, wx_remark: wx_remark || null });
  }
  return out;
}

function normalizeHeaderCell(v) {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function findColumnIndex(header, candidates) {
  for (let i = 0; i < header.length; i += 1) {
    const h = header[i];
    if (!h) continue;
    for (const c of candidates) {
      const n = c.replace(/\s+/g, '').toLowerCase();
      if (h === n || h.includes(n)) return i;
    }
  }
  return -1;
}

/**
 * @param {{ tenantId: number; userId: number }} auth
 * @param {number} campaignId
 * @param {object} body
 * @param {Buffer} [fileBuf]
 * @param {string} [originalname]
 */
export async function importContactsHandler(auth, campaignId, body, fileBuf, originalname) {
  let contacts = [];
  const { error, value } = importContactsSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  let rawContacts = value.contacts;
  if (typeof rawContacts === 'string' && rawContacts.trim()) {
    try {
      rawContacts = JSON.parse(rawContacts);
    } catch {
      rawContacts = [];
    }
  }
  if (Array.isArray(rawContacts) && rawContacts.length) contacts = rawContacts;
  if (fileBuf?.length) {
    const parsed = parseMigrationImportBuffer(fileBuf, originalname || '');
    contacts = contacts.concat(parsed);
  }
  if (!contacts.length) throw new HttpError(400, '请提供 contacts 数组或上传文件', 400);
  return batchImportWxContacts(auth.tenantId, campaignId, auth.userId, contacts);
}

/**
 * @param {number} tenantId
 * @param {number} campaignId
 * @param {object} query
 */
export async function listRecords(tenantId, campaignId, query) {
  const camp = await MigrationCampaign.findOne({ where: { id: campaignId, tenant_id: tenantId }, attributes: ['id'] });
  if (!camp) throw new HttpError(404, '迁移活动不存在', 404);

  const { error, value } = listRecordsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const where = { tenant_id: tenantId, campaign_id: campaignId };
  if (value.status) where.status = value.status;

  const { rows, count } = await MigrationRecord.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'real_name', 'wework_userid'], required: false }],
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });

  const list = rows.map((r) => {
    const p = r.get({ plain: true });
    return {
      id: p.id,
      wx_nickname: p.wx_nickname,
      wx_phone: p.wx_phone,
      wx_remark: p.wx_remark,
      status: p.status,
      contacted_at: p.contacted_at,
      migrated_at: p.migrated_at,
      external_userid: p.external_userid,
      customer_id: p.customer_id,
      note: p.note,
      created_at: p.created_at,
      owner: p.owner
        ? {
            id: p.owner.id,
            username: p.owner.username,
            real_name: p.owner.real_name,
            wework_userid: p.owner.wework_userid,
          }
        : null,
    };
  });

  return { list, total: count, page: value.page, size: value.size };
}

/**
 * @param {{ tenantId: number }} auth
 * @param {number} recordId
 * @param {object} body
 */
export async function updateRecordStatus(auth, recordId, body) {
  const { error, value } = updateStatusSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const rec = await MigrationRecord.findOne({
    where: { id: recordId, tenant_id: auth.tenantId },
  });
  if (!rec) throw new HttpError(404, '记录不存在', 404);

  const patch = { status: value.status };
  if (value.note !== undefined) patch.note = value.note || null;
  if (value.status === 'contacted' && rec.status !== 'contacted') {
    patch.contacted_at = new Date();
  }
  if (value.status === 'migrated' && rec.status !== 'migrated') {
    patch.migrated_at = new Date();
  }
  await rec.update(patch);
  return rec.get({ plain: true });
}

/**
 * @param {{ tenantId: number }} auth
 * @param {number} recordId
 */
export async function generateScript(auth, recordId) {
  const rec = await MigrationRecord.findOne({
    where: { id: recordId, tenant_id: auth.tenantId },
  });
  if (!rec) throw new HttpError(404, '记录不存在', 404);
  const campaign = await MigrationCampaign.findOne({
    where: { id: rec.campaign_id, tenant_id: auth.tenantId },
  });
  if (!campaign) throw new HttpError(404, '迁移活动不存在', 404);

  const template = campaign.script_template?.trim() || '';
  const basePrompt = `你是私域运营专家。
活动目标：邀请个人微信好友添加企业微信。
客户信息：昵称「${rec.wx_nickname || '未知'}」，备注「${rec.wx_remark || '无'}」。
话术要求：友好自然，突出加企微的好处（专属服务/福利/内容），100字以内。
只输出话术正文。`;
  const prompt = template ? `${template}\n\n${basePrompt}` : basePrompt;
  const text = await generateCopywriting(prompt, '私域迁移', auth.tenantId);
  return { text };
}

const MIGRATION_TAG_NAME = '已迁移';

async function ensureCustomerAndTag(tenantId, externalUserid, ownerId) {
  let customer = await Customer.findOne({ where: { tenant_id: tenantId, external_userid: externalUserid } });
  if (!customer) {
    customer = await Customer.create({
      tenant_id: tenantId,
      owner_id: ownerId,
      external_userid: externalUserid,
      source: 'migration',
      stage: 'new',
    });
  } else if (Number(customer.owner_id) !== Number(ownerId)) {
    await customer.update({ owner_id: ownerId });
  }

  const [tag] = await Tag.findOrCreate({
    where: { tenant_id: tenantId, name: MIGRATION_TAG_NAME },
    defaults: { color: '#22c55e', category: 'migration' },
  });
  const exists = await CustomerTag.findOne({ where: { customer_id: customer.id, tag_id: tag.id } });
  if (!exists) {
    await CustomerTag.create({ customer_id: customer.id, tag_id: tag.id });
  }
  return customer;
}

/**
 * 企微「联系我」获客回调：state 为 mc_{campaignId}_{tenantId} 时更新迁移记录并发欢迎语。
 * @param {number} tenantId
 * @param {string | null | undefined} externalUserid
 * @param {string | null | undefined} channelState
 * @param {string | null | undefined} followUserid 添加客户的成员企微 userid
 */
export async function onCustomerMigrated(tenantId, externalUserid, channelState, followUserid) {
  const state = channelState != null ? String(channelState).trim() : '';
  if (!state || !state.startsWith('mc_')) return { handled: false, reason: 'not_migration_state' };
  if (!externalUserid) return { handled: false, reason: 'not_migration_state' };

  let campaignId;
  let stateTenantId;
  try {
    const parts = state.split('_');
    campaignId = parseInt(parts[1], 10);
    stateTenantId = parseInt(parts[2], 10);
  } catch {
    return { handled: false, reason: 'not_migration_state' };
  }

  if (
    !Number.isFinite(campaignId) ||
    campaignId < 1 ||
    !Number.isFinite(stateTenantId) ||
    Number(stateTenantId) !== Number(tenantId)
  ) {
    return { handled: false, reason: 'tenant_mismatch' };
  }

  const campaign = await MigrationCampaign.findOne({
    where: { id: campaignId, tenant_id: tenantId, status: 'active' },
  });
  if (!campaign) return { handled: false, reason: 'campaign_inactive' };

  if (campaign.channel_live_code_id) {
    const ch = await WeworkChannel.findOne({
      where: { id: campaign.channel_live_code_id, tenant_id: tenantId },
      attributes: ['id', 'state'],
    });
    if (ch?.state && String(ch.state) !== String(channelState)) {
      return { handled: false, reason: 'state_channel_mismatch' };
    }
  }

  const owner = followUserid
    ? await User.findOne({
        where: { tenant_id: tenantId, wework_userid: String(followUserid).trim(), status: 1 },
        attributes: ['id', 'wework_userid'],
      })
    : null;
  if (!owner) return { handled: false, reason: 'owner_not_found' };

  const candidates = await MigrationRecord.findAll({
    where: {
      tenant_id: tenantId,
      campaign_id: campaign.id,
      owner_id: owner.id,
      status: { [Op.in]: ['pending', 'contacted'] },
      external_userid: null,
    },
    order: [['id', 'ASC']],
  });

  let rec = null;
  const cust = await Customer.findOne({
    where: { tenant_id: tenantId, external_userid: String(externalUserid).trim() },
    attributes: ['id', 'phone'],
  });
  if (cust?.phone) {
    const norm = normalizePhone(cust.phone);
    rec = candidates.find((x) => normalizePhone(x.wx_phone) === norm && norm);
  }
  if (!rec && candidates.length === 1) rec = candidates[0];
  if (!rec && candidates.length > 0) rec = candidates[0];
  if (!rec) return { handled: false, reason: 'no_matching_record' };

  if (rec.status === 'migrated' && rec.external_userid) {
    return { handled: true, reason: 'already_migrated' };
  }

  const customer = await ensureCustomerAndTag(tenantId, String(externalUserid).trim(), owner.id);

  await rec.update({
    status: 'migrated',
    migrated_at: new Date(),
    external_userid: String(externalUserid).trim(),
    customer_id: customer.id,
  });

  await MigrationCampaign.increment('migrated_count', { where: { id: campaign.id } });

  const tenant = await Tenant.findByPk(tenantId);
  const welcome = campaign.welcome_msg?.trim();
  if (tenant && welcome && owner.wework_userid) {
    await sendExternalTextMessage(tenant, {
      externalUserid: String(externalUserid).trim(),
      text: welcome,
      senderUserid: String(owner.wework_userid).trim(),
    });
  }

  return { handled: true, record_id: rec.id };
}
