/**
 * @file 进程内健康巡检：连续失败时企微告警运维，恢复后通知。
 */
import { env } from '../config/env.js';
import { Tenant } from '../models/index.js';
import { sendAgentTextMessage } from './wework.service.js';

const state = {
  consecutiveFails: 0,
  alerting: false,
  lastAlertAt: 0,
  lastError: null,
};

function healthUrl() {
  const base = (env.healthMonitorUrl || `http://127.0.0.1:${env.port}`).replace(/\/$/, '');
  return `${base}/health?deep=1`;
}

function alertCooldownMs() {
  return Math.max(5, Number(env.healthMonitorAlertCooldownMin) || 30) * 60 * 1000;
}

function parseTouser() {
  const raw = (env.healthMonitorTouser || '').trim();
  if (!raw) return '';
  return raw
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('|');
}

async function loadNotifyTenant() {
  const tid = Number(env.healthMonitorTenantId);
  if (!Number.isFinite(tid) || tid <= 0) return null;
  return Tenant.findByPk(tid, {
    attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id', 'name'],
  });
}

/**
 * @returns {Promise<{ ok: boolean; database?: boolean; latency_ms: number; error?: string }>}
 */
export async function probeHealthOnce() {
  const url = healthUrl();
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, Number(env.healthMonitorTimeoutMs) || 8000));
  try {
    const res = await fetch(url, { signal: controller.signal });
    const latency_ms = Date.now() - started;
    if (!res.ok) {
      return { ok: false, latency_ms, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    const dbOk = json?.database === true;
    if (!dbOk) {
      return { ok: false, latency_ms, database: false, error: json?.hint || 'database=false' };
    }
    return { ok: true, database: true, latency_ms };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - started,
      error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function notifyOps(subject, lines) {
  const tenant = await loadNotifyTenant();
  const touser = parseTouser();
  if (!tenant?.wework_corp_id || !tenant?.wework_secret || !touser) {
    console.warn('[health-monitor] skip notify: missing tenant wework or HEALTH_MONITOR_TOUSER');
    return { notified: false, reason: 'not_configured' };
  }
  const content = [subject, ...lines].filter(Boolean).join('\n');
  try {
    await sendAgentTextMessage(tenant, { touser, content });
    return { notified: true };
  } catch (e) {
    console.error('[health-monitor] notify failed', e?.message || e);
    return { notified: false, reason: 'send_failed' };
  }
}

/**
 * 执行一次巡检；连续失败达阈值告警，恢复后发送恢复通知。
 */
export async function runHealthMonitorOnce() {
  const threshold = Math.max(1, Number(env.healthMonitorFailThreshold) || 2);
  const probe = await probeHealthOnce();

  if (probe.ok) {
    const wasAlerting = state.alerting;
    state.consecutiveFails = 0;
    state.lastError = null;
    state.alerting = false;
    if (wasAlerting) {
      await notifyOps('【服务恢复】API 健康检查已通过', [
        `URL：${healthUrl()}`,
        `延迟：${probe.latency_ms}ms`,
        `时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      ]);
      return { status: 'recovered', probe };
    }
    return { status: 'ok', probe };
  }

  state.consecutiveFails += 1;
  state.lastError = probe.error || 'unknown';

  if (state.consecutiveFails < threshold) {
    return { status: 'degraded', probe, consecutiveFails: state.consecutiveFails };
  }

  const now = Date.now();
  const shouldAlert = !state.alerting || now - state.lastAlertAt >= alertCooldownMs();
  if (!shouldAlert) {
    return { status: 'alerting_silent', probe, consecutiveFails: state.consecutiveFails };
  }

  state.alerting = true;
  state.lastAlertAt = now;
  const notify = await notifyOps('【服务告警】API 健康检查连续失败', [
    `URL：${healthUrl()}`,
    `连续失败：${state.consecutiveFails} 次`,
    `错误：${state.lastError}`,
    `延迟：${probe.latency_ms}ms`,
    `时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '请检查 PM2、MySQL、端口与 .env（PORT=3010）',
  ]);
  return { status: 'alerted', probe, consecutiveFails: state.consecutiveFails, notify };
}

export function getHealthMonitorSnapshot() {
  return {
    enabled: env.enableHealthMonitorCron,
    url: healthUrl(),
    consecutive_fails: state.consecutiveFails,
    alerting: state.alerting,
    last_error: state.lastError,
    fail_threshold: Math.max(1, Number(env.healthMonitorFailThreshold) || 2),
  };
}
