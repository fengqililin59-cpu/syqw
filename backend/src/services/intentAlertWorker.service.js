import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { IntentAlert, Customer, User, Tenant } from '../models/index.js';
import { generateCopywriting } from './aiContent.service.js';
import { sendAgentTextMessage } from './wework.service.js';

const FALLBACK_SCRIPT = '暂无推荐话术，请根据客户情况自行判断';

function buildAiPrompt(customer, scoreBefore, scoreAfter) {
  return `你是一名私域销售顾问。
客户信息：姓名「${customer.name || '未命名客户'}」，公司「${customer.company || '未知'}」，
当前阶段「${customer.stage || '未知'}」，意向分从 ${scoreBefore} 升至 ${scoreAfter}。
请生成一条 100 字以内的微信开场白，
要求：自然、不硬销、结合客户阶段给出一个具体的价值点。
只输出消息正文，不要任何解释。`;
}

function buildOwnerMessage({ customer, alert, aiScript }) {
  const appUrl = String(env.appUrl || '').replace(/\/$/, '');
  return `⚡ 意向预警
客户：${customer.name || `#${customer.id}`}
意向分：${alert.score_before} → ${alert.score_after}（+${alert.score_delta}）
建议现在跟进，推荐话术：

${aiScript}

👉 点击查看客户详情：${appUrl}/app/customers/${customer.id}`;
}

async function markStalePendingAsFailed() {
  const [affected] = await IntentAlert.update(
    { status: 'failed', ai_script: '超时未处理' },
    {
      where: {
        status: 'pending',
        created_at: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }
  );
  return Number(affected || 0);
}

export async function runIntentAlertWorkerOnce(batchSize = 10) {
  const stale = await markStalePendingAsFailed();
  const alerts = await IntentAlert.findAll({
    where: {
      status: 'pending',
      created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: [
      { model: Customer, attributes: ['id', 'name', 'company', 'stage'] },
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name', 'wework_userid'] },
      { model: Tenant, attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id'] },
    ],
    order: [['created_at', 'ASC']],
    limit: Math.max(1, Number(batchSize) || 10),
  });

  for (const alertRow of alerts) {
    const alert = alertRow.get({ plain: true });
    const owner = alert.owner;
    const customer = alert.Customer;
    const tenant = alert.Tenant;

    if (!owner?.wework_userid) {
      await alertRow.update({ status: 'failed', ai_script: 'owner 未配置 wework_userid' });
      continue;
    }
    if (!tenant?.wework_corp_id || !tenant?.wework_secret || !tenant?.wework_agent_id) {
      await alertRow.update({ status: 'failed', ai_script: 'tenant 未配置企微应用凭据' });
      continue;
    }
    if (!customer?.id) {
      await alertRow.update({ status: 'failed', ai_script: '客户信息不存在' });
      continue;
    }

    let aiScript = FALLBACK_SCRIPT;
    try {
      aiScript = await generateCopywriting(
        buildAiPrompt(customer, alert.score_before, alert.score_after),
        '私域销售',
        alert.tenant_id,
      );
    } catch (e) {
      console.error('[intent-alert] ai generate failed', e);
    }

    const msgText = buildOwnerMessage({ customer, alert, aiScript });
    try {
      // 注意：预警是发给销售 owner，不是发给客户。
      await sendAgentTextMessage(tenant, { touser: owner.wework_userid, content: msgText });
      await alertRow.update({ status: 'sent', sent_at: new Date(), ai_script: aiScript });
    } catch (e) {
      const reason = String(e?.message || e).slice(0, 1000);
      await alertRow.update({ status: 'failed', ai_script: reason });
    }
  }

  return { stale_failed: stale, processed: alerts.length };
}
