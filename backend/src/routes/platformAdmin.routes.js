/**
 * @file 平台方运营后台路由（仅 PLATFORM_ADMIN_USER_IDS）。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePlatformAdmin } from '../middlewares/requirePlatformAdmin.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import * as platformAdminController from '../controllers/platformAdmin.controller.js';
import { contractAttachmentUpload } from '../middlewares/uploadContractAttachment.js';

const router = Router();

router.use(requireAuth);

router.get('/access', asyncHandler(platformAdminController.getAccess));

router.use(requirePlatformAdmin);

router.get('/overview', asyncHandler(platformAdminController.getOverview));
router.get('/mrr-trend', asyncHandler(platformAdminController.getMrrTrend));
router.post('/mrr-snapshots/capture', asyncHandler(platformAdminController.captureMrrSnapshot));
router.post('/mrr-snapshots/backfill', asyncHandler(platformAdminController.backfillMrrSnapshots));
router.get('/churn-risks', asyncHandler(platformAdminController.listChurnRisks));
router.get('/inbox-ai-anomalies', asyncHandler(platformAdminController.listInboxAiAnomalies));
router.post(
  '/churn-risks/schedule-followups',
  asyncHandler(platformAdminController.scheduleChurnFollowups),
);
router.post(
  '/churn-risks/send-reminders',
  asyncHandler(platformAdminController.sendChurnReminderEmails),
);
router.get('/subscriptions/expiring', asyncHandler(platformAdminController.listExpiringSubscriptions));
router.get(
  '/subscriptions/expiring/export',
  asyncHandler(platformAdminController.exportExpiringSubscriptions),
);
router.post(
  '/subscriptions/expiring/schedule-followups',
  asyncHandler(platformAdminController.scheduleExpiringFollowups),
);
router.post(
  '/subscriptions/expiring/send-reminders',
  asyncHandler(platformAdminController.sendExpiringReminderEmails),
);
router.get('/digest/preview', asyncHandler(platformAdminController.getOpsDigestPreview));
router.post('/digest/send', asyncHandler(platformAdminController.sendOpsDigest));

router.get('/ops-followups/due', asyncHandler(platformAdminController.listDueOpsFollowups));
router.post('/ops-followups/:noteId/complete', asyncHandler(platformAdminController.completeOpsFollowup));
router.get('/contract-templates', asyncHandler(platformAdminController.listContractTemplates));
router.post(
  '/tenants/:tenantId/contract-order',
  asyncHandler(platformAdminController.createContractOrder),
);

router.get('/tenants', asyncHandler(platformAdminController.listTenants));
router.get('/tenants/:tenantId', asyncHandler(platformAdminController.getTenant));
router.get(
  '/tenants/:tenantId/inbox-ai-audit-logs',
  asyncHandler(platformAdminController.listTenantInboxAiAuditLogs),
);
router.patch(
  '/tenants/:tenantId/inbox-ai-controls',
  asyncHandler(platformAdminController.patchTenantInboxAiControls),
);
router.get(
  '/tenants/:tenantId/statement/export',
  asyncHandler(platformAdminController.exportTenantStatement),
);
router.post(
  '/tenants/:tenantId/send-reminder',
  asyncHandler(platformAdminController.sendTenantReminderEmail),
);
router.post('/tenants/:tenantId/subscription', asyncHandler(platformAdminController.grantSubscription));
router.post('/tenants/:tenantId/extend-trial', asyncHandler(platformAdminController.extendTrial));
router.get('/tenants/:tenantId/ops-notes', asyncHandler(platformAdminController.listTenantOpsNotes));
router.post('/tenants/:tenantId/ops-notes', asyncHandler(platformAdminController.createTenantOpsNote));

router.get('/payments', asyncHandler(platformAdminController.listPayments));
router.get('/payments/export', asyncHandler(platformAdminController.exportPaymentsReconcile));
router.get(
  '/statements/export',
  asyncHandler(platformAdminController.exportTenantStatementsZip),
);
router.post(
  '/payments/reconcile-email',
  asyncHandler(platformAdminController.sendMonthlyPaymentsReconcileEmail),
);
router.get('/payments/pending', asyncHandler(platformAdminController.listPendingPayments));
router.post('/payments/confirm', asyncHandler(platformAdminController.confirmPayment));

router.get(
  '/payments/:outTradeNo/attachments',
  asyncHandler(platformAdminController.listContractAttachments),
);
router.post(
  '/payments/:outTradeNo/attachments',
  (req, res, next) =>
    contractAttachmentUpload.single('file')(req, res, (err) => {
      if (err) return next(new HttpError(400, err.message || '上传失败', 400));
      return next();
    }),
  asyncHandler(platformAdminController.uploadContractAttachment),
);
router.get(
  '/payments/:outTradeNo/attachments/:attachmentId/download',
  asyncHandler(platformAdminController.downloadContractAttachment),
);

router.get('/promo-codes', asyncHandler(platformAdminController.listPromoCodes));
router.post('/promo-codes', asyncHandler(platformAdminController.createPromoCode));

router.get('/invoice-requests', asyncHandler(platformAdminController.listInvoiceRequests));
router.patch(
  '/invoice-requests/:requestId',
  asyncHandler(platformAdminController.updateInvoiceRequest),
);

export default router;
