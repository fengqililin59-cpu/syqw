/**
 * @file 公域 Webhook 回调（无 JWT）。
 */
import * as publicInboxIngest from '../services/publicInboxIngest.service.js';
import { parseDouyinVerifyChallenge } from '../services/publicWebhookAuth.service.js';
import { ok } from '../utils/response.js';

export async function ingest(req, res) {
  const challenge = parseDouyinVerifyChallenge(req.body);
  if (challenge != null) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(JSON.stringify({ challenge }));
  }

  const token = req.headers['x-inbox-webhook-token'] || req.query.token;
  const data = await publicInboxIngest.ingestPublicWebhook(
    Number(req.params.tenantId),
    req.params.channel,
    req.body,
    {
      legacyToken: typeof token === 'string' ? token : undefined,
      headers: req.headers,
      rawBody: req.rawBody,
    },
  );
  return ok(res, data, 'ok');
}
