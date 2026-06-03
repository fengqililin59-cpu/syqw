/**
 * @file AI客服监控面板控制器
 */
import { getAiCustomerServiceStats } from '../services/aiCustomerServiceStats.service.js';

export async function getStats(req, res, next) {
  try {
    const data = await getAiCustomerServiceStats(req.auth, req.query);
    res.json({ code: 0, data });
  } catch (err) {
    next(err);
  }
}
