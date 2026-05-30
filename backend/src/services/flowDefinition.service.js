/**
 * @file 流程定义：保存画布节点/连线（JSON）、列表与 MVP 数量校验。
 */
import Joi from 'joi';
import { sequelize, Flow, FlowNode, FlowEdge } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin } from '../utils/permissions.js';
import { FLOW_TRIGGER_SET } from '../constants/flowTriggers.js';

const NODE_TYPES = ['trigger', 'condition', 'action', 'delay'];

const saveFlowSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  status: Joi.string().valid('draft', 'active', 'paused').optional(),
  nodes: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().trim().max(64).required(),
        type: Joi.string().valid(...NODE_TYPES).required(),
        position: Joi.object({
          x: Joi.number().required(),
          y: Joi.number().required(),
        }).optional(),
        data: Joi.object({
          config: Joi.object().unknown(true).default({}),
        }).optional(),
      }).unknown(true),
    )
    .required(),
  edges: Joi.array()
    .items(
      Joi.object({
        source: Joi.string().trim().max(64).required(),
        target: Joi.string().trim().max(64).required(),
        sourceHandle: Joi.string().valid('yes', 'no').allow(null).optional(),
      }).unknown(true),
    )
    .default([]),
}).unknown(false);

function validateMvpLimits(nodes) {
  const by = { trigger: 0, condition: 0, action: 0, delay: 0 };
  for (const n of nodes) {
    if (by[n.type] != null) by[n.type] += 1;
  }
  if (by.trigger !== 1) {
    throw new HttpError(400, 'MVP：必须有且仅有 1 个触发器节点', 400);
  }
  if (by.condition > 2) throw new HttpError(400, '条件节点最多 2 个', 400);
  if (by.action > 4) throw new HttpError(400, '动作节点最多 4 个', 400);
  if (by.delay > 2) throw new HttpError(400, '延迟节点最多 2 个', 400);
}

function validateTriggerConfig(nodes) {
  const trigger = nodes.find((n) => n.type === 'trigger');
  const triggerType = String(trigger?.data?.config?.type || '').trim();
  if (!triggerType) {
    throw new HttpError(400, '触发器缺少 config.type', 400);
  }
  if (!FLOW_TRIGGER_SET.has(triggerType)) {
    throw new HttpError(400, `不支持的触发器类型: ${triggerType}`, 400);
  }
}

/**
 * @param {unknown[]} nodes
 * @param {unknown[]} edges
 */
function validateEdgeRefs(nodes, edges) {
  const keys = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!keys.has(e.source) || !keys.has(e.target)) {
      throw new HttpError(400, '连线引用了不存在的节点', 400);
    }
  }
}

/**
 * @param {{ userId: number; tenantId: number }} auth
 * @param {{ name: string; status?: string; nodes: unknown[]; edges: unknown[] }} body
 */
export async function saveFlow(auth, flowId, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '仅管理员可配置流程', 403);
  }
  const { error, value } = saveFlowSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  validateMvpLimits(value.nodes);
  validateTriggerConfig(value.nodes);
  validateEdgeRefs(value.nodes, value.edges);

  const t = await sequelize.transaction();
  try {
    let flow;
    if (flowId) {
      flow = await Flow.findOne({
        where: { id: flowId, tenant_id: auth.tenantId },
        transaction: t,
      });
      if (!flow) {
        throw new HttpError(404, '流程不存在', 404);
      }
      await flow.update(
        {
          name: value.name,
          status: value.status ?? flow.status,
        },
        { transaction: t },
      );
    } else {
      flow = await Flow.create(
        {
          tenant_id: auth.tenantId,
          name: value.name,
          status: value.status ?? 'draft',
          created_by: auth.userId,
        },
        { transaction: t },
      );
    }

    await FlowNode.destroy({ where: { flow_id: flow.id }, transaction: t });
    await FlowEdge.destroy({ where: { flow_id: flow.id }, transaction: t });

    await FlowNode.bulkCreate(
      value.nodes.map((n) => ({
        flow_id: flow.id,
        node_key: n.id,
        type: n.type,
        config: n.data?.config ?? {},
        position_x: Math.round(n.position?.x ?? 0),
        position_y: Math.round(n.position?.y ?? 0),
      })),
      { transaction: t },
    );

    await FlowEdge.bulkCreate(
      value.edges.map((e) => ({
        flow_id: flow.id,
        source_key: e.source,
        target_key: e.target,
        branch:
          e.sourceHandle === 'yes' ? 'yes' : e.sourceHandle === 'no' ? 'no' : null,
      })),
      { transaction: t },
    );

    await t.commit();
    return getFlowById(auth, flow.id);
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

/**
 * @param {{ tenantId: number }} auth
 */
export async function listFlows(auth) {
  const rows = await Flow.findAll({
    where: { tenant_id: auth.tenantId },
    order: [['id', 'DESC']],
    attributes: ['id', 'name', 'status', 'created_at', 'updated_at'],
  });
  return { list: rows.map((r) => r.get({ plain: true })) };
}

/**
 * @param {{ tenantId: number }} auth
 * @param {number} id
 */
export async function getFlowById(auth, id) {
  const flow = await Flow.findOne({
    where: { id, tenant_id: auth.tenantId },
    attributes: ['id', 'tenant_id', 'name', 'status', 'created_by', 'created_at', 'updated_at'],
  });
  if (!flow) {
    throw new HttpError(404, '流程不存在', 404);
  }
  const nodeRows = await FlowNode.findAll({ where: { flow_id: id }, order: [['id', 'ASC']] });
  const edgeRows = await FlowEdge.findAll({ where: { flow_id: id }, order: [['id', 'ASC']] });
  const nodes = nodeRows.map((n) => {
    const o = n.get({ plain: true });
    return {
      id: o.node_key,
      type: o.type,
      position: { x: o.position_x, y: o.position_y },
      data: { config: o.config || {} },
    };
  });
  const edges = edgeRows.map((e) => {
    const o = e.get({ plain: true });
    return {
      id: `e${o.id}`,
      source: o.source_key,
      target: o.target_key,
      sourceHandle: o.branch === 'yes' ? 'yes' : o.branch === 'no' ? 'no' : undefined,
    };
  });
  return { ...flow.get({ plain: true }), nodes, edges };
}

/**
 * @param {{ tenantId: number; userId: number }} auth
 * @param {number} id
 */
export async function deleteFlow(auth, id) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '仅管理员可删除流程', 403);
  }
  const n = await Flow.destroy({ where: { id, tenant_id: auth.tenantId } });
  if (!n) {
    throw new HttpError(404, '流程不存在', 404);
  }
  return { deleted: true };
}
