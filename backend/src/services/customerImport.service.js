/**
 * @file 客户批量导入：文件解析、预览确认、异步导入执行与结果查询。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import Joi from 'joi';
import XLSX from 'xlsx';
import { parse as parseCsv } from 'csv-parse/sync';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { Customer, CustomerTag, ImportJob, Tag, User } from '../models/index.js';
import { CustomFieldDef, CustomerFieldValue } from '../models/customField.model.js';
import { writeAuditLog } from './auditLog.service.js';

const STAGES = ['new', 'intent_confirm', 'proposal', 'negotiation', 'deal', 'lost', 'contacted', 'intent'];

const confirmSchema = Joi.object({
  duplicate_strategy: Joi.string().valid('skip', 'update').default('skip'),
  default_owner_id: Joi.number().integer().positive().required(),
  default_stage: Joi.string().trim().max(32).allow('', null).default('new'),
}).unknown(false);

const FILE_MAX_ROWS = 5000;
const UPDATABLE_FIELDS = ['name', 'phone', 'company', 'position', 'wechat_id', 'remark', 'source', 'stage'];
const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false);

const FIELD_ALIASES = {
  name: ['name', '姓名', '客户姓名', '联系人'],
  phone: ['phone', '手机', '手机号', '电话', '联系方式'],
  company: ['company', '公司', '企业', '单位', '公司名称'],
  position: ['position', '职位', '岗位', '职务'],
  wechat_id: ['wechat', '微信', '微信号', 'wechatid', 'wechat_id'],
  email: ['email', '邮箱', '电子邮件'],
  stage: ['stage', '阶段', '客户阶段'],
  remark: ['remark', '备注', '说明', '描述'],
  source: ['source', '来源', '客户来源'],
  tags: ['tag', '标签', '客户标签', 'tags'],
};

// 自定义字段映射（key 为 `cf:<field_key>`，运行时由 buildCustomFieldAliases 动态填充）
let customFieldAliases = {};
// 自定义字段定义缓存（field_key → field_id 映射）
let customFieldDefMap = {};

/**
 * 从租户激活的自定义字段定义构建别名映射。
 */
async function buildCustomFieldAliases(tenantId) {
  const defs = await CustomFieldDef.findAll({
    where: { tenant_id: tenantId, is_active: true },
    attributes: ['id', 'field_key', 'field_label', 'field_type'],
    order: [['display_order', 'ASC']],
    raw: true,
  });
  customFieldAliases = {};
  customFieldDefMap = {};
  for (const d of defs) {
    const key = `cf:${d.field_key}`;
    customFieldAliases[key] = [d.field_label, d.field_key];
    customFieldDefMap[d.field_key] = { id: d.id, type: d.field_type };
  }
  return customFieldAliases;
}

function normalizeHeader(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function stripToNull(v) {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function normalizePhone(v) {
  if (v == null) return '';
  return String(v).replace(/[^\d+]/g, '');
}

function normalizeStage(v, fallback = 'new') {
  const s = String(v ?? '').trim();
  if (!s) return fallback;
  return STAGES.includes(s) ? s : 'new';
}

function splitTags(v) {
  if (!v) return [];
  return String(v)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.slice(0, 20));
}

function mapHeaderToField(raw) {
  const n = normalizeHeader(raw);
  if (!n) return null;
  // 先检查标准字段
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => normalizeHeader(a) === n || n.includes(normalizeHeader(a)))) {
      return field;
    }
  }
  // 再检查自定义字段
  for (const [cfKey, aliases] of Object.entries(customFieldAliases)) {
    if (aliases.some((a) => normalizeHeader(a) === n || n.includes(normalizeHeader(a)))) {
      return cfKey; // 返回 "cf:<field_key>" 格式
    }
  }
  return null;
}

function parseBufferByExt(buf, fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext === '.csv') {
    // 剥离 UTF-8 BOM（Numbers、Excel for Mac 导出的 CSV 常带 BOM）
    const text = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      ? buf.slice(3).toString('utf8')
      : buf.toString('utf8');
    return parseCsv(text, { skip_empty_lines: true, relax_column_count: true, bom: true });
  }
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.SheetNames[0];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: false, defval: '' });
}

function shapeRow(rawRow, columns, defaultStage = 'new') {
  const rawObj = {};
  const mapped = {};
  const customFields = {}; // 自定义字段值：{ field_key: value }
  for (let i = 0; i < columns.length; i += 1) {
    const c = columns[i];
    const val = rawRow[i] ?? '';
    rawObj[c.raw || `col_${i + 1}`] = val;
    if (!c.mapped) continue;
    // 自定义字段：格式 "cf:<field_key>"
    if (c.mapped.startsWith('cf:')) {
      const fieldKey = c.mapped.slice(3);
      const def = customFieldDefMap[fieldKey];
      if (def) {
        let normalizedVal = String(val ?? '').trim();
        // 多选型：按逗号分隔后 JSON 化
        if (def.type === 'multi_select' && normalizedVal) {
          normalizedVal = JSON.stringify(normalizedVal.split(',').map((x) => x.trim()).filter(Boolean));
        }
        customFields[fieldKey] = normalizedVal || null;
      }
      continue;
    }
    if (c.mapped === 'tags') {
      mapped.tags = String(val ?? '');
    } else {
      mapped[c.mapped] = stripToNull(val);
    }
  }

  if (mapped.email) {
    const emailLine = `邮箱: ${mapped.email}`;
    mapped.remark = mapped.remark ? `${mapped.remark}\n${emailLine}` : emailLine;
    delete mapped.email;
  }

  const cleanedPhone = normalizePhone(mapped.phone);
  mapped.phone = cleanedPhone || null;
  mapped.wechat_id = stripToNull(mapped.wechat_id);
  mapped.name = stripToNull(mapped.name) || mapped.phone || null;
  mapped.company = stripToNull(mapped.company);
  mapped.position = stripToNull(mapped.position);
  mapped.source = stripToNull(mapped.source);
  mapped.remark = stripToNull(mapped.remark);
  mapped.stage = normalizeStage(mapped.stage, defaultStage);

  const tags = splitTags(mapped.tags);
  delete mapped.tags;

  const issues = [];
  if (!mapped.name) issues.push('缺少姓名/手机号');
  if (mapped.phone && !/^\+?\d{6,20}$/.test(mapped.phone)) issues.push('手机号格式可能异常');

  return { raw: rawObj, mapped, tags, customFields, issues };
}

async function ensureOwnerInTenant(tenantId, ownerId) {
  const user = await User.findOne({ where: { id: ownerId, tenant_id: tenantId }, attributes: ['id'] });
  if (!user) throw new HttpError(400, '默认负责人不存在或不属于当前租户', 400);
}

async function readAndMapRows(filePath, fileName, tenantId, defaultStage = 'new') {
  // 加载该租户的自定义字段映射
  await buildCustomFieldAliases(tenantId);

  const buf = await fs.readFile(filePath);
  const matrix = parseBufferByExt(buf, fileName);
  if (!Array.isArray(matrix) || matrix.length < 1) return { columns: [], rows: [] };

  const header = Array.isArray(matrix[0]) ? matrix[0] : [];
  const columns = header.map((h) => {
    const raw = String(h ?? '').trim();
    const mapped = mapHeaderToField(raw);
    return { raw, mapped, ignored: !mapped };
  });

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = Array.isArray(matrix[i]) ? matrix[i] : [];
    const shaped = shapeRow(line, columns, defaultStage);
    const isEmpty = !Object.values(shaped.raw).some((x) => String(x ?? '').trim() !== '');
    if (isEmpty) continue;
    rows.push(shaped);
  }
  return { columns, rows };
}

function formatJobPreview(job, preview, includeLarge = true) {
  const p = job.get({ plain: true });
  const base = {
    id: p.id,
    tenant_id: p.tenant_id,
    created_by: p.created_by,
    file_name: p.file_name,
    total_count: p.total_count,
    imported_count: p.imported_count,
    updated_count: p.updated_count,
    skipped_count: p.skipped_count,
    failed_count: p.failed_count,
    status: p.status,
    error_msg: p.error_msg,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
  if (includeLarge) {
    base.preview_json = preview ?? p.preview_json ?? null;
    base.result_json = p.result_json ?? null;
  }
  return base;
}

/**
 * 保存导入行的自定义字段值（批量 upsert）。
 * @param {number} tenantId
 * @param {number} customerId
 * @param {Record<string, string|null>} customFields - { field_key: value }
 */
async function saveImportCustomFieldValues(tenantId, customerId, customFields) {
  if (!customFields || Object.keys(customFields).length === 0) return;
  for (const [fieldKey, value] of Object.entries(customFields)) {
    const def = customFieldDefMap[fieldKey];
    if (!def) continue;
    await CustomerFieldValue.upsert(
      {
        tenant_id: tenantId,
        customer_id: customerId,
        field_id: def.id,
        value: value ?? '',
      },
      {
        conflictFields: ['tenant_id', 'customer_id', 'field_id'],
      },
    );
  }
}

/**
 * 解析上传文件并创建预览任务（不执行导入）。
 */
export async function parseUploadedFile(tenantId, createdBy, filePath, fileName) {
  if (!filePath || !fileName) throw new HttpError(400, '缺少上传文件', 400);
  const ext = path.extname(String(fileName)).toLowerCase();
  if (ext === '.numbers') {
    throw new HttpError(400, 'Numbers 格式暂不支持直接导入，请在 Numbers 中选择「文件 → 导出为 → Excel」或「CSV」后重新上传', 400);
  }
  if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    throw new HttpError(400, '仅支持 xlsx/xls/csv 文件', 400);
  }

  const job = await ImportJob.create({
    tenant_id: tenantId,
    created_by: createdBy,
    file_name: String(fileName).slice(0, 255),
    status: 'parsing',
  });

  try {
    const { columns, rows } = await readAndMapRows(filePath, fileName, tenantId, 'new');
    if (rows.length > FILE_MAX_ROWS) {
      throw new HttpError(400, `单次最多导入 ${FILE_MAX_ROWS} 条，请拆分后重试`, 400);
    }

    const preview = {
      file_path: filePath,
      columns,
      rows: rows.slice(0, 20).map((r) => ({ raw: r.raw, mapped: r.mapped, issues: r.issues })),
      total: rows.length,
      has_phone: columns.some((c) => c.mapped === 'phone'),
    };

    await job.update({
      total_count: rows.length,
      preview_json: preview,
      status: 'previewing',
    });
    return formatJobPreview(job, preview, true);
  } catch (e) {
    await job.update({
      status: 'failed',
      error_msg: String(e?.message || e).slice(0, 500),
    });
    throw e;
  }
}

/**
 * 确认导入并异步开始执行。
 */
export async function confirmImport(tenantId, jobId, options) {
  const { error, value } = confirmSchema.validate(options || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const job = await ImportJob.findOne({ where: { id: jobId, tenant_id: tenantId } });
  if (!job) throw new HttpError(404, '导入任务不存在', 404);
  if (job.status !== 'previewing') throw new HttpError(400, '当前任务状态不可确认导入', 400);

  await ensureOwnerInTenant(tenantId, value.default_owner_id);
  const defaultStage = normalizeStage(value.default_stage || 'new', 'new');
  await job.update({ status: 'importing', error_msg: null });

  executeImport(job.id, {
    duplicate_strategy: value.duplicate_strategy,
    default_owner_id: Number(value.default_owner_id),
    default_stage: defaultStage,
  }).catch((err) => console.error('[customer-import] executeImport', err));

  return getJobStatus(tenantId, job.id);
}

/**
 * 异步执行导入任务。
 */
export async function executeImport(jobId, options) {
  let job = null;
  try {
    job = await ImportJob.findByPk(jobId);
    if (!job) return;

    const tenantId = Number(job.tenant_id);
    const createdBy = Number(job.created_by);
    const preview = (job.preview_json && typeof job.preview_json === 'object') ? job.preview_json : {};
    const filePath = String(preview.file_path || '').trim();
    if (!filePath) throw new Error('导入任务缺少文件路径');

    await ensureOwnerInTenant(tenantId, options.default_owner_id);

    const { rows } = await readAndMapRows(filePath, job.file_name, tenantId, options.default_stage || 'new');
    if (rows.length > FILE_MAX_ROWS) throw new Error(`单次最多导入 ${FILE_MAX_ROWS} 条`);

    await job.update({
      total_count: rows.length,
      imported_count: 0,
      updated_count: 0,
      skipped_count: 0,
      failed_count: 0,
      status: 'importing',
      error_msg: null,
    });

    // 预扫全部标签，串行 findOrCreate，避免并发竞态。
    const allTagNames = new Set();
    for (const r of rows) {
      for (const n of splitTags(r.tags)) allTagNames.add(n);
    }
    const tagMap = new Map();
    for (const name of allTagNames) {
      const [tag] = await Tag.findOrCreate({
        where: { tenant_id: tenantId, name },
        defaults: { color: '#60a5fa', category: 'import', created_by: createdBy },
      });
      tagMap.set(name, tag.id);
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let processed = 0;
    const failedRows = [];
    const seenPhones = new Set();
    const seenWechats = new Set();

    for (let i = 0; i < rows.length; i += 1) {
      const rowNo = i + 2; // 包含表头
      const line = rows[i];
      try {
        const data = line.mapped;

        // 同文件内去重：skip/update 行为一致，保留第一次出现的记录
        if (data.phone) {
          const p = String(data.phone).trim();
          if (p && seenPhones.has(p)) {
            skipped += 1;
            failedRows.push({ row: rowNo, data: line.raw, error: '同文件内重复手机号' });
            processed += 1;
            // 进度按行走（包括跳过行）
            if (processed % 50 === 0) {
              await job.update({
                imported_count: imported,
                updated_count: updated,
                skipped_count: skipped,
                failed_count: failed,
              });
            }
            continue;
          }
          if (p) seenPhones.add(p);
        } else if (data.wechat_id) {
          const w = String(data.wechat_id).trim();
          if (w && seenWechats.has(w)) {
            skipped += 1;
            failedRows.push({ row: rowNo, data: line.raw, error: '同文件内重复微信号' });
            processed += 1;
            if (processed % 50 === 0) {
              await job.update({
                imported_count: imported,
                updated_count: updated,
                skipped_count: skipped,
                failed_count: failed,
              });
            }
            continue;
          }
          if (w) seenWechats.add(w);
        }

        let found = null;
        if (data.phone) {
          found = await Customer.findOne({ where: { tenant_id: tenantId, phone: data.phone } });
        } else if (data.wechat_id) {
          found = await Customer.findOne({ where: { tenant_id: tenantId, wechat_id: data.wechat_id } });
        }

        if (found) {
          if (options.duplicate_strategy === 'skip') {
            skipped += 1;
          } else {
            const patch = {};
            for (const key of UPDATABLE_FIELDS) {
              if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
              const v = data[key];
              if (v !== undefined && v !== null && String(v) !== '') {
                patch[key] = key === 'stage' ? normalizeStage(v, options.default_stage || 'new') : v;
              }
            }
            if (Object.keys(patch).length > 0) {
              await found.update(patch);
            }
            updated += 1;
            const tagIds = splitTags(line.tags).map((n) => tagMap.get(n)).filter(Boolean);
            for (const tid of tagIds) {
              await CustomerTag.findOrCreate({
                where: { customer_id: found.id, tag_id: tid },
                defaults: { created_by: createdBy },
              });
            }
            // 保存自定义字段值（更新模式）
            await saveImportCustomFieldValues(tenantId, found.id, line.customFields);
          }
        } else {
          const created = await Customer.create({
            tenant_id: tenantId,
            owner_id: options.default_owner_id,
            name: data.name || data.phone || `导入客户${rowNo}`,
            phone: data.phone || null,
            company: data.company || null,
            position: data.position || null,
            wechat_id: data.wechat_id || null,
            source: data.source || null,
            stage: normalizeStage(data.stage, options.default_stage || 'new'),
            remark: data.remark || null,
          });
          imported += 1;

          const tagIds = splitTags(line.tags).map((n) => tagMap.get(n)).filter(Boolean);
          for (const tid of tagIds) {
            await CustomerTag.findOrCreate({
              where: { customer_id: created.id, tag_id: tid },
              defaults: { created_by: createdBy },
            });
          }
          // 保存自定义字段值（新建模式）
          await saveImportCustomFieldValues(tenantId, created.id, line.customFields);
        }
      } catch (e) {
        failed += 1;
        failedRows.push({
          row: rowNo,
          data: line.raw,
          error: String(e?.message || e).slice(0, 500),
        });
      }

      processed += 1;
      if (processed % 50 === 0) {
        await job.update({
          imported_count: imported,
          updated_count: updated,
          skipped_count: skipped,
          failed_count: failed,
        });
      }
    }

    await job.update({
      imported_count: imported,
      updated_count: updated,
      skipped_count: skipped,
      failed_count: failed,
      status: 'done',
      result_json: failedRows,
      error_msg: null,
    });

    await writeAuditLog(
      { tenantId, userId: createdBy },
      {
        action: 'customer_import',
        targetType: 'import_job',
        targetId: job.id,
        detail: {
          file_name: job.file_name,
          total: rows.length,
          imported,
          updated,
          skipped,
          failed,
        },
      },
    );

    fs.unlink(filePath).catch(() => {});
  } catch (e) {
    if (job) {
      await job.update({
        status: 'failed',
        error_msg: String(e?.message || e).slice(0, 500),
      });
      const filePath = job.preview_json?.file_path ? String(job.preview_json.file_path) : '';
      if (filePath) fs.unlink(filePath).catch(() => {});
    }
  }
}

/**
 * 查询导入任务进度（不返回大 JSON）。
 */
export async function getJobStatus(tenantId, jobId) {
  const row = await ImportJob.findOne({
    where: { id: Number(jobId), tenant_id: Number(tenantId) },
    attributes: [
      'id',
      'tenant_id',
      'created_by',
      'file_name',
      'total_count',
      'imported_count',
      'updated_count',
      'skipped_count',
      'failed_count',
      'status',
      'error_msg',
      'created_at',
      'updated_at',
    ],
  });
  if (!row) throw new HttpError(404, '导入任务不存在', 404);
  return formatJobPreview(row, null, false);
}

/**
 * 查询导入失败结果明细（仅 done 可查询）。
 */
export async function getJobResult(tenantId, jobId) {
  const row = await ImportJob.findOne({
    where: { id: Number(jobId), tenant_id: Number(tenantId) },
  });
  if (!row) throw new HttpError(404, '导入任务不存在', 404);
  if (row.status !== 'done') throw new HttpError(400, '任务未完成，暂不可查看结果', 400);
  return {
    id: row.id,
    status: row.status,
    failed_count: row.failed_count,
    result_json: Array.isArray(row.result_json) ? row.result_json : [],
  };
}

/**
 * 分页查询历史导入任务（不返回 preview/result 大字段）。
 */
export async function listJobs(tenantId, query) {
  const { error, value } = listSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const { rows, count } = await ImportJob.findAndCountAll({
    where: { tenant_id: Number(tenantId) },
    attributes: {
      exclude: ['preview_json', 'result_json'],
    },
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false }],
    order: [['created_at', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });

  return {
    list: rows.map((r) => {
      const p = r.get({ plain: true });
      return {
        id: p.id,
        tenant_id: p.tenant_id,
        created_by: p.created_by,
        file_name: p.file_name,
        total_count: p.total_count,
        imported_count: p.imported_count,
        updated_count: p.updated_count,
        skipped_count: p.skipped_count,
        failed_count: p.failed_count,
        status: p.status,
        error_msg: p.error_msg,
        created_at: p.created_at,
        updated_at: p.updated_at,
        creator: p.creator
          ? { id: p.creator.id, username: p.creator.username, real_name: p.creator.real_name }
          : null,
      };
    }),
    total: count,
    page: value.page,
    size: value.size,
  };
}
