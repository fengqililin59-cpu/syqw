/**
 * @file AI 教练建议 Controller：列表/详情/生成/忽略/已实施/预览
 */
import * as coachingService from '../services/coaching.service.js';

/** 列表 */
export async function list(req, res, next) {
  try {
    const { tenantId } = req.auth;
    const { userId, coachType, status, priority, limit, offset } = req.query;
    const data = await coachingService.listCoaching(tenantId, {
      userId: userId ? Number(userId) : undefined,
      coachType,
      status,
      priority: priority ? Number(priority) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}

/** 详情 */
export async function get(req, res, next) {
  try {
    const { id } = req.params;
    const rec = await coachingService.getCoaching(id);
    if (!rec) return res.status(404).json({ code: 404, message: '未找到' });
    res.json({ code: 0, data: rec });
  } catch (err) {
    next(err);
  }
}

/** 为指定员工生成教练建议（当天覆盖式） */
export async function generate(req, res, next) {
  try {
    const { tenantId } = req.auth;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ code: 400, message: '缺少 userId' });
    const data = await coachingService.generateCoaching(req.auth, { targetUserId: Number(userId) });
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}

/** 批量生成所有员工 */
export async function generateAll(req, res, next) {
  try {
    const data = await coachingService.generateAllCoaching(req.auth);
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}

/** 预览（不入库） */
export async function preview(req, res, next) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ code: 400, message: '缺少 userId' });
    const data = await coachingService.previewCoaching(req.auth, Number(userId));
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}

/** 忽略 */
export async function dismiss(req, res, next) {
  try {
    const { id } = req.params;
    const { tenantId } = req.auth;
    const ok = await coachingService.dismissCoaching(id, tenantId);
    if (!ok) return res.status(404).json({ code: 404, message: '未找到' });
    res.json({ code: 0, message: '已忽略' });
  } catch (err) {
    next(err);
  }
}

/** 标记为已实施 */
export async function implement(req, res, next) {
  try {
    const { id } = req.params;
    const { tenantId } = req.auth;
    const ok = await coachingService.implementCoaching(id, tenantId);
    if (!ok) return res.status(404).json({ code: 404, message: '未找到' });
    res.json({ code: 0, message: '已标记实施' });
  } catch (err) {
    next(err);
  }
}

/** 教练维度常量 */
export const COACH_TYPES = [
  { value: 'followup', label: '跟进效率' },
  { value: 'call', label: '通话能力' },
  { value: 'deal', label: '成交转化' },
  { value: 'develop', label: '客户开发' },
  { value: 'time', label: '时间管理' },
  { value: 'overall', label: '综合建议' },
];

export async function getCoachTypes(req, res) {
  res.json({ code: 0, data: COACH_TYPES });
}
