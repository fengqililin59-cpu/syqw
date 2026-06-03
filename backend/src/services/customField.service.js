/**
 * @file 自定义字段服务层
 *
 * 核心能力：
 *   1. 租户管理自己的字段定义（增删改查 + 排序）
 *   2. 客户自定义字段值的读写（批量保存 + 按客户读取）
 *   3. 行业模板：提供教培/医美/B2B 等预置字段包
 */
import { CustomFieldDef, CustomerFieldValue } from '../models/customField.model.js';

// ========== 行业模板 ==========
const INDUSTRY_TEMPLATES = {
  edu: {
    label: '教培行业',
    fields: [
      { field_key: 'grade', field_label: '年级', field_type: 'select', group_name: '学员信息',
        options: [{ label: '幼儿园', value: 'kindergarten' },{ label: '小学', value: 'primary' },{ label: '初中', value: 'junior' },{ label: '高中', value: 'senior' }],
        is_required: true, display_order: 1 },
      { field_key: 'subject', field_label: '意向科目', field_type: 'multi_select', group_name: '学员信息',
        options: [{ label: '语文', value: 'chinese' },{ label: '数学', value: 'math' },{ label: '英语', value: 'english' },{ label: '物理', value: 'physics' }],
        display_order: 2 },
      { field_key: 'trial_status', field_label: '试听状态', field_type: 'select', group_name: '跟进',
        options: [{ label: '未试听', value: 'none' },{ label: '已试听', value: 'done' },{ label: '已报名', value: 'enrolled' }],
        display_order: 3 },
      { field_key: 'remaining_hours', field_label: '剩余课时', field_type: 'number', group_name: '消费',
        display_order: 4 },
    ],
  },
  beauty: {
    label: '医美行业',
    fields: [
      { field_key: 'skin_type', field_label: '肤质', field_type: 'select', group_name: '基础档案',
        options: [{ label: '油性', value: 'oily' },{ label: '干性', value: 'dry' },{ label: '混合', value: 'mixed' },{ label: '敏感', value: 'sensitive' }],
        display_order: 1 },
      { field_key: 'concern', field_label: '关注项目', field_type: 'multi_select', group_name: '基础档案',
        options: [{ label: '光电', value: 'laser' },{ label: '注射', value: 'injection' },{ label: '手术', value: 'surgery' },{ label: '抗衰', value: 'antiaging' }],
        display_order: 2 },
      { field_key: 'allergy', field_label: '过敏史', field_type: 'textarea', group_name: '健康信息',
        display_order: 3 },
      { field_key: 'last_treatment_date', field_label: '上次治疗日', field_type: 'date', group_name: '消费',
        display_order: 4 },
      { field_key: 'budget', field_label: '预算区间(万)', field_type: 'number', group_name: '消费',
        placeholder: '如 3-5', display_order: 5 },
    ],
  },
  b2b: {
    label: 'B2B 企服',
    fields: [
      { field_key: 'company_size', field_label: '公司规模', field_type: 'select', group_name: '企业信息',
        options: [{ label: '1-50人', value: '1-50' },{ label: '51-200人', value: '51-200' },{ label: '201-1000人', value: '201-1000' },{ label: '1000人以上', value: '1000+' }],
        display_order: 1 },
      { field_key: 'decision_maker', field_label: '决策人角色', field_type: 'text', group_name: '企业信息',
        placeholder: '如 CEO / CTO', display_order: 2 },
      { field_key: 'budget_cycle', field_label: '采购周期/月', field_type: 'number', group_name: '商机',
        display_order: 3 },
      { field_key: 'competitor', field_label: '竞品', field_type: 'text', group_name: '商机',
        placeholder: '正在用/看过哪些竞品', display_order: 4 },
    ],
  },
  loan: {
    label: '助贷行业',
    fields: [
      { field_key: 'id_number', field_label: '身份证号', field_type: 'text', group_name: '信用档案',
        placeholder: '加密存储，仅内部可见', is_required: true, display_order: 1 },
      { field_key: 'credit_status', field_label: '征信状况', field_type: 'select', group_name: '信用档案',
        options: [{ label: '良好', value: 'good' },{ label: '有逾期', value: 'overdue' },{ label: '黑户', value: 'black' }],
        display_order: 2 },
      { field_key: 'monthly_income', field_label: '月收入(万)', field_type: 'number', group_name: '收入负债',
        display_order: 3 },
      { field_key: 'existing_debt', field_label: '现有负债(万)', field_type: 'number', group_name: '收入负债',
        display_order: 4 },
      { field_key: 'collateral', field_label: '抵押物', field_type: 'select', group_name: '资产',
        options: [{ label: '房产', value: 'house' },{ label: '车辆', value: 'car' },{ label: '无', value: 'none' }],
        display_order: 5 },
      { field_key: 'loan_purpose', field_label: '借款用途', field_type: 'select', group_name: '借款需求',
        options: [{ label: '经营周转', value: 'business' },{ label: '装修', value: 'renovation' },{ label: '教育', value: 'education' },{ label: '医美', value: 'beauty' },{ label: '其他', value: 'other' }],
        display_order: 6 },
      { field_key: 'expected_amount', field_label: '期望金额(万)', field_type: 'number', group_name: '借款需求',
        display_order: 7 },
    ],
  },
};

// ========== 字段定义 CRUD ==========

/** 获取租户所有字段定义 */
export async function getFieldDefs(tenantId, { activeOnly = false } = {}) {
  const where = { tenant_id: tenantId };
  if (activeOnly) where.is_active = true;
  const rows = await CustomFieldDef.model.findAll({
    where,
    order: [['display_order', 'ASC'], ['id', 'ASC']],
  });
  return rows;
}

/** 获取行业模板 */
export function getIndustryTemplates() {
  const result = {};
  for (const [key, t] of Object.entries(INDUSTRY_TEMPLATES)) {
    result[key] = { label: t.label, fieldCount: t.fields.length, fields: t.fields };
  }
  return result;
}

/** 应用行业模板 */
export async function applyTemplate(tenantId, templateKey) {
  const template = INDUSTRY_TEMPLATES[templateKey];
  if (!template) throw Object.assign(new Error('未知模板'), { status: 400 });

  const models = CustomFieldDef.model;
  let added = 0;

  for (const def of template.fields) {
    const [row, created] = await models.findOrCreate({
      where: { tenant_id: tenantId, field_key: def.field_key },
      defaults: { tenant_id: tenantId, ...def },
    });
    if (created) added++;
  }
  return { added, total: template.fields.length };
}

/** 创建字段定义 */
export async function createFieldDef(tenantId, data) {
  const existing = await CustomFieldDef.model.findOne({
    where: { tenant_id: tenantId, field_key: data.field_key },
  });
  if (existing) throw Object.assign(new Error(`字段键 "${data.field_key}" 已存在`), { status: 409 });

  return CustomFieldDef.model.create({ ...data, tenant_id: tenantId });
}

/** 更新字段定义 */
export async function updateFieldDef(tenantId, id, data) {
  const row = await CustomFieldDef.model.findOne({ where: { id, tenant_id: tenantId } });
  if (!row) throw Object.assign(new Error('字段不存在'), { status: 404 });
  delete data.tenant_id;
  delete data.field_key; // 不允许修改 key
  return row.update(data);
}

/** 删除字段定义 */
export async function deleteFieldDef(tenantId, id) {
  const row = await CustomFieldDef.model.findOne({ where: { id, tenant_id: tenantId } });
  if (!row) throw Object.assign(new Error('字段不存在'), { status: 404 });
  // 级联删除字段值（外键 ON DELETE CASCADE 数据库层面处理）
  await row.destroy();
  return { deleted: true };
}

// ========== 字段值读写 ==========

/** 获取某客户的所有自定义字段值（连带字段定义） */
export async function getCustomerFieldValues(tenantId, customerId) {
  const defs = await CustomFieldDef.model.findAll({
    where: { tenant_id: tenantId, is_active: true },
    order: [['display_order', 'ASC']],
  });
  const vals = await CustomerFieldValue.model.findAll({
    where: { tenant_id: tenantId, customer_id: customerId },
  });
  const valMap = {};
  for (const v of vals) valMap[v.field_id] = v.value;

  return defs.map((d) => ({
    field_id: d.id,
    field_key: d.field_key,
    field_label: d.field_label,
    field_type: d.field_type,
    options: d.options,
    group_name: d.group_name,
    value: valMap[d.id] ?? null,
    is_required: d.is_required,
    placeholder: d.placeholder,
  }));
}

/** 批量保存客户自定义字段值 */
export async function saveCustomerFieldValues(tenantId, customerId, fieldValues) {
  // fieldValues: { fieldKey: value, ... } 或 [{ field_key, value }, ...]
  const entries = Array.isArray(fieldValues)
    ? fieldValues.map((x) => ({ key: x.field_key || x.key, value: x.value ?? x.val ?? '' }))
    : Object.entries(fieldValues).map(([key, value]) => ({ key, value }));

  // 批量 upsert
  const results = [];
  for (const { key, value } of entries) {
    const def = await CustomFieldDef.model.findOne({
      where: { tenant_id: tenantId, field_key: key, is_active: true },
    });
    if (!def) continue;

    const [row] = await CustomerFieldValue.model.upsert({
      tenant_id: tenantId,
      customer_id: customerId,
      field_id: def.id,
      value: String(value ?? ''),
    });
    results.push(row);
  }
  return results;
}
