/**
 * @file 租户设置控制器。
 */
import * as settingsService from '../services/settings.service.js';
import * as intentAlertService from '../services/intentAlert.service.js';
import * as leadAssignmentService from '../services/leadAssignment.service.js';
import * as publicWebhookSettingsService from '../services/publicWebhookSettings.service.js';
import { getHealthMonitorSnapshot, runHealthMonitorOnce, probeHealthOnce } from '../services/healthMonitor.service.js';
import { ok } from '../utils/response.js';

export async function getWework(req, res) {
  const data = await settingsService.getWeworkSettings(req.auth);
  return ok(res, data);
}

export async function updateWework(req, res) {
  const data = await settingsService.updateWeworkSettings(req.auth, req.body);
  return ok(res, data, '企业微信设置已更新');
}

export async function listAuditLogs(req, res) {
  const data = await settingsService.listAuditLogs(req.auth, req.query);
  return ok(res, data, 'ok');
}

export async function listIntentAlerts(req, res) {
  const data = await intentAlertService.listAlerts(req.auth.tenantId, req.query);
  return ok(res, data, 'ok');
}

export async function getLeadAssignment(req, res) {
  const data = await leadAssignmentService.getLeadAssignmentSettings(req.auth);
  return ok(res, data);
}

export async function updateLeadAssignment(req, res) {
  const data = await leadAssignmentService.updateLeadAssignmentSettings(req.auth, req.body);
  return ok(res, data, '线索分配已更新');
}

export async function getPublicWebhooks(req, res) {
  const data = await publicWebhookSettingsService.getPublicWebhookSettings(req.auth);
  return ok(res, data);
}

export async function updatePublicWebhooks(req, res) {
  const data = await publicWebhookSettingsService.updatePublicWebhookSettings(req.auth, req.body);
  return ok(res, data, '公域 Webhook 验签已更新');
}

export async function previewPublicWebhookSignatures(req, res) {
  const data = await publicWebhookSettingsService.buildSignatureExamples(req.auth, req.body);
  return ok(res, data);
}

export async function getHealthMonitor(req, res) {
  const snapshot = getHealthMonitorSnapshot();
  const probe = await probeHealthOnce();
  return ok(res, { ...snapshot, last_probe: probe });
}

export async function runHealthMonitor(req, res) {
  const data = await runHealthMonitorOnce();
  return ok(res, { ...getHealthMonitorSnapshot(), run: data }, '巡检已执行');
}
