/**
 * @file 巨量引擎表单广告线索 Webhook（无需 JWT，使用签名验证）。
 *
 * 接入路径（在巨量引擎广告主后台填写）：
 *   POST https://your-domain/api/v1/public/ocean-lead/:tenantId
 *
 * 验签方式：复用现有 douyin_client_secret 存储，
 *   X-Douyin-Signature: sha1(client_secret + rawBody)
 *   未配置 client_secret 时退为 legacy token 兜底。
 */
import crypto from 'crypto';
import * as leadCaptureService from '../services/leadCapture.service.js';
import { ok } from '../utils/response.js';
import { getOrCreatePublicWebhookSettings } from '../services/publicWebhookAuth.service.js';
import { env } from '../config/env.js';

const PLATFORM_NAME = '巨量引擎表单';

function sha1(secret, rawBody) {
  return crypto
    .createHash('sha1')
    .update(String(secret || ''))
    .update(typeof rawBody === 'string' ? rawBody : '')
    .digest('hex');
}

function timingSafeEq(a, b) {
  const la = String(a || '').toLowerCase();
  const lb = String(b || '').toLowerCase();
  if (!la || !lb || la.length !== lb.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(la, 'utf8'), Buffer.from(lb, 'utf8'));
  } catch {
    return false;
  }
}

/** 从巨量引擎推送 body 里解析姓名、手机、公司。 */
function parseOceanLeadBody(body) {
  if (!body || typeof body !== 'object') return null;

  // 标准格式：clue_data.telephone / name / company_name
  const d = body.clue_data || body;
  const name =
    d.name || d.customer_name || d.contact_name ||
    findFormField(d.form_detail, ['NAME', '姓名', 'name']) ||
    null;
  const phone =
    d.telephone || d.tel || d.phone || d.mobile ||
    findFormField(d.form_detail, ['MOBILE_PHONE', 'PHONE', '手机', '电话', 'phone', 'tel']) ||
    null;
  const company =
    d.company_name || d.company ||
    findFormField(d.form_detail, ['COMPANY', '公司', 'company']) ||
    null;
  const remark =
    findFormField(d.form_detail, ['REMARK', 'MESSAGE', '备注', '留言']) || null;

  if (!phone) return null;
  return { name, phone, company, remark };
}

function findFormField(fields, types) {
  if (!Array.isArray(fields)) return null;
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    const t = String(f.type || f.name || '').toUpperCase();
    if (types.some((key) => t.includes(key.toUpperCase()))) {
      const v = f.value ?? f.answer ?? null;
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return null;
}

export async function handleOceanLead(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isInteger(tenantId) || tenantId < 1) {
    return res.status(400).json({ code: 400, message: '无效的租户 ID' });
  }

  const rawBody = req.rawBody || '';

  // ── 验签 ─────────────────────────────────────────────────────────────────
  const settings = await getOrCreatePublicWebhookSettings(tenantId);
  const clientSecret = String(settings.douyin_client_secret || '').trim();
  const legacyToken = env.publicIngestSecret || '';
  const sigHeader = String(req.headers['x-douyin-signature'] || '').trim();
  const tokenHeader = String(req.headers['x-token'] || req.query?.token || '').trim();

  let authOk = false;
  if (clientSecret && sigHeader) {
    authOk = timingSafeEq(sha1(clientSecret, rawBody), sigHeader);
  }
  if (!authOk && legacyToken) {
    authOk = timingSafeEq(legacyToken, tokenHeader);
  }
  if (!authOk && !clientSecret && !legacyToken) {
    // 未配置任何密钥时放行（接入调试期）
    authOk = true;
  }
  if (!authOk) {
    return res.status(401).json({ code: 401, message: 'Webhook 签名验证失败' });
  }

  // ── 处理 webhook 验证握手 ─────────────────────────────────────────────────
  const body = req.body || {};
  if (String(body.event || '') === 'verify_webhook') {
    const challenge = body.content?.challenge ?? body.challenge;
    return res.json({ code: 0, challenge });
  }

  // ── 解析线索字段 ──────────────────────────────────────────────────────────
  const lead = parseOceanLeadBody(body);
  if (!lead) {
    return res.status(200).json({ code: 0, message: '非线索事件，已忽略' });
  }

  // ── 复用 H5 留资链路：创建客户 + 分配销售 + 企微通知 ─────────────────────
  await leadCaptureService.submitPublicLead(
    tenantId,
    {
      name: lead.name || '未知',
      phone: lead.phone,
      company: lead.company || null,
      remark: lead.remark || null,
      source: PLATFORM_NAME,
      utm_source: 'ocean',
      landing_from: 'ocean_form',
    },
    { ip: req.ip, userAgent: req.headers['user-agent'] || null },
  );

  return ok(res, { received: true }, '线索已接收');
}
