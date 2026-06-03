/**
 * @file 审批服务 — 模板管理、提交审批、审批操作。
 */
import { ApprovalTemplate, ApprovalInstance } from '../models/index.js';
import { Op } from 'sequelize';

const MAX_LIMIT = 100;

// ===================== 模板 CRUD =====================

export async function listTemplates(auth, query = {}) {
  const { page = 1, limit = 20, is_active } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * pageSize;

  const where = { tenant_id: auth.tenantId };
  if (is_active !== undefined && is_active !== null && is_active !== '') {
    where.is_active = is_active === 'true' || is_active === true ? 1 : 0;
  }

  const { count, rows } = await ApprovalTemplate.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: pageSize,
  });

  return { items: rows, total: count, page: pageNum, pageSize, totalPages: Math.ceil(count / pageSize) };
}

export async function getTemplate(auth, id) {
  return ApprovalTemplate.findOne({ where: { id, tenant_id: auth.tenantId } });
}

export async function createTemplate(auth, body) {
  const { name, description, steps } = body;
  if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
    const err = new Error('名称和步骤不能为空');
    err.status = 400;
    throw err;
  }
  return ApprovalTemplate.create({
    tenant_id: auth.tenantId,
    name,
    description: description || null,
    steps,
    is_active: body.is_active !== false ? 1 : 0,
    created_by: auth.userId,
  });
}

export async function updateTemplate(auth, id, body) {
  const template = await ApprovalTemplate.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!template) {
    const err = new Error('模板不存在');
    err.status = 404;
    throw err;
  }
  const upd = {};
  if (body.name !== undefined) upd.name = body.name;
  if (body.description !== undefined) upd.description = body.description;
  if (body.steps !== undefined) {
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      const err = new Error('步骤不能为空');
      err.status = 400;
      throw err;
    }
    upd.steps = body.steps;
  }
  if (body.is_active !== undefined) upd.is_active = body.is_active ? 1 : 0;
  return template.update(upd);
}

export async function deleteTemplate(auth, id) {
  const template = await ApprovalTemplate.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!template) {
    const err = new Error('模板不存在');
    err.status = 404;
    throw err;
  }
  // 检查是否有进行中的审批实例
  const activeCount = await ApprovalInstance.count({
    where: { template_id: id, status: 'pending' },
  });
  if (activeCount > 0) {
    const err = new Error('存在进行中的审批单，无法删除模板');
    err.status = 400;
    throw err;
  }
  await template.destroy();
  return { deleted: true };
}

// ===================== 审批实例操作 =====================

/**
 * 提交审批
 */
export async function submitApproval(auth, body) {
  const { template_id, title, related_type, related_id } = body;
  if (!template_id || !title) {
    const err = new Error('模板和标题不能为空');
    err.status = 400;
    throw err;
  }

  const template = await ApprovalTemplate.findOne({
    where: { id: template_id, tenant_id: auth.tenantId, is_active: 1 },
  });
  if (!template) {
    const err = new Error('审批模板不存在或已停用');
    err.status = 404;
    throw err;
  }

  // 冻结步骤快照
  const stepsSnapshot = (template.steps || []).map((step, idx) => ({
    order: idx,
    approver_id: step.approver_id || null,
    approver_role: step.approver_role || null,
    step_name: step.step_name || `第${idx + 1}步`,
    status: idx === 0 ? 'pending' : 'waiting',  // 第一步 pending，其余 waiting
    comment: null,
    action_user_id: null,
    action_at: null,
  }));

  const instance = await ApprovalInstance.create({
    tenant_id: auth.tenantId,
    template_id,
    title,
    applicant_user_id: auth.userId,
    related_type: related_type || null,
    related_id: related_id || null,
    status: 'pending',
    current_step: 0,
    steps_snapshot: stepsSnapshot,
    submitted_at: new Date(),
  });

  return instance;
}

/**
 * 审批通过当前步骤
 */
export async function approveStep(auth, instanceId, comment) {
  const instance = await ApprovalInstance.findOne({
    where: { id: instanceId, tenant_id: auth.tenantId },
  });
  if (!instance) {
    const err = new Error('审批单不存在');
    err.status = 404;
    throw err;
  }
  if (instance.status !== 'pending') {
    const err = new Error('该审批单已结束，无法操作');
    err.status = 400;
    throw err;
  }

  const snapshot = [...instance.steps_snapshot];
  const curStep = instance.current_step;
  const step = snapshot[curStep];

  if (!step) {
    const err = new Error('审批步骤异常');
    err.status = 500;
    throw err;
  }

  // 检查权限：指定审批人 或 角色匹配
  const isApprover = (step.approver_id && step.approver_id === auth.userId) ||
    (step.approver_role && auth.roleCode === step.approver_role);
  // 如果既没有指定审批人也无角色限制，允许任何有审批权限的人操作
  if (step.approver_id || step.approver_role) {
    if (!isApprover) {
      const err = new Error('您不是当前步骤的审批人');
      err.status = 403;
      throw err;
    }
  }

  // 更新当前步骤状态
  step.status = 'approved';
  step.comment = comment || null;
  step.action_user_id = auth.userId;
  step.action_at = new Date().toISOString();
  snapshot[curStep] = step;

  const totalSteps = snapshot.length;
  const nextStep = curStep + 1;

  let newStatus = 'pending';
  let newCurrentStep = curStep;
  let completedAt = null;

  if (nextStep >= totalSteps) {
    // 所有步骤完成
    newStatus = 'approved';
    completedAt = new Date();
  } else {
    // 推进到下一步
    newCurrentStep = nextStep;
    snapshot[nextStep].status = 'pending';
  }

  await instance.update({
    status: newStatus,
    current_step: newCurrentStep,
    steps_snapshot: snapshot,
    completed_at: completedAt,
  });

  return instance.reload();
}

/**
 * 驳回审批
 */
export async function rejectStep(auth, instanceId, comment) {
  const instance = await ApprovalInstance.findOne({
    where: { id: instanceId, tenant_id: auth.tenantId },
  });
  if (!instance) {
    const err = new Error('审批单不存在');
    err.status = 404;
    throw err;
  }
  if (instance.status !== 'pending') {
    const err = new Error('该审批单已结束，无法操作');
    err.status = 400;
    throw err;
  }

  const snapshot = [...instance.steps_snapshot];
  const curStep = instance.current_step;
  const step = snapshot[curStep];

  if (!step) {
    const err = new Error('审批步骤异常');
    err.status = 500;
    throw err;
  }

  const isApprover = (step.approver_id && step.approver_id === auth.userId) ||
    (step.approver_role && auth.roleCode === step.approver_role);
  if (step.approver_id || step.approver_role) {
    if (!isApprover) {
      const err = new Error('您不是当前步骤的审批人');
      err.status = 403;
      throw err;
    }
  }

  step.status = 'rejected';
  step.comment = comment || null;
  step.action_user_id = auth.userId;
  step.action_at = new Date().toISOString();
  snapshot[curStep] = step;

  await instance.update({
    status: 'rejected',
    steps_snapshot: snapshot,
    completed_at: new Date(),
  });

  return instance.reload();
}

/**
 * 撤销审批（仅申请人可操作）
 */
export async function cancelApproval(auth, instanceId) {
  const instance = await ApprovalInstance.findOne({
    where: { id: instanceId, tenant_id: auth.tenantId },
  });
  if (!instance) {
    const err = new Error('审批单不存在');
    err.status = 404;
    throw err;
  }
  if (instance.applicant_user_id !== auth.userId) {
    const err = new Error('只有申请人可以撤销审批');
    err.status = 403;
    throw err;
  }
  if (instance.status !== 'pending') {
    const err = new Error('该审批单已结束，无法撤销');
    err.status = 400;
    throw err;
  }

  await instance.update({ status: 'cancelled', completed_at: new Date() });
  return instance.reload();
}

/**
 * 获取审批单详情
 */
export async function getInstance(auth, id) {
  return ApprovalInstance.findOne({ where: { id, tenant_id: auth.tenantId } });
}

// ===================== 列表查询 =====================

function buildListQuery(auth, query) {
  const { page = 1, limit = 20, status } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * pageSize;
  const where = { tenant_id: auth.tenantId };
  if (status) where.status = status;
  return { pageNum, pageSize, offset, where };
}

function formatPage(rows, count, pageNum, pageSize) {
  return { items: rows, total: count, page: pageNum, pageSize, totalPages: Math.ceil(count / pageSize) };
}

/**
 * 我发起的审批
 */
export async function listMyApplications(auth, query = {}) {
  const { pageNum, pageSize, offset, where } = buildListQuery(auth, query);
  where.applicant_user_id = auth.userId;

  const { count, rows } = await ApprovalInstance.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: pageSize,
  });

  return formatPage(rows, count, pageNum, pageSize);
}

/**
 * 待我审批（当前步骤审批人是我）
 */
export async function listPendingApprovals(auth, query = {}) {
  const { pageNum, pageSize, offset, where } = buildListQuery(auth, query);

  // 找所有 pending 的实例
  const instances = await ApprovalInstance.findAll({
    where: { ...where, status: 'pending' },
    order: [['created_at', 'DESC']],
  });

  // 过滤出当前用户是审批人的
  const myPending = instances.filter((inst) => {
    const snapshot = inst.steps_snapshot || [];
    const step = snapshot[inst.current_step];
    if (!step) return false;
    if (step.approver_id && step.approver_id === auth.userId) return true;
    if (step.approver_role && auth.roleCode === step.approver_role) return true;
    // 无限制步骤：任何人可审批
    if (!step.approver_id && !step.approver_role) return true;
    return false;
  });

  const total = myPending.length;
  const page = myPending.slice(offset, offset + pageSize);

  return formatPage(page, total, pageNum, pageSize);
}

/**
 * 我已处理的审批
 */
export async function listProcessedApprovals(auth, query = {}) {
  const { pageNum, pageSize, offset, where } = buildListQuery(auth, query);

  // 找已结束的实例
  const instances = await ApprovalInstance.findAll({
    where: { ...where, status: { [Op.in]: ['approved', 'rejected', 'cancelled'] } },
    order: [['updated_at', 'DESC']],
  });

  // 过滤出我曾参与的
  const myProcessed = instances.filter((inst) => {
    if (inst.applicant_user_id === auth.userId) return true;
    const snapshot = inst.steps_snapshot || [];
    return snapshot.some((s) => s.action_user_id === auth.userId);
  });

  const total = myProcessed.length;
  const page = myProcessed.slice(offset, offset + pageSize);

  return formatPage(page, total, pageNum, pageSize);
}
