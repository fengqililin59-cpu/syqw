/**
 * @file 客户服务：客户 CRUD、标签、转移、Excel 导入导出、跟进记录；查询带租户 + 销售数据范围。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { HttpError } from '../utils/httpError.js';
import { AuditLog, Customer, CustomerFollowUp, CustomerTag, Tag, User, WeworkCustomerMessage } from '../models/index.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';
import { attachDiscoveryMeta } from '../utils/discoveryProfile.util.js';
import { attachOrderStatsToCustomers } from './orderRevenue.service.js';
import { dispatchNewCustomerFlows, dispatchStageChangedFlows } from './flowEngine.service.js';
import { syncInboxThreadsFromCustomerStage } from './salesStageSync.service.js';
import { writeAuditLog } from './auditLog.service.js';
import * as billingService from './billing.service.js';

const discoveryProfileSchema = Joi.object({
  budget: Joi.string().trim().max(100).allow('', null).optional(),
  decision_timeline: Joi.string().trim().max(100).allow('', null).optional(),
  pain_points: Joi.string().trim().max(2000).allow('', null).optional(),
  product_interest: Joi.string().trim().max(500).allow('', null).optional(),
  decision_maker: Joi.string().trim().max(100).allow('', null).optional(),
  next_step: Joi.string().trim().max(500).allow('', null).optional(),
}).optional().allow(null);

const followTypes = ['call', 'wechat', 'meeting', 'other'];
/** 新线索 → 意向确认 → 方案报价 → 商务谈判 → 成交 → 流失（兼容旧值 contacted/intent） */
const stages = ['new', 'intent_confirm', 'proposal', 'negotiation', 'deal', 'lost'];
const stageValues = [...stages, 'contacted', 'intent'];

function normalizeStage(s) {
  const v = String(s || '').trim();
  if (v === 'contacted' || v === 'intent') return 'intent_confirm';
  return v || 'new';
}

const createCustomerSchema = Joi.object({
  owner_id: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().max(50).allow('', null).optional(),
  nickname: Joi.string().trim().max(50).allow('', null).optional(),
  phone: Joi.string().trim().max(20).allow('', null).optional(),
  company: Joi.string().trim().max(100).allow('', null).optional(),
  position: Joi.string().trim().max(50).allow('', null).optional(),
  source: Joi.string().trim().max(50).allow('', null).optional(),
  stage: Joi.string()
    .valid(...stageValues)
    .optional(),
  intention_level: Joi.number().integer().min(1).max(5).allow(null).optional(),
  remark: Joi.string().allow('', null).optional(),
  gender: Joi.number().integer().min(0).max(2).optional(),
  wechat_id: Joi.string().trim().max(50).allow('', null).optional(),
  external_userid: Joi.string().trim().max(64).allow('', null).optional(),
  added_at: Joi.date().allow(null).optional(),
  opt_out_auto_msg: Joi.boolean().optional(),
  discovery_profile: discoveryProfileSchema,
}).unknown(false);

const updateCustomerSchema = Joi.object({
  owner_id: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().max(50).allow('', null).optional(),
  nickname: Joi.string().trim().max(50).allow('', null).optional(),
  phone: Joi.string().trim().max(20).allow('', null).optional(),
  company: Joi.string().trim().max(100).allow('', null).optional(),
  position: Joi.string().trim().max(50).allow('', null).optional(),
  source: Joi.string().trim().max(50).allow('', null).optional(),
  stage: Joi.string()
    .valid(...stageValues)
    .optional(),
  intention_level: Joi.number().integer().min(1).max(5).allow(null).optional(),
  remark: Joi.string().allow('', null).optional(),
  gender: Joi.number().integer().min(0).max(2).optional(),
  wechat_id: Joi.string().trim().max(50).allow('', null).optional(),
  external_userid: Joi.string().trim().max(64).allow('', null).optional(),
  added_at: Joi.date().allow(null).optional(),
  opt_out_auto_msg: Joi.boolean().optional(),
  discovery_profile: discoveryProfileSchema,
}).unknown(false);

const createFollowUpSchema = Joi.object({
  type: Joi.string()
    .valid(...followTypes)
    .default('other'),
  content: Joi.string().trim().min(1).required(),
  next_follow_at: Joi.date().allow(null).optional(),
}).unknown(false);

const transferSchema = Joi.object({
  to_user_id: Joi.number().integer().positive().required(),
}).unknown(false);

const setTagsSchema = Joi.object({
  tag_ids: Joi.array().items(Joi.number().integer().positive()).required(),
}).unknown(false);

const importSchema = Joi.object({
  file_base64: Joi.string().min(1).required(),
}).unknown(false);

const tagIncludeBase = {
  model: Tag,
  as: 'tags',
  attributes: ['id', 'name', 'color', 'category'],
  through: { attributes: [] },
};

async function assertUserInTenant(tenantId, userId) {
  const u = await User.findOne({ where: { id: userId, tenant_id: tenantId, status: 1 } });
  if (!u) {
    throw new HttpError(400, '归属员工无效或不属于本企业', 400);
  }
}

function buildListWhere(auth, query) {
  const where = { ...customerWhereScope(auth) };

  if (isAdmin(auth) && query.owner_id) {
    where.owner_id = Number(query.owner_id);
  }

  if (query.stage) {
    const st = String(query.stage);
    if (stageValues.includes(st)) {
      where.stage = st;
    }
  }

  if (query.keyword) {
    const kw = String(query.keyword).trim();
    if (kw) {
      const or = [
        { name: { [Op.like]: `%${kw}%` } },
        { nickname: { [Op.like]: `%${kw}%` } },
        { phone: { [Op.like]: `%${kw}%` } },
        { wechat_id: { [Op.like]: `%${kw}%` } },
        { company: { [Op.like]: `%${kw}%` } },
      ];
      if (/^\d+$/.test(kw)) {
        const id = Number(kw);
        if (Number.isFinite(id) && id > 0) or.push({ id });
      }
      where[Op.or] = or;
    }
  }

  return where;
}

export async function listCustomers(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = buildListWhere(auth, query);

  const tagId = query.tag_id ? Number(query.tag_id) : null;
  const tagInclude = {
    ...tagIncludeBase,
    required: Boolean(tagId),
  };
  if (tagId) {
    tagInclude.where = { id: tagId };
  }

  const include = [
    { model: User, as: 'owner', attributes: ['id', 'username', 'real_name'] },
    tagInclude,
  ];

  // distinct 的 col 只能是「id」，勿写「Customer.id」，否则会生成非法列名「Customer->Customer.id」。
  const total = await Customer.count({
    where,
    include,
    distinct: true,
    col: 'id',
  });

  const rows = await Customer.findAll({
    where,
    include,
    limit: size,
    offset: (page - 1) * size,
    order: [['created_at', 'DESC']],
  });

  let list = rows.map((r) => attachDiscoveryMeta(r.get({ plain: true })));
  if (String(query.with_order_stats || '') === '1') {
    list = await attachOrderStatsToCustomers(auth.tenantId, list);
  }

  return { list, total, page, size };
}

export async function getCustomer(auth, id) {
  const row = await Customer.findOne({
    where: { id, ...customerWhereScope(auth) },
    include: [
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name', 'phone'] },
      { ...tagIncludeBase, required: false },
    ],
  });
  if (!row) {
    throw new HttpError(404, '客户不存在', 404);
  }
  return attachDiscoveryMeta(row.get({ plain: true }));
}

export async function getByExternalUserId(tenantId, externalUserId) {
  const uid = String(externalUserId || '').trim();
  if (!uid) {
    throw new HttpError(400, '缺少 external_userid', 400);
  }
  const customer = await Customer.findOne({
    where: {
      tenant_id: Number(tenantId),
      external_userid: uid,
      deleted_at: null,
    },
    include: [
      {
        model: Tag,
        as: 'tags',
        through: { attributes: [] },
        attributes: ['name'],
      },
      {
        model: CustomerFollowUp,
        as: 'followUps',
        separate: true,
        limit: 3,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'content', 'created_at'],
      },
    ],
  });

  if (!customer) throw new HttpError(404, '客户不存在', 404);

  const plain = customer.toJSON();
  return {
    ...plain,
    recent_followups: plain.followUps ?? [],
  };
}

export async function listCustomerMessages(auth, id) {
  await getCustomer(auth, id);
  const rows = await WeworkCustomerMessage.findAll({
    where: { tenant_id: auth.tenantId, customer_id: Number(id) },
    order: [['msg_time', 'DESC']],
    limit: 200,
    attributes: [
      'id',
      'direction',
      'msg_type',
      'content',
      'staff_userid',
      'external_userid',
      'msg_time',
      'created_at',
    ],
  });
  return { list: rows.map((r) => r.get({ plain: true })) };
}

export async function createCustomer(auth, body) {
  const { error, value } = createCustomerSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  let ownerId = auth.userId;
  if (isAdmin(auth) && value.owner_id != null) {
    ownerId = value.owner_id;
  }
  await assertUserInTenant(auth.tenantId, ownerId);

  const phoneTrimmed =
    value.phone != null && String(value.phone).trim() !== '' ? String(value.phone).trim() : '';
  if (phoneTrimmed) {
    const dup = await Customer.findOne({
      where: { tenant_id: auth.tenantId, phone: phoneTrimmed },
    });
    if (dup) {
      throw new HttpError(400, '该手机号已在本企业存在', 400);
    }
  }

  const row = await Customer.create({
    tenant_id: auth.tenantId,
    owner_id: ownerId,
    name: value.name ?? null,
    nickname: value.nickname ?? null,
    phone: value.phone ?? null,
    company: value.company ?? null,
    position: value.position ?? null,
    source: value.source ?? null,
    stage: value.stage ?? 'new',
    intention_level: value.intention_level ?? null,
    remark: value.remark ?? null,
    discovery_profile: value.discovery_profile ?? null,
    gender: value.gender ?? 0,
    wechat_id: value.wechat_id ?? null,
    external_userid: value.external_userid ?? null,
    added_at: value.added_at ?? null,
    opt_out_auto_msg: value.opt_out_auto_msg ?? false,
  });

  setImmediate(() => {
    dispatchNewCustomerFlows(auth.tenantId, row.id).catch((err) =>
      console.error('[flow-engine] dispatchNewCustomerFlows', err),
    );
    billingService.incrementUsage(auth.tenantId, 'customers').catch((err) =>
      console.error('[billing] increment customers', err),
    );
  });

  return getCustomer(auth, row.id);
}

export async function updateCustomer(auth, id, body) {
  const { error, value } = updateCustomerSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const row = await Customer.findOne({ where: { id, ...customerWhereScope(auth) } });
  if (!row) {
    throw new HttpError(404, '客户不存在', 404);
  }

  if (value.owner_id != null) {
    if (!isAdmin(auth)) {
      throw new HttpError(403, '无权修改客户归属', 403);
    }
    await assertUserInTenant(auth.tenantId, value.owner_id);
    row.owner_id = value.owner_id;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'phone')) {
    const p =
      value.phone != null && String(value.phone).trim() !== '' ? String(value.phone).trim() : '';
    if (p) {
      const dup = await Customer.findOne({
        where: {
          tenant_id: auth.tenantId,
          phone: p,
          id: { [Op.ne]: Number(id) },
        },
      });
      if (dup) {
        throw new HttpError(400, '该手机号已在本企业存在', 400);
      }
    }
  }

  const assign = [
    'name',
    'nickname',
    'phone',
    'company',
    'position',
    'source',
    'stage',
    'intention_level',
    'remark',
    'discovery_profile',
    'gender',
    'wechat_id',
    'external_userid',
    'added_at',
    'opt_out_auto_msg',
  ];
  const prevStage = normalizeStage(row.stage);
  const stageChanging = Object.prototype.hasOwnProperty.call(value, 'stage');

  for (const key of assign) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      row[key] = value[key];
    }
  }

  await row.save();

  if (stageChanging) {
    const nextStage = normalizeStage(row.stage);
    if (prevStage !== nextStage) {
      syncInboxThreadsFromCustomerStage(auth.tenantId, row.id, nextStage).catch((err) =>
        console.error('[stage-sync] inbox from crm', err),
      );
      dispatchStageChangedFlows(auth.tenantId, row.id, prevStage, nextStage).catch((err) =>
        console.error('[flow-engine] stage_changed dispatch', err),
      );
    }
  }

  return getCustomer(auth, id);
}

export async function rollbackLatestAutoDeal(auth, id, body = {}, context = {}) {
  const row = await Customer.findOne({ where: { id, ...customerWhereScope(auth) } });
  if (!row) {
    throw new HttpError(404, '客户不存在', 404);
  }

  if (normalizeStage(row.stage) !== 'deal') {
    throw new HttpError(400, '当前客户不是成交阶段，无法回滚自动成交', 400);
  }

  const logs = await AuditLog.findAll({
    where: {
      tenant_id: auth.tenantId,
      action: 'customer_stage_auto_change',
      target_type: 'customer',
      target_id: String(id),
    },
    order: [['created_at', 'DESC']],
    limit: 30,
  });

  const hit = logs.find((x) => {
    const d = x.detail_json || {};
    return d?.source === 'flow' && normalizeStage(d?.to_stage) === 'deal';
  });

  if (!hit) {
    throw new HttpError(404, '未找到可回滚的自动成交记录', 404);
  }

  const detail = hit.detail_json || {};
  const rollbackTo = normalizeStage(detail.from_stage || 'negotiation');
  if (!stageValues.includes(rollbackTo)) {
    throw new HttpError(400, '回滚目标阶段无效，请手动编辑客户阶段', 400);
  }

  await row.update({ stage: rollbackTo });

  await writeAuditLog(auth, {
    action: 'customer_stage_rollback',
    targetType: 'customer',
    targetId: id,
    detail: {
      source: 'manual',
      reason: body.reason || 'rollback_auto_deal',
      reason_text: body.reason_text || '',
      from_stage: 'deal',
      to_stage: rollbackTo,
      rollback_of_audit_id: hit.id,
    },
    ip: context.ip,
    userAgent: context.userAgent,
  });

  return getCustomer(auth, id);
}

export async function deleteCustomer(auth, id, context = {}) {
  const row = await Customer.findOne({ where: { id, ...customerWhereScope(auth) } });
  if (!row) {
    throw new HttpError(404, '客户不存在', 404);
  }
  const plain = row.get({ plain: true });
  await row.destroy();
  await writeAuditLog(auth, {
    action: 'customer_delete',
    targetType: 'customer',
    targetId: id,
    detail: {
      owner_id: plain.owner_id,
      phone: plain.phone || null,
      name: plain.name || null,
      stage: plain.stage || null,
    },
    ip: context.ip,
    userAgent: context.userAgent,
  });
  return { id: Number(id) };
}

export async function setCustomerTags(auth, id, body) {
  await getCustomer(auth, id);
  const { error, value } = setTagsSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const tagIds = value.tag_ids;
  if (tagIds.length > 0) {
    const found = await Tag.findAll({
      where: { tenant_id: auth.tenantId, id: { [Op.in]: tagIds } },
      attributes: ['id'],
    });
    if (found.length !== tagIds.length) {
      throw new HttpError(400, '存在无效标签或非本企业标签', 400);
    }
  }

  await CustomerTag.destroy({ where: { customer_id: id } });
  if (tagIds.length > 0) {
    await CustomerTag.bulkCreate(
      tagIds.map((tag_id) => ({
        customer_id: id,
        tag_id,
        created_by: auth.userId,
      }))
    );
  }

  return getCustomer(auth, id);
}

export async function transferCustomer(auth, id, body) {
  const { error, value } = transferSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const row = await Customer.findOne({ where: { id, ...customerWhereScope(auth) } });
  if (!row) {
    throw new HttpError(404, '客户不存在', 404);
  }

  await assertUserInTenant(auth.tenantId, value.to_user_id);
  const targetUser = await User.findOne({
    where: { id: value.to_user_id, tenant_id: auth.tenantId, status: 1 },
    attributes: ['id', 'username', 'real_name'],
  });
  if (!targetUser) {
    throw new HttpError(400, '目标用户无效', 400);
  }

  await row.update({ owner_id: value.to_user_id });

  await CustomerFollowUp.create({
    customer_id: Number(id),
    user_id: auth.userId,
    type: 'other',
    content: `客户已转移给 ${targetUser.real_name || targetUser.username}`,
  });

  return getCustomer(auth, id);
}

function pickCell(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  return null;
}

function parseImportBufferFromBase64(fileBase64) {
  let buf;
  try {
    buf = Buffer.from(fileBase64, 'base64');
  } catch {
    throw new HttpError(400, '文件内容无效', 400);
  }
  if (!buf.length) {
    throw new HttpError(400, '文件内容为空', 400);
  }
  return buf;
}

function parseExcelRows(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    throw new HttpError(400, 'Excel 无工作表', 400);
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

function parseImportCandidate(row) {
  const name = pickCell(row, ['客户名称', '姓名', 'name', 'Name']);
  const phoneRaw = pickCell(row, ['手机', '电话', 'phone', 'Phone', 'mobile', 'Mobile']);
  const wechat = pickCell(row, ['微信', '微信号', 'wechat_id', 'Wechat']);
  if (!name && !phoneRaw && !wechat) {
    return null;
  }
  const phone = phoneRaw ? String(phoneRaw).trim() : null;
  return {
    name: name || null,
    phone,
    wechat_id: wechat || null,
    company: pickCell(row, ['公司', '公司名称', 'company']) || null,
    source: pickCell(row, ['来源', 'source']) || null,
    stage: mapStage(pickCell(row, ['销售阶段', '阶段', 'stage'])),
    intention_level: (() => {
      const v = pickCell(row, ['意向度', 'intention_level']);
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null;
    })(),
    remark: pickCell(row, ['备注', 'remark']) || null,
  };
}

function mapStage(raw) {
  if (!raw) return 'new';
  const s = String(raw).trim();
  const map = {
    新线索: 'new',
    新客户: 'new',
    意向确认: 'intent_confirm',
    已联系: 'contacted',
    方案报价: 'proposal',
    有意向: 'intent',
    商务谈判: 'negotiation',
    成交: 'deal',
    已丢失: 'lost',
    流失: 'lost',
  };
  if (map[s]) return map[s];
  if (stageValues.includes(s)) return s;
  return 'new';
}

/**
 * @param {object} auth
 * @param {Record<string, unknown>[]} rows
 */
async function processImportRows(auth, rows) {
  let imported = 0;
  let skipped = 0;
  let duplicate_skipped = 0;
  const ownerId = auth.userId;
  await assertUserInTenant(auth.tenantId, ownerId);
  const candidates = [];
  const phones = new Set();
  const phoneSeenInFile = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const raw = /** @type {Record<string, unknown>} */ (rows[i]);
    const c = parseImportCandidate(raw);
    if (!c) {
      skipped += 1;
      continue;
    }
    const hasPhone = c.phone && c.phone.trim() !== '';
    if (hasPhone) {
      if (phoneSeenInFile.has(c.phone)) {
        duplicate_skipped += 1;
        continue;
      }
      phoneSeenInFile.add(c.phone);
      phones.add(c.phone);
    }
    candidates.push(c);
  }
  if (phones.size > 0) {
    const dbDupRows = await Customer.findAll({
      where: { tenant_id: auth.tenantId, phone: { [Op.in]: [...phones] } },
      attributes: ['phone'],
      raw: true,
    });
    const dbDupPhones = new Set(dbDupRows.map((r) => String(r.phone || '')));
    const ready = [];
    for (const c of candidates) {
      if (c.phone && dbDupPhones.has(c.phone)) {
        duplicate_skipped += 1;
      } else {
        ready.push(c);
      }
    }
    for (const c of ready) {
      await Customer.create({
        tenant_id: auth.tenantId,
        owner_id: ownerId,
        name: c.name,
        phone: c.phone,
        wechat_id: c.wechat_id,
        company: c.company,
        source: c.source,
        stage: c.stage,
        intention_level: c.intention_level,
        remark: c.remark,
        gender: 0,
      });
      imported += 1;
    }
  } else {
    for (const c of candidates) {
      await Customer.create({
        tenant_id: auth.tenantId,
        owner_id: ownerId,
        name: c.name,
        phone: c.phone,
        wechat_id: c.wechat_id,
        company: c.company,
        source: c.source,
        stage: c.stage,
        intention_level: c.intention_level,
        remark: c.remark,
        gender: 0,
      });
      imported += 1;
    }
  }
  return { imported, skipped, duplicate_skipped };
}

export async function importCustomers(auth, body) {
  const { error, value } = importSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const buf = parseImportBufferFromBase64(value.file_base64);
  const rows = parseExcelRows(buf);
  return processImportRows(auth, rows);
}

export async function previewImportCustomers(auth, body) {
  const { error, value } = importSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const buf = parseImportBufferFromBase64(value.file_base64);
  const rows = parseExcelRows(buf);

  const samples = [];
  const phones = new Set();
  const seenPhones = new Set();
  const candidates = [];
  let skippedEmpty = 0;
  let duplicateInFile = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const raw = /** @type {Record<string, unknown>} */ (rows[i]);
    const c = parseImportCandidate(raw);
    if (!c) {
      skippedEmpty += 1;
      if (samples.length < 100) {
        samples.push({ row_no: i + 2, status: 'skipped_empty', reason: 'empty_key_fields' });
      }
      continue;
    }
    let status = 'to_import';
    let reason = null;
    if (c.phone && c.phone.trim() !== '') {
      if (seenPhones.has(c.phone)) {
        status = 'duplicate_in_file';
        reason = 'duplicate_phone_in_file';
        duplicateInFile += 1;
      } else {
        seenPhones.add(c.phone);
        phones.add(c.phone);
      }
    }
    candidates.push({ row_no: i + 2, ...c, status, reason });
    if (samples.length < 100) {
      samples.push({
        row_no: i + 2,
        name: c.name,
        phone: c.phone,
        wechat_id: c.wechat_id,
        stage: c.stage,
        status,
        reason,
      });
    }
  }

  const dbDupPhones = new Set();
  if (phones.size > 0) {
    const dbRows = await Customer.findAll({
      where: { tenant_id: auth.tenantId, phone: { [Op.in]: [...phones] } },
      attributes: ['phone'],
      raw: true,
    });
    for (const r of dbRows) dbDupPhones.add(String(r.phone || ''));
  }

  let duplicateInDb = 0;
  let toImport = 0;
  for (const s of candidates) {
    if (s.status === 'skipped_empty') continue;
    if (s.status === 'duplicate_in_file') {
      continue;
    }
    if (s.phone && dbDupPhones.has(String(s.phone))) {
      duplicateInDb += 1;
    } else {
      toImport += 1;
    }
  }

  for (const s of samples) {
    if (s.status !== 'to_import') continue;
    if (s.phone && dbDupPhones.has(String(s.phone))) {
      s.status = 'duplicate_in_db';
      s.reason = 'phone_exists_in_db';
    }
  }

  return {
    summary: {
      total_rows: rows.length,
      valid_rows: rows.length - skippedEmpty,
      to_import: toImport,
      skipped_empty: skippedEmpty,
      duplicate_in_file: duplicateInFile,
      duplicate_in_db: duplicateInDb,
    },
    samples,
  };
}

export async function importCustomersFromCsv(auth, buffer) {
  if (!buffer?.length) {
    throw new HttpError(400, 'CSV 内容为空', 400);
  }
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  return processImportRows(auth, rows);
}

export async function exportCustomers(auth, query, context = {}) {
  const where = buildListWhere(auth, query);
  const tagId = query.tag_id ? Number(query.tag_id) : null;
  const tagInclude = {
    ...tagIncludeBase,
    required: Boolean(tagId),
  };
  if (tagId) {
    tagInclude.where = { id: tagId };
  }

  const rows = await Customer.findAll({
    where,
    order: [['updated_at', 'DESC']],
    subQuery: false,
    include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'real_name'] }, tagInclude],
  });

  const data = rows.map((cust) => {
    const p = cust.get({ plain: true });
    return {
      客户名称: p.name ?? '',
      手机: p.phone ?? '',
      微信: p.wechat_id ?? '',
      公司: p.company ?? '',
      来源: p.source ?? '',
      销售阶段: p.stage ?? '',
      意向度: p.intention_level ?? '',
      标签: (p.tags || []).map((t) => t.name).join(','),
      负责人: p.owner?.real_name || p.owner?.username || '',
      备注: p.remark ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 客户名称: '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'customers');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const file_base64 = Buffer.from(out).toString('base64');
  const filename = `customers_export_${Date.now()}.xlsx`;
  await writeAuditLog(auth, {
    action: 'customer_export',
    targetType: 'customer',
    targetId: 'list',
    detail: {
      result_count: rows.length,
      filters: {
        owner_id: query.owner_id ? Number(query.owner_id) : null,
        stage: query.stage ? String(query.stage) : null,
        tag_id: query.tag_id ? Number(query.tag_id) : null,
        keyword: query.keyword ? String(query.keyword).slice(0, 64) : null,
      },
    },
    ip: context.ip,
    userAgent: context.userAgent,
  });
  return { filename, file_base64 };
}

export async function listFollowUps(auth, customerId) {
  await getCustomer(auth, customerId);
  const rows = await CustomerFollowUp.findAll({
    where: { customer_id: customerId },
    order: [['created_at', 'DESC']],
    include: [{ model: User, as: 'author', attributes: ['id', 'username', 'real_name'] }],
  });
  return rows.map((r) => r.get({ plain: true }));
}

export async function createFollowUp(auth, customerId, body) {
  await getCustomer(auth, customerId);
  const { error, value } = createFollowUpSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const row = await CustomerFollowUp.create({
    customer_id: customerId,
    user_id: auth.userId,
    type: value.type,
    content: value.content,
    next_follow_at: value.next_follow_at ?? null,
  });

  await Customer.update(
    { last_contact_at: new Date() },
    { where: { id: customerId, ...customerWhereScope(auth) } }
  );

  const plain = row.get({ plain: true });
  const author = await User.findByPk(auth.userId, { attributes: ['id', 'username', 'real_name'] });
  return { ...plain, author: author ? author.get({ plain: true }) : null };
}
