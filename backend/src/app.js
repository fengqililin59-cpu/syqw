/**
 * @file Express 应用入口：中间件、路由挂载、数据库连接与服务启动。
 * @description 前后端分离：API 前缀 /api/v1，静态资源由前端独立部署。
 */
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { sequelize } from './models/index.js';
import apiV1 from './routes/index.js';
import billingRouter from './routes/billing.routes.js';
import groupRouter from './routes/group.routes.js';
import callRouter from './routes/call.routes.js';
import callbackRouter from './routes/callback.routes.js';
import smsRouter from './routes/sms.routes.js';
import { demoModeMiddleware } from './middlewares/demoMode.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { registerSyncCustomersCron } from './jobs/syncCustomers.cron.js';
import { registerAutomationFollowupCron } from './jobs/automationFollowup.cron.js';
import { registerFlowEngineCron } from './jobs/flowEngine.cron.js';
import { registerBroadcastSchedulerCron } from './jobs/broadcastScheduler.cron.js';
import { registerTencentAdsSpendSyncCron } from './jobs/tencentAdsSpendSync.cron.js';
import { registerAggregationWorkerCron } from './jobs/aggregationWorker.cron.js';
import { registerAggregationNightlyCron } from './jobs/aggregationNightly.cron.js';
import { registerCampaignRewardWorkerCron } from './jobs/campaignRewardWorker.cron.js';
import { registerIntentAlertWorkerCron } from './jobs/intentAlertWorker.cron.js';
import { registerUsageSyncCron } from './jobs/usageSync.cron.js';
import { registerSubscriptionExpiryCron } from './jobs/subscriptionExpiry.cron.js';
import { registerGroupSopCron } from './jobs/groupSop.cron.js';
import { registerSmsSchedulerCron } from './jobs/smsScheduler.cron.js';
import { registerInboxSlaReminderCron } from './jobs/inboxSlaReminder.cron.js';
import { registerFollowUpDueReminderCron } from './jobs/followUpDueReminder.cron.js';
import { registerTicketSlaReminderCron } from './jobs/ticketSlaReminder.cron.js';
import { registerHealthMonitorCron } from './jobs/healthMonitor.cron.js';

const app = express();

app.use(
  cors({
    origin: env.frontendOrigins.length ? env.frontendOrigins : true,
    credentials: true,
  })
);
app.use(
  '/api/v1/callback',
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  if (req.query.deep === '1') {
    try {
      await sequelize.authenticate();
      return res.json({ ok: true, service: 'wework-saas-backend', database: true });
    } catch (e) {
      return res.status(503).json({
        ok: false,
        service: 'wework-saas-backend',
        database: false,
        hint: '无法连接 MySQL，请启动数据库并检查 backend/.env（可用 docker compose up -d mysql）',
      });
    }
  }
  res.json({ ok: true, service: 'wework-saas-backend' });
});

app.use('/api/v1/callback', callbackRouter);
// 演示模式中间件（仅在已登录且已挂载 req.user 时生效）
app.use('/api/v1', (req, res, next) => {
  if (req.user) return demoModeMiddleware(req, res, next);
  return next();
});
app.use('/api/v1', apiV1);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/groups', groupRouter);
app.use('/api/v1/calls', callRouter);
app.use('/api/v1/sms', smsRouter);

app.use(errorHandler);

async function main() {
  await sequelize.authenticate();
  app.listen(env.port, () => {
    console.log(`API listening on http://127.0.0.1:${env.port}`);
    console.log(`Base URL: http://127.0.0.1:${env.port}/api/v1`);
    registerSyncCustomersCron();
    registerAutomationFollowupCron();
    registerFlowEngineCron();
    registerBroadcastSchedulerCron();
    registerTencentAdsSpendSyncCron();
    registerAggregationWorkerCron();
    registerAggregationNightlyCron();
    registerCampaignRewardWorkerCron();
    registerIntentAlertWorkerCron();
    registerUsageSyncCron();
    registerSubscriptionExpiryCron();
    registerGroupSopCron();
    registerSmsSchedulerCron();
    registerInboxSlaReminderCron();
    registerFollowUpDueReminderCron();
    registerTicketSlaReminderCron();
    registerHealthMonitorCron();
  });
}

main().catch((e) => {
  console.error('Failed to start:', e);
  if (String(e?.message || '').includes('ECONNREFUSED') || String(e?.message || '').includes('3306')) {
    console.error('\n提示: 未连上 MySQL。请先启动本机 MySQL，或在项目根目录执行: docker compose up -d mysql\n然后确认 backend/.env 中 DB_HOST（本机用 127.0.0.1，容器内后端用 mysql）与 DB_PASSWORD。\n');
  }
  process.exit(1);
});
