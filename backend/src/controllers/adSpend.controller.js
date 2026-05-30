/**
 * @file 广告消耗导入与查询。
 */
import dayjs from 'dayjs';
import * as adSpendService from '../services/adSpend.service.js';
import * as tencentAdsSpendSyncService from '../services/tencentAdsSpendSync.service.js';
import { ok } from '../utils/response.js';

export async function bulkUpsert(req, res) {
  const data = await adSpendService.bulkUpsertSpend(req.auth, req.body || {});
  return ok(res, data);
}

export async function list(req, res) {
  const data = await adSpendService.listSpend({
    tenantId: req.auth.tenantId,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
    platform: String(req.query.platform || ''),
    limit: Number(req.query.limit || 200),
  });
  return ok(res, data);
}

/** 从腾讯广告 Marketing API 同步日报消耗（管理员；与归因共用 ACCESS_TOKEN / ACCOUNT_ID） */
export async function syncTencent(req, res) {
  const body = req.body || {};
  const endDate =
    String(body.end_date || req.query.end_date || '').trim() || dayjs().format('YYYY-MM-DD');
  const startDate =
    String(body.start_date || req.query.start_date || '').trim() ||
    dayjs().subtract(6, 'day').format('YYYY-MM-DD');
  const g = String(body.granularity || req.query.granularity || '').trim().toLowerCase();
  const granularity = g === 'campaign' ? 'campaign' : 'advertiser';
  const data = await tencentAdsSpendSyncService.syncTencentSpendToAdSpendTable({
    tenantId: req.auth.tenantId,
    startDate,
    endDate,
    granularity,
  });
  return ok(res, data);
}
