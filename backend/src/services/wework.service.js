/**
 * @file 企业微信 API：access_token 缓存、扫码回调换 userid、OAuth state JWT。
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { QueryTypes, Transaction } from 'sequelize';
import { sequelize, WeworkToken } from '../models/index.js';

const TOKEN_LOCK_TIMEOUT_SEC = 3;

const QR_STATE_PURPOSE = 'wework_qr_login';

/**
 * 扫码 OAuth state（短 JWT，5 分钟）
 * @param {number} tenantId
 */
export function signWeworkQrState(tenantId) {
  return jwt.sign(
    { purpose: QR_STATE_PURPOSE, tenant_id: Number(tenantId), n: crypto.randomBytes(8).toString('hex') },
    env.jwt.secret,
    { expiresIn: '5m' },
  );
}

/**
 * @param {string} stateToken
 * @returns {number} tenant_id
 */
export function verifyWeworkQrState(stateToken) {
  const payload = jwt.verify(stateToken, env.jwt.secret);
  if (payload.purpose !== QR_STATE_PURPOSE) {
    throw new Error('invalid state');
  }
  return Number(payload.tenant_id);
}

async function queryNamedLock(lockName, transaction) {
  const rows = await sequelize.query('SELECT GET_LOCK(:name, :timeout) AS locked', {
    replacements: { name: lockName, timeout: TOKEN_LOCK_TIMEOUT_SEC },
    type: QueryTypes.SELECT,
    transaction,
  });
  return Number(rows?.[0]?.locked || 0) === 1;
}

async function releaseNamedLock(lockName, transaction) {
  await sequelize.query('SELECT RELEASE_LOCK(:name) AS released', {
    replacements: { name: lockName },
    type: QueryTypes.SELECT,
    transaction,
  });
}

async function readValidTokenFromDb(tenantId, transaction = null) {
  const rows = await sequelize.query(
    `SELECT access_token
       FROM wework_tokens
      WHERE tenant_id = :tenantId
        AND expires_at > DATE_ADD(NOW(), INTERVAL 5 MINUTE)
      LIMIT 1`,
    {
      replacements: { tenantId: Number(tenantId) },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  const token = rows?.[0]?.access_token;
  return token ? String(token) : null;
}

async function readValidTicketsFromDb(tenantId, transaction = null) {
  const rows = await sequelize.query(
    `SELECT jsapi_ticket, agent_jsapi_ticket
       FROM wework_tokens
      WHERE tenant_id = :tenantId
        AND jsapi_ticket_expires_at > DATE_ADD(NOW(), INTERVAL 5 MINUTE)
        AND agent_jsapi_ticket_expires_at > DATE_ADD(NOW(), INTERVAL 5 MINUTE)
      LIMIT 1`,
    {
      replacements: { tenantId: Number(tenantId) },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  const row = rows?.[0] || null;
  if (!row?.jsapi_ticket || !row?.agent_jsapi_ticket) return null;
  return {
    jsapiTicket: String(row.jsapi_ticket),
    agentJsapiTicket: String(row.agent_jsapi_ticket),
  };
}

async function fetchTokenFromWework(tenant) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(tenant.wework_corp_id)}&corpsecret=${encodeURIComponent(tenant.wework_secret)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(data.errmsg || '获取 access_token 失败');
  }
  const expiresInSec = Math.max(300, Number(data.expires_in) || 7200);
  const expiresAt = new Date(Date.now() + (expiresInSec - 300) * 1000);
  // 只更新 token 字段，不覆盖 JS-SDK ticket 字段（它们由 getJsapiTickets 独立管理，使用不同的锁）
  const [affectedRows] = await WeworkToken.update(
    { access_token: String(data.access_token), expires_at: expiresAt },
    { where: { tenant_id: Number(tenant.id) } },
  );
  if (affectedRows === 0) {
    // 首次：行不存在，创建
    await WeworkToken.create({
      tenant_id: Number(tenant.id),
      access_token: String(data.access_token),
      expires_at: expiresAt,
    });
  }
  return String(data.access_token);
}

/**
 * 获取企业微信 access_token（MySQL 跨进程缓存 + 命名锁）
 * @param {{ id: number; wework_corp_id?: string | null; wework_secret?: string | null }} tenant
 */
export async function getAccessToken(tenant) {
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
    throw new Error('企业微信应用 Secret 未配置');
  }

  // ① 先读 DB：有效期需晚于 NOW()+5 分钟
  const cached = await readValidTokenFromDb(tenant.id);
  if (cached) return cached;

  const lockName = `wt_${Number(tenant.id)}`;
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (transaction) => {
      // ② 尝试获取锁（最多 3 秒）
      const locked = await queryNamedLock(lockName, transaction);
      if (!locked) {
        // 锁超时：另一个进程正在刷新，短暂等待后重试读库（带过期检查）
        await new Promise(r => setTimeout(r, 500));
        const retryRead = await readValidTokenFromDb(tenant.id);
        if (retryRead) return retryRead;
        throw new Error('获取企业微信 access_token 失败：锁超时且无有效缓存');
      }
      try {
        // ③ 锁内二次读，避免等锁期间重复刷新
        const lockedRead = await readValidTokenFromDb(tenant.id, transaction);
        if (lockedRead) return lockedRead;
        // ④ ⑤ 远端刷新并 UPSERT
        const fresh = await fetchTokenFromWework(tenant);
        // ⑦ 返回新 token
        return fresh;
      } finally {
        // ⑥ finally 释放锁，确保必释放
        await releaseNamedLock(lockName, transaction);
      }
    }
  );
}

// ─── 企微 API 通用调用（自动 token 过期重试） ───

const TOKEN_ERROR_CODES = new Set([40014, 42001]);

/**
 * 清除 access_token 缓存（不删除整行，保留 ticket 字段）。
 * 下次 getAccessToken() 会触发远端刷新。
 */
export async function invalidateAccessToken(tenantId) {
  await WeworkToken.update(
    { access_token: '', expires_at: new Date(0) },
    { where: { tenant_id: Number(tenantId) } },
  );
}

/**
 * 带自动 token 重试的企微 API 调用。
 *
 * 当 WeWork 返回 errcode 40014（invalid token）或 42001（token expired）时，
 * 自动清除缓存、重新获取 token，然后重试一次。
 *
 * @param {object} tenant - 租户对象（需含 id, wework_corp_id, wework_secret）
 * @param {(token: string) => Promise<{errcode: number; [key: string]: any}>} apiCall
 *   接收 access_token，返回含 errcode 的 JSON 响应
 * @returns {Promise<{errcode: number; [key: string]: any}>} WeWork API 响应
 */
export async function callWeworkApi(tenant, apiCall) {
  const token = await getAccessToken(tenant);
  const result = await apiCall(token);

  if (!TOKEN_ERROR_CODES.has(Number(result.errcode))) {
    return result;
  }

  // Token 被 WeWork 服务端作废/过期 → 清缓存 + 强制刷新 + 重试一次
  console.warn(`[wework] errcode ${result.errcode}，清除缓存并重试 token 刷新`);
  await invalidateAccessToken(tenant.id);
  const freshToken = await getAccessToken(tenant);
  return apiCall(freshToken);
}

async function fetchJsapiTicket(accessToken) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (Number(data.errcode) !== 0 || !data.ticket) {
    throw new Error(`获取 jsapi_ticket 失败: ${data.errmsg || data.errcode || 'unknown'}`);
  }
  return { ticket: String(data.ticket), expiresIn: Math.max(300, Number(data.expires_in) || 7200) };
}

async function fetchAgentJsapiTicket(accessToken) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/ticket/get?type=agent_config&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (Number(data.errcode) !== 0 || !data.ticket) {
    throw new Error(`获取 agent_jsapi_ticket 失败: ${data.errmsg || data.errcode || 'unknown'}`);
  }
  return { ticket: String(data.ticket), expiresIn: Math.max(300, Number(data.expires_in) || 7200) };
}

async function getJsapiTickets(tenant) {
  const cached = await readValidTicketsFromDb(tenant.id);
  if (cached) return cached;

  const lockName = `wtj_${Number(tenant.id)}`;
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (transaction) => {
      const locked = await queryNamedLock(lockName, transaction);
      if (!locked) {
        const degraded = await readValidTicketsFromDb(tenant.id, transaction);
        if (degraded) return degraded;
        throw new Error('获取 jsapi ticket 失败：锁超时且无可用缓存');
      }
      try {
        const lockedRead = await readValidTicketsFromDb(tenant.id, transaction);
        if (lockedRead) return lockedRead;

        const accessToken = await getAccessToken(tenant);
        const [corp, agent] = await Promise.all([fetchJsapiTicket(accessToken), fetchAgentJsapiTicket(accessToken)]);
        const corpExpiresAt = new Date(Date.now() + (corp.expiresIn - 300) * 1000);
        const agentExpiresAt = new Date(Date.now() + (agent.expiresIn - 300) * 1000);

        await WeworkToken.update(
          {
            jsapi_ticket: corp.ticket,
            jsapi_ticket_expires_at: corpExpiresAt,
            agent_jsapi_ticket: agent.ticket,
            agent_jsapi_ticket_expires_at: agentExpiresAt,
          },
          {
            where: { tenant_id: Number(tenant.id) },
            transaction,
          }
        );
        return { jsapiTicket: corp.ticket, agentJsapiTicket: agent.ticket };
      } finally {
        await releaseNamedLock(lockName, transaction);
      }
    }
  );
}

/**
 * 生成企微 JS-SDK 双签名（corp + agentConfig）。
 * @param {{ id: number; wework_corp_id?: string | null; wework_agent_id?: string | null; wework_secret?: string | null }} tenant
 * @param {string} url
 */
export async function getJsSdkSignature(tenant, url) {
  if (!tenant?.wework_corp_id || !tenant?.wework_agent_id || !tenant?.wework_secret) {
    throw new Error('租户未配置企业微信 CorpID/AgentID/Secret');
  }
  const cleanUrl = String(url || '').trim().split('#')[0];
  if (!cleanUrl) throw new Error('缺少签名 URL');

  const { jsapiTicket, agentJsapiTicket } = await getJsapiTickets(tenant);

  const corpNonce = Math.random().toString(36).slice(2);
  const corpTs = Math.floor(Date.now() / 1000);
  const corpRaw = `jsapi_ticket=${jsapiTicket}&noncestr=${corpNonce}&timestamp=${corpTs}&url=${cleanUrl}`;
  const corpSig = crypto.createHash('sha1').update(corpRaw).digest('hex');

  const agentNonce = Math.random().toString(36).slice(2);
  const agentTs = Math.floor(Date.now() / 1000);
  const agentRaw = `jsapi_ticket=${agentJsapiTicket}&noncestr=${agentNonce}&timestamp=${agentTs}&url=${cleanUrl}`;
  const agentSig = crypto.createHash('sha1').update(agentRaw).digest('hex');

  return {
    corpSign: {
      appId: tenant.wework_corp_id,
      timestamp: corpTs,
      nonceStr: corpNonce,
      signature: corpSig,
    },
    agentSign: {
      appId: tenant.wework_corp_id,
      timestamp: agentTs,
      nonceStr: agentNonce,
      signature: agentSig,
      agentId: tenant.wework_agent_id,
    },
  };
}

/**
 * 网页授权：code → userid
 * @param {object} tenant
 * @param {string} code
 */
export async function getUserIdByCode(tenant, code) {
  const data = await callWeworkApi(tenant, async (token) => {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${encodeURIComponent(token)}&code=${encodeURIComponent(code)}`;
    const response = await fetch(url);
    return response.json();
  });

  if (data.errcode !== 0) {
    throw new Error(data.errmsg || '换取用户信息失败');
  }

  return { userid: data.UserId };
}

/**
 * @param {number} tenantId
 */
export async function clearAccessTokenCache(tenantId) {
  try {
    await WeworkToken.destroy({ where: { tenant_id: Number(tenantId) } });
  } catch (e) {
    const code = e?.parent?.code || e?.original?.code;
    if (code === 'ER_NO_SUCH_TABLE') {
      console.warn('[wework] wework_tokens 表不存在，跳过 token 缓存清理（请执行 database/034_wework_tokens.sql）');
      return;
    }
    throw e;
  }
}

/**
 * 自建应用：发送文本消息给指定成员（校验连通性 / 测试）
 * @param {{ id: number; wework_corp_id?: string | null; wework_secret?: string | null; wework_agent_id?: string | null }} tenant
 * @param {{ touser: string; content?: string }} opts
 */
export async function sendAgentTextMessage(tenant, opts) {
  const { touser, content } = opts;
  const agentRaw = tenant.wework_agent_id;
  const agentid = Number(agentRaw);
  if (!agentRaw || Number.isNaN(agentid) || agentid < 1) {
    throw new Error('应用 AgentID 未配置或无效');
  }

  const body = {
    touser,
    msgtype: 'text',
    agentid,
    text: {
      content: content?.trim() || '【SaaS 后台】企业微信 API 连通测试',
    },
    safe: 0,
  };

  const data = await callWeworkApi(tenant, async (token) => {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    return response.json();
  });

  if (data.errcode !== 0) {
    throw new Error(`${data.errmsg || '发送失败'} (errcode: ${data.errcode})`);
  }
  return data;
}
