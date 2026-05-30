/**
 * @file 自动跟进：规则、人工暂停、手动扫描。
 */
import Joi from 'joi';
import * as automationService from '../services/automation.service.js';
import { ok } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin } from '../utils/permissions.js';

const patchRuleSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  enabled: Joi.boolean().optional(),
  trigger_config: Joi.object().optional(),
  action_config: Joi.object().optional(),
}).min(1);

const pauseSchema = Joi.object({
  automation_paused: Joi.boolean().required(),
}).unknown(false);

export async function listRules(req, res) {
  const data = await automationService.listRules(req.auth);
  return ok(res, data, 'ok');
}

export async function patchRule(req, res) {
  if (!isAdmin(req.auth)) {
    throw new HttpError(403, '仅管理员可编辑规则', 403);
  }
  const { error, value } = patchRuleSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await automationService.patchRule(req.auth, Number(req.params.id), value, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, 'ok');
}

export async function bootstrapRules(req, res) {
  if (!isAdmin(req.auth)) {
    throw new HttpError(403, '仅管理员可初始化规则', 403);
  }
  const data = await automationService.bootstrapDefaultRules(req.auth);
  return ok(res, data, 'ok');
}

export async function setCustomerPause(req, res) {
  const { error, value } = pauseSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await automationService.setCustomerAutomationPaused(
    req.auth,
    Number(req.params.customerId),
    value.automation_paused,
  );
  return ok(res, data, 'ok');
}

export async function runScan(req, res) {
  const data = await automationService.triggerAutomationScanOnce(req.auth);
  return ok(res, data, 'ok');
}
