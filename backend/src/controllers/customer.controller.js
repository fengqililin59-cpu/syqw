/**
 * @file 客户与跟进记录控制器。
 */
import Joi from 'joi';
import * as customerService from '../services/customer.service.js';
import * as customerTimelineService from '../services/customerTimeline.service.js';
import * as intentScoreService from '../services/intentScore.service.js';
import * as intentAlertService from '../services/intentAlert.service.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';

const scoreIntentBodySchema = Joi.object({
  force: Joi.boolean().optional(),
}).unknown(false);

export async function list(req, res) {
  const data = await customerService.listCustomers(req.auth, req.query);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await customerService.createCustomer(req.auth, req.body);
  return ok(res, data, '创建成功');
}

export async function detail(req, res) {
  const data = await customerService.getCustomer(req.auth, req.params.id);
  return ok(res, data);
}

export async function intentPlaybook(req, res) {
  const data = await intentAlertService.getCustomerIntentPlaybook(req.auth, req.params.id);
  return ok(res, data);
}

export async function getByExternalUserId(req, res) {
  const data = await customerService.getByExternalUserId(req.auth.tenantId, req.params.externalUserId);
  return ok(res, data);
}

export async function listMessages(req, res) {
  const data = await customerService.listCustomerMessages(req.auth, req.params.id);
  return ok(res, data);
}

export async function update(req, res) {
  const data = await customerService.updateCustomer(req.auth, req.params.id, req.body);
  return ok(res, data, '更新成功');
}

export async function rollbackAutoDeal(req, res) {
  const data = await customerService.rollbackLatestAutoDeal(req.auth, req.params.id, req.body || {}, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '已回滚自动成交');
}

export async function remove(req, res) {
  const data = await customerService.deleteCustomer(req.auth, req.params.id, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '删除成功');
}

export async function listFollowUps(req, res) {
  const data = await customerService.listFollowUps(req.auth, req.params.id);
  return ok(res, data);
}

export async function timeline(req, res) {
  const data = await customerTimelineService.getCustomerTimeline(req.auth, req.params.id, req.query);
  return ok(res, data);
}

export async function createFollowUp(req, res) {
  const data = await customerService.createFollowUp(req.auth, req.params.id, req.body);
  return ok(res, data, '跟进记录已添加');
}

export async function exportList(req, res) {
  const data = await customerService.exportCustomers(req.auth, req.query, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data);
}

export async function importMany(req, res) {
  const data = await customerService.importCustomers(req.auth, req.body);
  return ok(res, data, '导入完成');
}

export async function importPreview(req, res) {
  const data = await customerService.previewImportCustomers(req.auth, req.body);
  return ok(res, data, '预览完成');
}

export async function importCsv(req, res) {
  if (!req.file?.buffer) {
    throw new HttpError(400, '请选择 CSV 文件', 400);
  }
  const data = await customerService.importCustomersFromCsv(req.auth, req.file.buffer);
  return ok(res, data, '导入完成');
}

/**
 * 下载导入模板（含自定义字段列）。
 * GET /customers/import/template
 */
export async function downloadImportTemplate(req, res) {
  const data = await customerService.generateImportTemplate(req.auth);
  return ok(res, data, 'ok');
}

/**
 * 批量操作客户。
 * POST /customers/batch
 */
export async function batchOperate(req, res) {
  const data = await customerService.batchOperateCustomers(req.auth, {
    ...req.body,
    _ip: req.ip,
    _ua: req.headers['user-agent'] || null,
  });
  return ok(res, data, `已${data.affected}个客户执行${req.body.action}`);
}

export async function transfer(req, res) {
  const data = await customerService.transferCustomer(req.auth, req.params.id, req.body);
  return ok(res, data, '转移成功');
}

export async function setTags(req, res) {
  const data = await customerService.setCustomerTags(req.auth, req.params.id, req.body);
  return ok(res, data, '标签已更新');
}

export async function scoreIntent(req, res) {
  if (req.auth?.isGuest || req.auth?.isDemo) {
    return ok(res, {
      intent_score: 88,
      intent_ai_score: 88,
      intent_level: 'high',
      reasoning: '客户多次询问价格与合作细节，近期响应速度明显加快，成交概率高。建议今日跟进，报出方案并推动决策。',
      demo: true,
    }, 'ok');
  }
  const { error, value } = scoreIntentBodySchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await intentScoreService.scoreCustomerIntent(req.auth, Number(req.params.id), {
    force: value.force === true,
  });
  return ok(res, data, 'ok');
}

export async function scoreHistory(req, res) {
  const data = await intentScoreService.listScoreHistory(req.auth, Number(req.params.id), req.query);
  return ok(res, data, 'ok');
}

/**
 * AI 跟进话术生成（复用 aiContent.generateSidebarScripts）。
 * POST /customers/:id/followup-scripts
 */
export async function generateFollowupScripts(req, res) {
  if (req.auth?.isGuest || req.auth?.isDemo) {
    return ok(res, {
      scripts: [
        '您好！上次聊到您对我们系统很感兴趣，最近有没有时间做个详细的演示？这周五下午方便吗？',
        '陈总，我帮您整理了一份对比方案，咱们团队现在用企微的方式，接入我们系统后能省多少重复工作——发您看看？',
        '您好，上次提到的几个顾虑我都有针对性的回复，3 分钟能说清楚，今天有空打个电话吗？',
      ],
      demo: true,
    }, '话术已生成');
  }
  const { generateSidebarScripts } = await import('../services/aiContent.service.js');
  const data = await generateSidebarScripts(req.auth.tenantId, Number(req.params.id));
  return ok(res, data, '话术已生成');
}

/**
 * AI 客户画像摘要（复用 aiContent.generateCustomerSummary）。
 * GET /customers/:id/summary
 */
export async function generateSummary(req, res) {
  const { generateCustomerSummary } = await import('../services/aiContent.service.js');
  const data = await generateCustomerSummary(req.auth.tenantId, Number(req.params.id));
  return ok(res, data, '画像已生成');
}
