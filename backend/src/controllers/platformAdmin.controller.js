/**
 * @file 平台方运营后台 API。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../services/auditLog.service.js';
import { isPlatformAdminUserId } from '../utils/platformAdmin.js';
import * as platformAdminService from '../services/platformAdmin.service.js';
import * as billingService from '../services/billing.service.js';
import * as tenantPlatformOpsService from '../services/tenantPlatformOps.service.js';
import * as platformOpsDigestService from '../services/platformOpsDigest.service.js';
import * as platformContractOrderService from '../services/platformContractOrder.service.js';
import * as invoiceRequestService from '../services/invoiceRequest.service.js';
import * as contractAttachmentService from '../services/contractAttachment.service.js';
import * as platformPaymentReconcileService from '../services/platformPaymentReconcile.service.js';
import * as platformMrrSnapshotService from '../services/platformMrrSnapshot.service.js';
import * as platformTenantStatementsExportService from '../services/platformTenantStatementsExport.service.js';
import * as platformTenantReminderEmailService from '../services/platformTenantReminderEmail.service.js';
import * as billingStatementService from '../services/billingStatement.service.js';
import * as platformInboxAiAnomalyService from '../services/platformInboxAiAnomaly.service.js';

export async function getAccess(req, res) {
  return ok(res, { is_platform_admin: isPlatformAdminUserId(req.auth.userId) });
}

export async function getOverview(req, res) {
  const data = await platformAdminService.getOverview();
  return ok(res, data);
}

export async function getMrrTrend(req, res) {
  const data = await platformAdminService.getMrrTrend(req.query);
  return ok(res, data);
}

export async function captureMrrSnapshot(req, res) {
  const monthKey = req.body?.month_key || req.query?.month_key || undefined;
  const data = await platformMrrSnapshotService.captureMrrSnapshot(monthKey);
  await writeAuditLog(req.auth, {
    action: 'platform_mrr_snapshot_capture',
    targetType: 'platform',
    targetId: data.snapshot_month,
    detail: data,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, 'MRR 快照已保存');
}

export async function backfillMrrSnapshots(req, res) {
  const months = Number(req.body?.months ?? req.query?.months) || 12;
  const data = await platformMrrSnapshotService.backfillMrrSnapshots(months);
  await writeAuditLog(req.auth, {
    action: 'platform_mrr_snapshot_backfill',
    targetType: 'platform',
    targetId: 'mrr_snapshots',
    detail: data,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '补录完成');
}

export async function listChurnRisks(req, res) {
  const data = await platformAdminService.listChurnRiskTenants(req.query);
  return ok(res, data);
}

export async function listInboxAiAnomalies(req, res) {
  const data = await platformInboxAiAnomalyService.listInboxAiAnomalyTenants(req.query);
  return ok(res, data);
}

export async function sendChurnReminderEmails(req, res) {
  const body = { ...(req.query || {}), ...(req.body || {}) };
  const data = await platformTenantReminderEmailService.sendChurnRiskReminderEmails(
    req.auth.userId,
    body,
  );
  await writeAuditLog(req.auth, {
    action: 'platform_churn_send_reminder_emails',
    targetType: 'platform',
    targetId: 'churn_risks',
    detail: {
      sent: data.sent,
      skipped: data.skipped,
      no_email: data.no_email,
      failed: data.failed,
      dry_run: data.dry_run,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const msg = data.dry_run
    ? `预览：将向 ${data.would_send} 家发送（跳过 ${data.skipped}，无邮箱 ${data.no_email}）`
    : `已发送 ${data.sent} 封（跳过 ${data.skipped}，无邮箱 ${data.no_email}，失败 ${data.failed}）`;
  return ok(res, data, msg);
}

export async function scheduleChurnFollowups(req, res) {
  const body = { ...(req.query || {}), ...(req.body || {}) };
  const data = await platformAdminService.scheduleChurnRenewalFollowups(req.auth.userId, body);
  await writeAuditLog(req.auth, {
    action: 'platform_churn_schedule_followups',
    targetType: 'platform',
    targetId: 'churn_risks',
    detail: {
      created: data.created,
      skipped: data.skipped,
      critical_only: data.critical_only,
      level_filter: data.level_filter,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, `已为 ${data.created} 家创建回访任务${data.skipped ? `，跳过 ${data.skipped} 家` : ''}`);
}

export async function listExpiringSubscriptions(req, res) {
  const data = await platformAdminService.listExpiringSubscriptions(req.query);
  return ok(res, data);
}

export async function sendExpiringReminderEmails(req, res) {
  const body = { ...(req.query || {}), ...(req.body || {}) };
  const data = await platformTenantReminderEmailService.sendExpiringSubscriptionReminderEmails(
    req.auth.userId,
    body,
  );
  await writeAuditLog(req.auth, {
    action: 'platform_expiring_send_reminder_emails',
    targetType: 'platform',
    targetId: 'subscriptions_expiring',
    detail: {
      sent: data.sent,
      skipped: data.skipped,
      no_email: data.no_email,
      failed: data.failed,
      dry_run: data.dry_run,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const msg = data.dry_run
    ? `预览：将向 ${data.would_send} 家发送（跳过 ${data.skipped}，无邮箱 ${data.no_email}）`
    : `已发送 ${data.sent} 封（跳过 ${data.skipped}，无邮箱 ${data.no_email}，失败 ${data.failed}）`;
  return ok(res, data, msg);
}

export async function scheduleExpiringFollowups(req, res) {
  const body = { ...(req.query || {}), ...(req.body || {}) };
  const data = await platformAdminService.scheduleExpiringRenewalFollowups(req.auth.userId, body);
  await writeAuditLog(req.auth, {
    action: 'platform_expiring_schedule_followups',
    targetType: 'platform',
    targetId: 'subscriptions_expiring',
    detail: {
      days: data.days,
      created: data.created,
      skipped: data.skipped,
      urgency_only: data.urgency_only,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, `已为 ${data.created} 家创建回访任务${data.skipped ? `，跳过 ${data.skipped} 家` : ''}`);
}

export async function exportExpiringSubscriptions(req, res) {
  const result = await platformAdminService.exportExpiringSubscriptionsCsv(req.query);
  await writeAuditLog(req.auth, {
    action: 'platform_expiring_subscriptions_export',
    targetType: 'platform',
    targetId: 'subscriptions_expiring',
    detail: { days: result.days, total: result.total },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const encoded = encodeURIComponent(result.filename);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  return res.send(`\uFEFF${result.csv}`);
}

export async function listTenantOpsNotes(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const data = await tenantPlatformOpsService.listTenantOpsNotes(tenantId);
  return ok(res, data);
}

export async function getOpsDigestPreview(req, res) {
  const data = await platformOpsDigestService.getPlatformOpsDigestPreview();
  return ok(res, data);
}

export async function sendOpsDigest(req, res) {
  const channels = req.body?.channels;
  const data = await platformOpsDigestService.sendPlatformOpsDigest({
    channels,
    forceEmail: true,
  });
  await writeAuditLog(req.auth, {
    action: 'platform_ops_digest_send',
    targetType: 'platform',
    targetId: 'digest',
    detail: {
      channels: channels || data.delivery_mode,
      wework_sent: data.wework?.sent,
      email_sent: data.email?.sent,
      stats: data.wework?.stats,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const parts = [];
  if (data.wework?.sent) parts.push(`企微 ${data.wework.sent} 人`);
  if (data.email?.sent) parts.push(`邮件 ${data.email.sent} 封`);
  return ok(res, data, parts.length ? `已发送：${parts.join('，')}` : '未成功发送（请检查企微与 SMTP 配置）');
}

export async function listDueOpsFollowups(req, res) {
  const data = await tenantPlatformOpsService.listDueOpsFollowups(req.query);
  return ok(res, data);
}

export async function completeOpsFollowup(req, res) {
  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId)) throw new HttpError(400, '备注 ID 无效', 400);
  const data = await tenantPlatformOpsService.completeOpsFollowup(noteId);
  await writeAuditLog(req.auth, {
    action: 'platform_ops_followup_done',
    targetType: 'tenant_platform_ops_note',
    targetId: String(noteId),
    detail: {},
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '已标记完成');
}

export async function createTenantOpsNote(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const row = await tenantPlatformOpsService.createTenantOpsNote(tenantId, req.auth.userId, req.body || {});
  await writeAuditLog(req.auth, {
    action: 'platform_ops_note',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: { note_type: row.note_type, note_id: row.id },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, row, '备注已保存');
}

export async function listContractTemplates(req, res) {
  const data = await platformContractOrderService.listContractOrderTemplatesWithPricing();
  return ok(res, data);
}

export async function createContractOrder(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const data = await platformContractOrderService.createPlatformContractOrder(tenantId, req.body || {});
  await writeAuditLog(req.auth, {
    action: 'platform_contract_order',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: {
      template_id: data.template_id,
      contract_no: data.contract_no,
      out_trade_no: data.out_trade_no,
      confirmed: data.confirmed,
      amount: data.amount,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, data.confirmed ? '已开单并开通' : '已创建待确认订单');
}

export async function listTenants(req, res) {
  const data = await platformAdminService.listTenants(req.query);
  return ok(res, data);
}

export async function getTenant(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const data = await platformAdminService.getTenantDetail(tenantId);
  return ok(res, data);
}

export async function listTenantInboxAiAuditLogs(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const data = await platformAdminService.listTenantInboxAiAuditLogs(tenantId, req.query);
  return ok(res, data);
}

export async function patchTenantInboxAiControls(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const disabled = Boolean(req.body?.inbox_ai_platform_disabled);
  const data = await platformAdminService.setTenantInboxAiPlatformControl(tenantId, {
    inbox_ai_platform_disabled: disabled,
  });
  await writeAuditLog(
    { tenantId, userId: req.auth.userId },
    {
      action: disabled ? 'platform_inbox_ai_disabled' : 'platform_inbox_ai_enabled',
      targetType: 'tenant',
      targetId: String(tenantId),
      detail: data,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    },
  );
  return ok(res, data, disabled ? '已关停该企业 AI 自动发送' : '已恢复该企业 AI 自动发送');
}

export async function exportTenantStatement(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const months = Number(req.query.months) || 12;
  const month = req.query.month ? String(req.query.month) : undefined;
  const format = String(req.query.format || 'pdf').toLowerCase();
  const baseOpts = { tenantId, months, month };

  if (format === 'pdf') {
    const { buffer, filename, period_label, bill_no, tenant_name } =
      await billingStatementService.buildSubscriptionStatementPdf(baseOpts);
    await writeAuditLog(req.auth, {
      action: 'platform_tenant_statement_export',
      targetType: 'tenant',
      targetId: String(tenantId),
      detail: { format: 'pdf', month: month || null, period_label, bill_no },
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    return res.send(buffer);
  }

  const { html, filename, period_label, bill_no, tenant_name } =
    await billingStatementService.buildSubscriptionStatementHtml(baseOpts);
  await writeAuditLog(req.auth, {
    action: 'platform_tenant_statement_export',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: { format: 'html', month: month || null, period_label, bill_no, tenant_name },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const encoded = encodeURIComponent(filename);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  return res.send(html);
}

export async function sendTenantReminderEmail(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const kind = String(req.body?.kind || req.query?.kind || '').toLowerCase();
  if (kind !== 'expiring' && kind !== 'churn') {
    throw new HttpError(400, 'kind 须为 expiring 或 churn', 400);
  }
  const opts = { ...(req.query || {}), ...(req.body || {}) };
  const data =
    kind === 'churn'
      ? await platformTenantReminderEmailService.sendChurnReminderForTenant(
          req.auth.userId,
          tenantId,
          opts,
        )
      : await platformTenantReminderEmailService.sendExpiringReminderForTenant(
          req.auth.userId,
          tenantId,
          opts,
        );

  await writeAuditLog(req.auth, {
    action: kind === 'churn' ? 'platform_tenant_churn_reminder_email' : 'platform_tenant_expiring_reminder_email',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: data,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });

  if (data.skipped) return ok(res, data, data.reason || '已跳过');
  if (data.no_email) return ok(res, data, '该租户暂无管理员邮箱（需 settings:manage 权限账号）');
  return ok(res, data, `已发送至 ${data.email}`);
}

export async function grantSubscription(req, res) {
  const tenantId = Number(req.params.tenantId);
  const { plan_code, billing_cycle = 'yearly' } = req.body || {};
  if (!plan_code) throw new HttpError(400, '请选择套餐', 400);
  const data = await platformAdminService.grantTenantSubscription(tenantId, plan_code, billing_cycle);
  await writeAuditLog(req.auth, {
    action: 'platform_grant_subscription',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: { plan_code, billing_cycle },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data);
}

export async function extendTrial(req, res) {
  const tenantId = Number(req.params.tenantId);
  const { days = 14 } = req.body || {};
  const data = await platformAdminService.extendTenantProTrial(tenantId, days);
  await writeAuditLog(req.auth, {
    action: 'platform_extend_trial',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: { days },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data);
}

export async function listPayments(req, res) {
  const data = await platformAdminService.listAllPayments(req.query);
  return ok(res, data);
}

export async function sendMonthlyPaymentsReconcileEmail(req, res) {
  const month = req.body?.month || req.query?.month;
  const data = await platformPaymentReconcileService.sendMonthlyPaymentReconcileEmail({ month });
  await writeAuditLog(req.auth, {
    action: 'platform_payments_reconcile_email',
    targetType: 'platform',
    targetId: 'payments',
    detail: { month: data.month, sent: data.sent, skipped: data.skipped },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  if (data.skipped) {
    return ok(res, data, `未发送：${data.skipped}`);
  }
  return ok(res, data, data.sent > 0 ? `已发送 ${data.sent} 封邮件` : '未成功发送');
}

export async function exportTenantStatementsZip(req, res) {
  const month = req.query.month ? String(req.query.month) : '';
  const scope = req.query.scope ? String(req.query.scope) : 'paid_in_month';
  const limit = Number(req.query.limit) || 50;
  const tenantIdsRaw = req.query.tenant_ids ? String(req.query.tenant_ids) : '';
  const tenantIds = tenantIdsRaw
    ? tenantIdsRaw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((id) => id > 0)
    : undefined;

  const result = await platformTenantStatementsExportService.buildPlatformTenantStatementsZip({
    month,
    scope,
    maxTenants: limit,
    tenantIds,
  });

  await writeAuditLog(req.auth, {
    action: 'platform_tenant_statements_export',
    targetType: 'platform',
    targetId: month,
    detail: {
      scope: result.scope,
      success_count: result.success_count,
      failed_count: result.failed_count,
      total_matched: result.total_matched,
      truncated: result.truncated,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });

  const encoded = encodeURIComponent(result.filename);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  res.setHeader('X-Export-Success-Count', String(result.success_count));
  res.setHeader('X-Export-Failed-Count', String(result.failed_count));
  res.setHeader('X-Export-Truncated', result.truncated ? '1' : '0');
  return res.send(result.buffer);
}

export async function exportPaymentsReconcile(req, res) {
  const result = await platformPaymentReconcileService.buildPaymentsReconcileExport(req.query);
  await writeAuditLog(req.auth, {
    action: 'platform_payments_export',
    targetType: 'platform',
    targetId: 'payments',
    detail: {
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
      format: result.format,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const encoded = encodeURIComponent(result.filename);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  if (result.format === 'xlsx') {
    return res.send(result.buffer);
  }
  return res.send(`\uFEFF${result.csv}`);
}

export async function listPendingPayments(req, res) {
  const data = await billingService.listAllPendingPayments();
  return ok(res, data);
}

export async function confirmPayment(req, res) {
  const { out_trade_no } = req.body || {};
  if (!out_trade_no) throw new HttpError(400, '缺少订单号', 400);
  const result = await billingService.confirmPayment(out_trade_no);
  await writeAuditLog(req.auth, {
    action: 'payment_confirm',
    targetType: 'payment_record',
    targetId: String(out_trade_no),
    detail: { out_trade_no, tenant_id: result.tenant_id },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, result);
}

export async function listPromoCodes(req, res) {
  const rows = await billingService.listPromoCodes();
  return ok(res, rows);
}

export async function createPromoCode(req, res) {
  const row = await billingService.createPromoCode(req.auth.userId, req.body || {});
  await writeAuditLog(req.auth, {
    action: 'promo_create',
    targetType: 'billing_promo_code',
    targetId: String(row.id),
    detail: { code: row.code, plan: row.plan?.code },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, row);
}

export async function listInvoiceRequests(req, res) {
  const data = await invoiceRequestService.listPlatformInvoiceRequests(req.query);
  return ok(res, data);
}

export async function listContractAttachments(req, res) {
  const data = await contractAttachmentService.listContractAttachments(req.params.outTradeNo);
  return ok(res, data);
}

export async function uploadContractAttachment(req, res) {
  const data = await contractAttachmentService.saveContractAttachment(req.auth, req.params.outTradeNo, req.file);
  await writeAuditLog(req.auth, {
    action: 'contract_attachment_upload',
    targetType: 'payment_record',
    targetId: req.params.outTradeNo,
    detail: { attachment_id: data.id, name: data.original_name },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data, '附件已上传');
}

export async function downloadContractAttachment(req, res) {
  const { row, disk } = await contractAttachmentService.getContractAttachmentFile(
    req.params.outTradeNo,
    req.params.attachmentId,
  );
  const encoded = encodeURIComponent(row.original_name);
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  return res.sendFile(disk);
}

export async function updateInvoiceRequest(req, res) {
  const row = await invoiceRequestService.updatePlatformInvoiceRequest(req.params.requestId, req.body);
  await writeAuditLog(req.auth, {
    action: 'invoice_request_update',
    targetType: 'billing_invoice_request',
    targetId: String(row.id),
    detail: { status: row.status, tenant_id: row.tenant_id },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, row);
}
