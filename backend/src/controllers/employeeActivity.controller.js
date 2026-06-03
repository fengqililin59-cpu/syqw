/**
 * @file 员工活动监控控制器 + KPI 目标管理 + AI 教练建议
 */
import { getEmployeeActivity } from '../services/employeeActivity.service.js';
import { generateCoachingInsight } from '../services/aiContent.service.js';
import { KpiTarget } from '../models/index.js';

export async function getActivity(req, res, next) {
  try {
    const data = await getEmployeeActivity(req.auth);
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}

/** 获取 KPI 目标列表 */
export async function getKpiTargets(req, res, next) {
  try {
    const { tenantId } = req.auth;
    const rows = await KpiTarget.findAll({
      where: { tenant_id: tenantId },
      order: [['id', 'ASC']],
      raw: true,
    });
    res.json({ code: 0, data: rows });
  } catch (err) {
    next(err);
  }
}

/** 新增/更新 KPI 目标（upsert） */
export async function upsertKpiTarget(req, res, next) {
  try {
    const { tenantId } = req.auth;
    const { id, user_id, dimension, target_value, period } = req.body;
    if (!dimension || !target_value || !period) return res.status(400).json({ code: 400, message: '参数不完整' });

    const payload = {
      tenant_id: tenantId,
      user_id: user_id || null,
      dimension,
      target_value: Number(target_value),
      period: period || 'daily',
    };

    let result;
    if (id) {
      const [n] = await KpiTarget.update(payload, { where: { id, tenant_id: tenantId } });
      if (!n) return res.status(404).json({ code: 404, message: '未找到' });
      result = await KpiTarget.findByPk(id);
    } else {
      result = await KpiTarget.create(payload);
    }
    res.json({ code: 0, data: result });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      // 已存在相同维度，执行 update
      try {
        const { tenantId } = req.auth;
        const { user_id, dimension, target_value, period } = req.body;
        const [n] = await KpiTarget.update(
          { target_value: Number(target_value) },
          { where: { tenant_id: tenantId, user_id: user_id || null, dimension, period: period || 'daily' } }
        );
        const row = await KpiTarget.findOne({
          where: { tenant_id: tenantId, user_id: user_id || null, dimension, period: period || 'daily' },
        });
        return res.json({ code: 0, data: row });
      } catch (e2) { return next(e2); }
    }
    next(err);
  }
}

/** 删除 KPI 目标 */
export async function deleteKpiTarget(req, res, next) {
  try {
    const { tenantId } = req.auth;
    const { id } = req.params;
    const n = await KpiTarget.destroy({ where: { id, tenant_id: tenantId } });
    if (!n) return res.status(404).json({ code: 404, message: '未找到' });
    res.json({ code: 0, message: '已删除' });
  } catch (err) {
    next(err);
  }
}

/** AI 教练建议 */
export async function getCoachingInsight(req, res, next) {
  try {
    const { tenantId } = req.auth;
    const { name, today, yesterday, kpi, trend30, rankings } = req.body;
    if (!name || !today) {
      return res.status(400).json({ code: 400, message: '参数不完整：需要 name 和 today' });
    }
    const data = await generateCoachingInsight(tenantId, {
      name, today, yesterday, kpi, trend30, rankings,
    });
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}
