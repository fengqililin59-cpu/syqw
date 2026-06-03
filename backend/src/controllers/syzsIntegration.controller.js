/**
 * @file 智学 AI 平台（syzs.top）账号联通。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import * as syzsIntegration from '../services/syzsIntegration.service.js';

/** 智学 AI 回调：用平台签发的 bridge 登录企微私域（无需已登录） */
export async function exchangeFromSyzs(req, res) {
  const { bridge_token: bridgeToken, bridgeToken: camel } = req.body || {};
  const token = bridgeToken || camel;
  const data = await syzsIntegration.exchangeFromSyzs(token);
  return ok(res, data);
}

/** 已登录私域用户：签发 bridge 跳转智学 AI */
export async function createBridge(req, res) {
  const data = await syzsIntegration.createBridgeForAuthUser(req.auth, req.user);
  return ok(res, data);
}

export async function getStatus(req, res) {
  const data = await syzsIntegration.getLinkStatus(req.auth.tenantId, req.auth.userId);
  return ok(res, data);
}

export async function getConfig(req, res) {
  const configured = Boolean(
    process.env.SYZS_PLATFORM_JWT_SECRET && String(process.env.SYZS_PLATFORM_JWT_SECRET).trim(),
  );
  if (!configured) {
    return ok(res, { enabled: false, message: '未配置 SYZS_PLATFORM_JWT_SECRET' });
  }
  return ok(res, {
    enabled: true,
    platform_url: process.env.SYZS_PLATFORM_URL || 'https://www.syzs.top',
    wework_app_url: process.env.APP_URL || process.env.FRONTEND_URL || '',
  });
}
