/**
 * @file 销售管道配置服务层
 *
 * 核心能力：
 *   1. 获取租户自定义管道（不存在时返回默认6阶段）
 *   2. 保存/更新租户管道配置
 *   3. 重置为默认管道
 *   4. 提供行业管道模板（房产/教培/医美/B2B/助贷）
 */
import { PipelineConfig } from '../models/pipelineConfig.model.js';
import { HttpError } from '../utils/httpError.js';

function requireTenantId(tenantId) {
  if (tenantId == null || !Number.isFinite(Number(tenantId))) {
    throw new HttpError(400, 'tenant_id 无效', 400);
  }
  return Number(tenantId);
}

// ========== 默认管道 ==========
const DEFAULT_STAGES = [
  { key: 'new',             label: '新线索',   color: '#94a3b8', category: 'open', order: 0 },
  { key: 'intent_confirm',  label: '意向确认', color: '#60a5fa', category: 'open', order: 1 },
  { key: 'proposal',        label: '方案报价', color: '#a78bfa', category: 'open', order: 2 },
  { key: 'negotiation',     label: '商务谈判', color: '#f59e0b', category: 'open', order: 3 },
  { key: 'deal',            label: '成交',     color: '#10b981', category: 'won',  order: 4 },
  { key: 'lost',            label: '流失',     color: '#ef4444', category: 'lost', order: 5 },
];

// ========== 行业管道模板 ==========
const PIPELINE_TEMPLATES = {
  realestate: {
    label: '房产中介',
    stages: [
      { key: 'registered',    label: '客户登记', color: '#94a3b8', category: 'open' },
      { key: 'viewing',       label: '带看',     color: '#60a5fa', category: 'open' },
      { key: 'interested',    label: '意向',     color: '#a78bfa', category: 'open' },
      { key: 'negotiating',   label: '议价',     color: '#f59e0b', category: 'open' },
      { key: 'contract',      label: '签约',     color: '#10b981', category: 'won'  },
      { key: 'transfer',      label: '过户',     color: '#06b6d4', category: 'won'  },
      { key: 'lost',          label: '流失',     color: '#ef4444', category: 'lost' },
    ],
  },
  education: {
    label: '教培行业',
    stages: [
      { key: 'inquiry',       label: '咨询',     color: '#94a3b8', category: 'open' },
      { key: 'trial',         label: '试听',     color: '#60a5fa', category: 'open' },
      { key: 'plan',          label: '方案',     color: '#a78bfa', category: 'open' },
      { key: 'payment',       label: '缴费',     color: '#10b981', category: 'won'  },
      { key: 'start_class',   label: '开课',     color: '#06b6d4', category: 'won'  },
      { key: 'lost',          label: '流失',     color: '#ef4444', category: 'lost' },
    ],
  },
  beauty: {
    label: '医美行业',
    stages: [
      { key: 'visit',         label: '到店',     color: '#94a3b8', category: 'open' },
      { key: 'consult',       label: '面诊',     color: '#60a5fa', category: 'open' },
      { key: 'plan',          label: '方案',     color: '#a78bfa', category: 'open' },
      { key: 'deal',          label: '成交',     color: '#10b981', category: 'won'  },
      { key: 'post_op',       label: '术后回访', color: '#06b6d4', category: 'won'  },
      { key: 'lost',          label: '流失',     color: '#ef4444', category: 'lost' },
    ],
  },
  b2b: {
    label: 'B2B 企服',
    stages: [
      { key: 'lead',          label: '线索',     color: '#94a3b8', category: 'open' },
      { key: 'mql',           label: 'MQL',      color: '#60a5fa', category: 'open' },
      { key: 'sql',           label: 'SQL',      color: '#8b5cf6', category: 'open' },
      { key: 'poc',           label: 'POC',      color: '#a78bfa', category: 'open' },
      { key: 'negotiation',   label: '商务谈判', color: '#f59e0b', category: 'open' },
      { key: 'closed_won',    label: '赢单',     color: '#10b981', category: 'won'  },
      { key: 'closed_lost',   label: '输单',     color: '#ef4444', category: 'lost' },
    ],
  },
  loan: {
    label: '助贷行业',
    stages: [
      { key: 'new',             label: '新线索',   color: '#94a3b8', category: 'open' },
      { key: 'intent_confirm',  label: '意向确认', color: '#60a5fa', category: 'open' },
      { key: 'credit_check',    label: '征信审核', color: '#f59e0b', category: 'open' },
      { key: 'proposal',        label: '方案报价', color: '#a78bfa', category: 'open' },
      { key: 'submission',      label: '进件报件', color: '#ec4899', category: 'open' },
      { key: 'approval',        label: '银行审批', color: '#06b6d4', category: 'open' },
      { key: 'loan_released',   label: '放款',     color: '#10b981', category: 'won'  },
      { key: 'lost',            label: '流失',     color: '#ef4444', category: 'lost' },
    ],
  },
};

// ========== 服务方法 ==========

/** 获取租户管道配置（含默认值回退） */
export async function getPipelineConfig(tenantId) {
  const tid = requireTenantId(tenantId);
  const row = await PipelineConfig.model.findOne({ where: { tenant_id: tid } });
  if (row) {
    return {
      id: row.id,
      stages: row.stages,
      hasCustom: true,
    };
  }
  return {
    id: null,
    stages: DEFAULT_STAGES,
    hasCustom: false,
  };
}

/** 获取管道列表（仅 open 阶段，用于看板） */
export async function getPipelineStages(tenantId) {
  const config = await getPipelineConfig(tenantId);
  return config.stages;
}

/** 保存/更新管道配置 */
export async function savePipelineConfig(tenantId, stages) {
  const tid = requireTenantId(tenantId);
  if (!Array.isArray(stages) || stages.length < 2) {
    throw Object.assign(new Error('管道至少需要2个阶段'), { status: 400 });
  }

  // 验证每个阶段的必要字段
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (!s.key || !s.label || !s.category) {
      throw Object.assign(new Error(`阶段[${i}]缺少必要字段(key/label/category)`), { status: 400 });
    }
    if (!['open', 'won', 'lost'].includes(s.category)) {
      throw Object.assign(new Error(`阶段[${i}]的category必须是open/won/lost`), { status: 400 });
    }
  }

  // 必须有至少一个收口阶段
  const hasWon = stages.some((s) => s.category === 'won');
  const hasLost = stages.some((s) => s.category === 'lost');
  if (!hasWon && !hasLost) {
    throw Object.assign(new Error('管道至少需要一个成交(won)或流失(lost)收口阶段'), { status: 400 });
  }

  // 自动编号 order
  const normalized = stages.map((s, i) => ({
    key: s.key,
    label: s.label,
    color: s.color || '#94a3b8',
    category: s.category,
    order: i,
  }));

  const [row] = await PipelineConfig.model.upsert({
    tenant_id: tid,
    stages: normalized,
  });

  return { id: row.id, stages: normalized };
}

/** 重置为默认管道 */
export async function resetPipelineConfig(tenantId) {
  const tid = requireTenantId(tenantId);
  await PipelineConfig.model.destroy({ where: { tenant_id: tid } });
  return { stages: DEFAULT_STAGES };
}

/** 获取行业管道模板列表 */
export function getPipelineTemplates() {
  const result = {};
  for (const [key, t] of Object.entries(PIPELINE_TEMPLATES)) {
    result[key] = {
      label: t.label,
      stageCount: t.stages.length,
      stages: t.stages.map((s, i) => ({ ...s, order: i })),
    };
  }
  return result;
}

/** 应用行业管道模板 */
export async function applyPipelineTemplate(tenantId, templateKey) {
  const template = PIPELINE_TEMPLATES[templateKey];
  if (!template) throw Object.assign(new Error('未知管道模板'), { status: 400 });

  return savePipelineConfig(tenantId, template.stages);
}

export { DEFAULT_STAGES, PIPELINE_TEMPLATES };
