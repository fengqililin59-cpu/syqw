/**
 * @file 企微扫码登录：二维码链接、OAuth 回调、测试发消息。
 */
import Joi from 'joi';
import { Tenant, User, Role } from '../models/index.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { signSessionJwt } from '../services/auth.service.js';
import {
  getUserIdByCode,
  getJsSdkSignature,
  sendAgentTextMessage,
  signWeworkQrState,
  verifyWeworkQrState,
} from '../services/wework.service.js';

const testSendSchema = Joi.object({
  userid: Joi.string().trim().min(1).max(64).required(),
  content: Joi.string().trim().max(2048).allow('', null).optional(),
}).unknown(false);

function frontendBase() {
  return env.frontendUrl.replace(/\/$/, '');
}

/**
 * GET /wework/qr-login-url?tenant_id=
 */
export async function qrLoginUrl(req, res) {
  const raw = req.query.tenant_id;
  if (raw == null || raw === '') {
    throw new HttpError(400, '缺少 tenant_id 参数', 400);
  }
  const tenantIdNum = Number(raw);
  if (!Number.isInteger(tenantIdNum) || tenantIdNum < 1) {
    throw new HttpError(400, 'tenant_id 无效', 400);
  }

  const tenant = await Tenant.findByPk(tenantIdNum);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }
  if (!tenant.wework_corp_id || !tenant.wework_agent_id) {
    throw new HttpError(400, '企业微信未配置（CorpID / AgentID）', 400);
  }

  const state = signWeworkQrState(tenantIdNum);
  const apiBase = env.weworkCallbackBaseUrl.replace(/\/$/, '');
  const redirectUri = encodeURIComponent(`${apiBase}/api/v1/wework/callback`);
  const loginUrl = `https://login.work.weixin.qq.com/wwlogin/sso/login?login_type=CorpApp&appid=${encodeURIComponent(tenant.wework_corp_id)}&agentid=${encodeURIComponent(tenant.wework_agent_id)}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;

  return ok(res, { url: loginUrl, state });
}

/**
 * GET /wework/callback?code=&state=
 */
export async function oauthCallback(req, res) {
  const base = frontendBase();
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(302, `${base}/login?error=wework_invalid_params`);
  }

  let tenantId;
  try {
    tenantId = verifyWeworkQrState(state);
  } catch {
    return res.redirect(302, `${base}/login?error=wework_invalid_state`);
  }

  try {
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return res.redirect(302, `${base}/login?error=wework_tenant_not_found`);
    }

    const { userid } = await getUserIdByCode(tenant, code);

    const user = await User.findOne({
      where: {
        tenant_id: tenantId,
        wework_userid: userid,
        status: 1,
      },
      include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] }],
    });

    if (!user) {
      return res.redirect(
        302,
        `${base}/login?error=wework_not_bound&userid=${encodeURIComponent(userid)}`,
      );
    }

    await user.update({ last_login_at: new Date() });

    const token = signSessionJwt(user);
    return res.redirect(302, `${base}/wework/callback#token=${encodeURIComponent(token)}`);
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : 'WeChat Work login failed');
    return res.redirect(302, `${base}/login?error=wework_failed&msg=${msg}`);
  }
}

/**
 * POST /wework/test-send（需登录 + 管理员）
 * Body: { userid, content? } — 使用当前租户库内企微应用配置发文本消息
 */
export async function testSend(req, res) {
  const { error, value } = testSendSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const tenant = await Tenant.findByPk(req.auth.tenantId);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }
  const data = await sendAgentTextMessage(tenant, {
    touser: value.userid,
    content: value.content ?? undefined,
  });
  return ok(res, data, '已发送');
}

/**
 * GET /wework/jssdk-signature?url=
 */
export async function getJssdkSignature(req, res) {
  const url = String(req.query.url || '').trim();
  if (!url) {
    throw new HttpError(400, '缺少 url 参数', 400);
  }
  const tenant = await Tenant.findByPk(req.auth.tenantId);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }
  const data = await getJsSdkSignature(tenant, url);
  return ok(res, data);
}
