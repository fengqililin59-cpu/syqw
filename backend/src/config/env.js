/**
 * @file 环境变量集中读取（.env），供数据库、JWT、CORS 等模块使用。
 * @description 避免在业务代码中散落 process.env，便于部署时统一配置。
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

/** 优先读环境变量 PEM；否则读 ALIPAY_*_PATH 或 certs 下默认文件 */
function readPemFromEnvOrFile(inlineEnv, pathEnv, defaultRelativePath) {
  const inline = (process.env[inlineEnv] || '').trim();
  if (inline) return inline;
  const rel = (process.env[pathEnv] || defaultRelativePath || '').trim();
  if (!rel) return '';
  const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  try {
    if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8').trim();
  } catch {
    /* ignore */
  }
  return '';
}

function buildAdRedirectAllowHosts() {
  const raw = (process.env.AD_REDIRECT_ALLOW_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const fu = (process.env.FRONTEND_URL || '').trim();
    if (fu) {
      const h = new URL(fu).hostname;
      if (h && !raw.includes(h)) {
        raw.push(h);
      }
    }
  } catch {
    /* ignore */
  }
  return raw;
}

/** Vite 端口被占用时会顺延到 5174、5175…，开发环境统一并入 CORS，避免「换端口就登录报 CORS」 */
const DEV_VITE_PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179];

function buildFrontendOrigins() {
  const explicit = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fromUrl = (process.env.FRONTEND_URL || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  const origins = new Set(explicit);
  if (fromUrl) origins.add(fromUrl);

  if (!isProd) {
    for (const p of DEV_VITE_PORTS) {
      origins.add(`http://localhost:${p}`);
      origins.add(`http://127.0.0.1:${p}`);
    }
  }

  if (origins.size === 0) {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return [...origins];
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  /** 前端开发服务器地址，用于 CORS（多个用逗号分隔）；含 FRONTEND_URL 时自动并入 */
  frontendOrigins: buildFrontendOrigins(),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'wework_saas',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_only_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  /** 前端站点根 URL（企微 OAuth 回调后浏览器重定向，含协议与端口） */
  frontendUrl: (process.env.FRONTEND_URL || '').trim() || 'http://localhost:5173',
  /** 管理端对外 URL（用于消息中拼接详情链接） */
  appUrl: (process.env.APP_URL || '').trim() || (process.env.FRONTEND_URL || '').trim() || 'http://localhost:5173',
  /** 租户账单 PDF 中文字体路径（TTF/OTF；TTC 视系统而定） */
  billingPdfFontPath: (process.env.BILLING_PDF_FONT_PATH || '').trim(),
  /**
   * 后端对外可被企微访问的根 URL（不含路径）。
   * 实际回调地址为 `${weworkCallbackBaseUrl}/api/v1/wework/callback`
   */
  weworkCallbackBaseUrl: (process.env.WEWORK_CALLBACK_URL || '').trim() || `http://127.0.0.1:${Number(process.env.PORT) || 3000}`,
  /**
   * 广告监测 302 允许的落地页 hostname（逗号分隔）；默认并入 FRONTEND_URL 的 hostname。
   * 勿填 apex 根域（如 syzs.top）：校验逻辑会放行 *.该域，易误包含其它子域业务站。
   */
  adRedirectAllowHosts: buildAdRedirectAllowHosts(),
  ai: {
    /** DeepSeek OpenAI 兼容接口（文案）；也可用 OPENAI_API_KEY 走通用 Chat Completions */
    deepseekApiKey: (process.env.DEEPSEEK_API_KEY || '').trim(),
    openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
    deepseekBaseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  },
  /** 知识库向量模型（OpenAI 推荐 text-embedding-3-small） */
  kbEmbeddingModel: (process.env.KB_EMBEDDING_MODEL || '').trim(),
  /** 每日企微客户同步定时任务；设为 `0` 关闭（默认开启） */
  enableSyncCustomersCron: process.env.ENABLE_SYNC_CRON !== '0',
  /**
   * 自动跟进扫描（规则 + AI + 企微应用消息提醒负责人）；设为 `1` 开启（默认关闭，避免误发）。
   */
  enableAutomationCron: process.env.ENABLE_AUTOMATION_CRON === '1',
  /** 企微消息入库后异步重算意向分；设为 `1` 开启（默认关闭，避免每条消息都打 AI） */
  scoreOnWeworkMessage: process.env.SCORE_ON_WEWORK_MESSAGE === '1',
  /** 收件箱：客户新消息后自动生成 AI 草稿（默认关闭，消耗 ai_calls 额度） */
  inboxAutoDraft: process.env.INBOX_AUTO_DRAFT === '1',
  /** 自动草稿延迟秒数：给销售留抢答窗口；INBOX_AUTO_DRAFT=1 且未设时默认 30 */
  inboxAutoDraftDelaySec: (() => {
    const raw = process.env.INBOX_AUTO_DRAFT_DELAY_SEC;
    if (raw != null && String(raw).trim() !== '') {
      return Math.max(0, Math.min(120, Number(raw) || 0));
    }
    return process.env.INBOX_AUTO_DRAFT === '1' ? 30 : 0;
  })(),
  /** 收件箱 AI 自动发送总开关（设 INBOX_AI_AUTO_SEND=0 全平台禁用；租户还须开启 inbox_ai_auto_send） */
  inboxAiAutoSendEnabled: process.env.INBOX_AI_AUTO_SEND !== '0',
  /** 自动发送后企微提醒会话负责人（设 INBOX_AI_AUTO_SEND_NOTIFY=0 关闭） */
  inboxAiAutoSendNotify: process.env.INBOX_AI_AUTO_SEND_NOTIFY !== '0',
  /** 每租户每日 AI 自动发送上限（0=不限制，默认 80） */
  inboxAiAutoSendDailyCap: (() => {
    const raw = process.env.INBOX_AI_AUTO_SEND_DAILY_CAP;
    if (raw != null && String(raw).trim() !== '') {
      return Math.max(0, Number(raw) || 0);
    }
    return 80;
  })(),
  /** 每会话每日 AI 自动发送上限（0=不限制，默认 3） */
  inboxAiAutoSendThreadDailyCap: (() => {
    const raw = process.env.INBOX_AI_AUTO_SEND_THREAD_DAILY_CAP;
    if (raw != null && String(raw).trim() !== '') {
      return Math.max(0, Number(raw) || 0);
    }
    return 3;
  })(),
  /** 收件箱风控：客户消息用 LLM 输出结构化 risk（需 API Key；INBOX_AI_RISK_LLM=1） */
  inboxAiRiskLlm: process.env.INBOX_AI_RISK_LLM === '1',
  /** 收件箱 SLA：客户消息后超时未回复，企微应用消息提醒负责人（每 5 分钟） */
  enableInboxSlaCron: process.env.ENABLE_INBOX_SLA_CRON === '1',
  /** 未回复阈值（分钟），默认 30 */
  inboxSlaMinutes: Math.max(5, Number(process.env.INBOX_SLA_MINUTES) || 30),
  /** 计划跟进到期提醒（每 15 分钟扫描 next_follow_at，企微提醒负责人） */
  enableFollowupDueCron: process.env.ENABLE_FOLLOWUP_DUE_CRON === '1',
  /** 工单 SLA：逾期提醒负责人，严重逾期升级管理员（每 10 分钟） */
  enableTicketSlaCron: process.env.ENABLE_TICKET_SLA_CRON === '1',
  /** 工单 SLA 逾期后多久升级管理员（分钟），默认 60 */
  ticketSlaEscalateMinutes: Math.max(15, Number(process.env.TICKET_SLA_ESCALATE_MINUTES) || 60),
  ticketSlaMinutesUrgent: Number(process.env.TICKET_SLA_MINUTES_URGENT) || 0,
  ticketSlaMinutesHigh: Number(process.env.TICKET_SLA_MINUTES_HIGH) || 0,
  ticketSlaMinutesNormal: Number(process.env.TICKET_SLA_MINUTES_NORMAL) || 0,
  ticketSlaMinutesLow: Number(process.env.TICKET_SLA_MINUTES_LOW) || 0,
  /** 公域收件箱 Webhook 密钥（请求头 X-Inbox-Webhook-Token） */
  publicIngestSecret: (process.env.PUBLIC_INBOX_WEBHOOK_SECRET || '').trim(),
  /** API 健康巡检：连续失败企微告警运维（单进程内存计数） */
  enableHealthMonitorCron: process.env.ENABLE_HEALTH_MONITOR_CRON === '1',
  healthMonitorUrl: (process.env.HEALTH_MONITOR_URL || '').trim(),
  healthMonitorTenantId: (() => {
    const n = Number(process.env.HEALTH_MONITOR_TENANT_ID);
    return Number.isFinite(n) && n > 0 ? n : null;
  })(),
  healthMonitorTouser: (process.env.HEALTH_MONITOR_TOUSER || '').trim(),
  healthMonitorFailThreshold: Math.max(1, Number(process.env.HEALTH_MONITOR_FAIL_THRESHOLD) || 2),
  healthMonitorIntervalMin: Math.max(1, Number(process.env.HEALTH_MONITOR_INTERVAL_MIN) || 2),
  healthMonitorAlertCooldownMin: Math.max(5, Number(process.env.HEALTH_MONITOR_ALERT_COOLDOWN_MIN) || 30),
  healthMonitorTimeoutMs: Math.max(3000, Number(process.env.HEALTH_MONITOR_TIMEOUT_MS) || 8000),
  /** 企微 add_external_contact 回调自动创建 CRM 客户；设为 `0` 关闭（默认开启） */
  autoCreateCustomerOnWeworkAdd: process.env.AUTO_CREATE_CUSTOMER_ON_WEWORK_ADD !== '0',
  /**
   * 意向分层联动（评分 → 跟进步骤）；与 ENABLE_AUTOMATION_CRON 独立，需 `ENABLE_INTENT_LINKED_FOLLOWUP=1`。
   */
  enableIntentLinkedFollowup: process.env.ENABLE_INTENT_LINKED_FOLLOWUP === '1',
  /** 流程引擎：延迟节点到期恢复（每分钟）；默认关闭 */
  enableFlowEngineCron: process.env.ENABLE_FLOW_ENGINE_CRON === '1',
  /**
   * 流程「直发客户」企微消息：每租户每分钟上限（内存令牌桶，多实例部署需 Redis 另行替换）。
   */
  autoSendRateLimitPerMinute: Math.max(1, Number(process.env.AUTO_SEND_RATE_LIMIT) || 10),
  /** 群发任务：定时 scheduled 任务到期自动发送（每分钟扫描）；默认关闭 */
  enableBroadcastCron: process.env.ENABLE_BROADCAST_CRON === '1',
  /** 意向预警：每 5 分钟扫描 24 小时内 pending，生成话术并通知销售 */
  enableIntentAlertCron: process.env.ENABLE_INTENT_ALERT_CRON === '1',
  /** 计费：每晚同步 customers/seats 到 usage_stats */
  enableUsageSyncCron: process.env.ENABLE_USAGE_SYNC_CRON === '1',
  /** 计费：订阅到期/临期提醒 */
  enableSubscriptionExpiryCron: process.env.ENABLE_SUBSCRIPTION_EXPIRY_CRON === '1',
  /** 每周一 09:30 企微推送管理员「价值战报」 */
  enableWeeklyDigestCron: process.env.ENABLE_WEEKLY_DIGEST_CRON === '1',
  /** 每日 09:00 企微推送管理员「今日必做」摘要（有待办时） */
  enableTodayActionsCron: process.env.ENABLE_TODAY_ACTIONS_CRON === '1',
  /** 每日 18:00 企微推送管理员「今日 AI 自动回复」摘要（有自动发送时） */
  enableAiAutoReplyDigestCron: process.env.ENABLE_AI_AUTO_REPLY_DIGEST_CRON === '1',
  /** 每日 10:00 活跃流失风险企微提醒 */
  enableChurnAlertCron: process.env.ENABLE_CHURN_ALERT_CRON === '1',
  /** 每日 08:30 平台运营日报（企微 → 平台超管） */
  enablePlatformOpsDigestCron: process.env.ENABLE_PLATFORM_OPS_DIGEST_CRON === '1',
  /** 每月 1 日 09:00 将上月对账 Excel 邮件发给平台运营邮箱 */
  enablePlatformPaymentReconcileCron: process.env.ENABLE_PLATFORM_PAYMENT_RECONCILE_CRON === '1',
  /** 每日 23:55 落库当月 MRR 快照 */
  enablePlatformMrrSnapshotCron: process.env.ENABLE_PLATFORM_MRR_SNAPSHOT_CRON === '1',
  /** 群 SOP：每 5 分钟扫描一次任务 */
  enableGroupSopCron: process.env.ENABLE_GROUP_SOP_CRON === '1',
  /** 腾讯云 TCCC：mock 模式 */
  tccMock: process.env.TCCC_MOCK === '1',
  tcccSdkAppId: (process.env.TCCC_SDK_APP_ID || '').trim(),
  tcccSecretId: (process.env.TCCC_SECRET_ID || '').trim(),
  tcccSecretKey: (process.env.TCCC_SECRET_KEY || '').trim(),
  tcccServerNumber: (process.env.TCCC_SERVER_NUMBER || '').trim(),
  smsMock: process.env.SMS_MOCK === '1',
  enableSmsCron: process.env.ENABLE_SMS_CRON === '1',

  /**
   * 企业注册验证码：`REGISTER_OTP_REQUIRED=1` 时须先调 `/auth/register/send-otp`。
   * 邮箱：配置 SMTP_*；短信：配置 `SMS_WEBHOOK_URL`（POST JSON `{ phone, code, purpose }`）。
   */
  registerOtp: {
    required: process.env.REGISTER_OTP_REQUIRED === '1',
    smtpHost: (process.env.SMTP_HOST || '').trim(),
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpSecure: process.env.SMTP_SECURE === '1' || String(process.env.SMTP_PORT || '') === '465',
    smtpUser: (process.env.SMTP_USER || '').trim(),
    smtpPass: (process.env.SMTP_PASS || '').trim(),
    smtpFrom: (process.env.SMTP_FROM || '').trim(),
    mailSubject: (process.env.REGISTER_OTP_MAIL_SUBJECT || '').trim() || '企微私域 SaaS 注册验证码',
    smsWebhookUrl: (process.env.SMS_WEBHOOK_URL || '').trim(),
    smsWebhookAuth: (process.env.SMS_WEBHOOK_AUTH || '').trim(),
    // 直连阿里云短信（优先级高于 webhook）
    aliyunKeyId: (process.env.REGISTER_OTP_ALIYUN_KEY_ID || '').trim(),
    aliyunKeySecret: (process.env.REGISTER_OTP_ALIYUN_KEY_SECRET || '').trim(),
    aliyunSignName: (process.env.REGISTER_OTP_ALIYUN_SIGN_NAME || '').trim(),
    aliyunTemplateCode: (process.env.REGISTER_OTP_ALIYUN_TEMPLATE_CODE || '').trim(),
  },

  /**
   * 多平台广告转化回传（腾讯 / 巨量 / 百度 / 快手 / 小红书等）。
   * 腾讯凭证与下方 tencentAds 共用 TENCENT_ADS_* 环境变量。
   */
  adConversion: {
    /** 留资成功后自动回传（默认开启；设 AD_CONVERSION_AUTO_ON_LEAD=0 关闭） */
    autoOnLead: (process.env.AD_CONVERSION_AUTO_ON_LEAD ?? '1') !== '0',
    /** 企微加好友后自动回传（默认与留资一致；可单独 AD_CONVERSION_AUTO_ON_WEWORK_ADD=0 关闭） */
    autoOnWeworkAdd:
      (process.env.AD_CONVERSION_AUTO_ON_WEWORK_ADD ??
        process.env.AD_CONVERSION_AUTO_ON_LEAD ??
        '1') !== '0',
    tencent: {
      enabled: process.env.TENCENT_ADS_ENABLED === '1',
      endpoint:
        (process.env.TENCENT_ADS_ENDPOINT || '').trim() ||
        'https://api.e.qq.com/v1.3/attribution/conversion',
      accessToken: (process.env.TENCENT_ADS_ACCESS_TOKEN || '').trim(),
      accountId: (process.env.TENCENT_ADS_ACCOUNT_ID || '').trim(),
    },
    ocean: {
      enabled: process.env.OCEAN_ADS_ENABLED === '1',
      accessToken: (process.env.OCEAN_ADS_ACCESS_TOKEN || '').trim(),
      endpoint: (process.env.OCEAN_ADS_ENDPOINT || '').trim(),
      eventTypeMap: {
        register: '1',
        lead_submit: '3',
        form: '3',
        purchase: '2',
        default: '3',
      },
    },
    baidu: {
      enabled: process.env.BAIDU_ADS_ENABLED === '1',
      token: (process.env.BAIDU_ADS_TOKEN || '').trim(),
      endpoint: (process.env.BAIDU_ADS_ENDPOINT || '').trim(),
      logidUrlBase: (process.env.BAIDU_ADS_LOGID_URL_BASE || process.env.FRONTEND_URL || '').trim(),
    },
    xhs: {
      enabled: process.env.XHS_ADS_ENABLED === '1',
      accessToken: (process.env.XHS_ADS_ACCESS_TOKEN || '').trim(),
      endpoint: (process.env.XHS_ADS_ENDPOINT || '').trim(),
      eventTypeMap: {
        lead_submit: '101',
        form: '101',
        register: '102',
        default: '101',
      },
    },
  },

  /** 腾讯广告归因回传（可选） */
  tencentAds: {
    enabled: process.env.TENCENT_ADS_ENABLED === '1',
    endpoint:
      (process.env.TENCENT_ADS_ENDPOINT || '').trim() ||
      'https://api.e.qq.com/v1.3/attribution/conversion',
    accessToken: (process.env.TENCENT_ADS_ACCESS_TOKEN || '').trim(),
    accountId: (process.env.TENCENT_ADS_ACCOUNT_ID || '').trim(),
    /** 每日定时拉取消耗：需同时配置 TENCENT_ADS_SPEND_SYNC_TENANT_ID */
    spendSyncCronEnabled: process.env.TENCENT_ADS_SPEND_SYNC_CRON === '1',
    spendSyncCronTenantId: (() => {
      const n = Number(process.env.TENCENT_ADS_SPEND_SYNC_TENANT_ID);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
    spendSyncGranularity: (process.env.TENCENT_ADS_SPEND_SYNC_LEVEL || 'advertiser').trim(),
    spendSyncBaseUrl: (process.env.TENCENT_ADS_API_BASE || 'https://api.e.qq.com').trim().replace(/\/$/, ''),
    spendSyncPath: (process.env.TENCENT_ADS_DAILY_REPORT_PATH || '/v1.1/daily_reports/get').trim(),
    spendSyncAdqUpgrade: process.env.TENCENT_ADS_ADQ_UPGRADE === '1',
    /** 新指标体系下消耗字段名可能非 cost，可通过此变量覆盖（如 stat_cost） */
    spendSyncCostField: (process.env.TENCENT_ADS_COST_FIELD || 'cost').trim(),
  },

  /** P2：预聚合读路径 + 队列 Worker；详见 database/029–032、POST /api/v1/ads/jobs */
  aggregation: {
    readFromAgg: process.env.AGG_READ === '1',
    workerCron: process.env.ENABLE_AGG_WORKER_CRON === '1',
    nightlyCron: process.env.ENABLE_AGG_NIGHTLY_CRON === '1',
    workerBatchSize: Math.max(1, Math.min(50, Number(process.env.AGG_WORKER_BATCH) || 5)),
  },

  /** 裂变奖励异步发放队列 */
  campaignReward: {
    workerCron: process.env.ENABLE_CAMPAIGN_REWARD_CRON === '1',
    workerBatchSize: Math.max(1, Math.min(50, Number(process.env.CAMPAIGN_REWARD_BATCH) || 10)),
  },

  /** 平台超管用户 ID（逗号分隔），可确认任意租户收款、创建兑换码、直接开通套餐 */
  platformAdminUserIds: (process.env.PLATFORM_ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0),

  /** 平台运营日报企微发送所用租户（须已配企微）；不设则用首个超管所属租户 */
  platformDigest: {
    tenantId: (() => {
      const n = Number(process.env.PLATFORM_DIGEST_TENANT_ID);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
    /** 额外收件邮箱（逗号分隔）；未设则用 PLATFORM_ADMIN 用户表 email */
    emails: (process.env.PLATFORM_OPS_DIGEST_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
    /** 定时任务是否同时发邮件（需 SMTP_*）；手动发送始终尝试邮件 */
    emailOnCron: process.env.PLATFORM_OPS_DIGEST_EMAIL_ON_CRON !== '0',
    /**
     * 投递渠道：both | email_only | wework_only
     * email_only：定时任务与默认手动发送仅邮件（适合无企微运营团队）
     */
    delivery: (() => {
      const v = (process.env.PLATFORM_OPS_DIGEST_DELIVERY || 'both').trim().toLowerCase();
      if (v === 'email' || v === 'email-only') return 'email_only';
      if (v === 'wework' || v === 'wework-only') return 'wework_only';
      if (['both', 'email_only', 'wework_only'].includes(v)) return v;
      return 'both';
    })(),
  },

  /** 智学 AI 主站（www.syzs.top）账号联通 */
  syzsPlatform: {
    webUrl: (process.env.SYZS_PLATFORM_URL || 'https://www.syzs.top').trim().replace(/\/$/, ''),
    jwtSecret: (process.env.SYZS_PLATFORM_JWT_SECRET || '').trim(),
  },

  /**
   * 微信支付 API v3（Native 扫码）。
   * WECHAT_PAY_MOCK=1：本地模拟下单与 /webhooks/wechat/mock 确认，勿用于生产。
   */
  wechatPay: {
    mock: process.env.WECHAT_PAY_MOCK === '1',
    mchId: (process.env.WECHAT_PAY_MCH_ID || '').trim(),
    appId: (process.env.WECHAT_PAY_APP_ID || '').trim(),
    apiV3Key: (process.env.WECHAT_PAY_API_V3_KEY || '').trim(),
    serialNo: (process.env.WECHAT_PAY_SERIAL_NO || '').trim(),
    privateKeyPath: (process.env.WECHAT_PAY_PRIVATE_KEY_PATH || '').trim(),
    privateKeyPem: (process.env.WECHAT_PAY_PRIVATE_KEY || '').trim(),
    platformCertPem: (process.env.WECHAT_PAY_PLATFORM_CERT || '').trim(),
    notifyBaseUrl: (
      process.env.BILLING_NOTIFY_BASE_URL ||
      process.env.WEWORK_CALLBACK_URL ||
      process.env.APP_URL ||
      ''
    )
      .trim()
      .replace(/\/$/, ''),
    skipSignatureVerify: process.env.WECHAT_PAY_SKIP_SIGNATURE_VERIFY === '1',
  },
  /** 与 WECHAT_PAY_APP_ID 同一公众号，用于 JSAPI 支付 OAuth */
  wechatMp: {
    appSecret: (process.env.WECHAT_MP_APP_SECRET || '').trim(),
  },

  /**
   * 支付宝当面付（trade.precreate）。
   * ALIPAY_MOCK=1：本地模拟下单与 /webhooks/alipay/mock，勿用于生产。
   * ALIPAY_DISABLED=1：生产暂时关闭（计费页不展示、接口拒绝下单）。
   */
  alipay: {
    disabled: process.env.ALIPAY_DISABLED === '1',
    mock: process.env.ALIPAY_MOCK === '1',
    sandbox: process.env.ALIPAY_SANDBOX === '1',
    appId: (process.env.ALIPAY_APP_ID || '').trim(),
    privateKey: readPemFromEnvOrFile(
      'ALIPAY_PRIVATE_KEY',
      'ALIPAY_PRIVATE_KEY_PATH',
      'certs/alipay/app_private_key.pem',
    ),
    publicKey: readPemFromEnvOrFile(
      'ALIPAY_PUBLIC_KEY',
      'ALIPAY_PUBLIC_KEY_PATH',
      'certs/alipay/alipay_public_key.pem',
    ),
    notifyBaseUrl: (
      process.env.BILLING_NOTIFY_BASE_URL ||
      process.env.WEWORK_CALLBACK_URL ||
      process.env.APP_URL ||
      ''
    )
      .trim()
      .replace(/\/$/, ''),
    skipSignatureVerify: process.env.ALIPAY_SKIP_SIGNATURE_VERIFY === '1',
  },
  /** 平台合同 PDF/图片附件存储目录（生产请挂载持久卷） */
  contractUploadDir:
    (process.env.CONTRACT_UPLOAD_DIR || '').trim() ||
    path.join(process.cwd(), 'data', 'contract-attachments'),
};
