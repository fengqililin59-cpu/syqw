/**
 * @file 裂变活动 HTTP 入口。
 */
import * as campaignService from '../services/campaign.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await campaignService.listCampaigns(req.auth, req.query);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await campaignService.createCampaign(req.auth, req.body);
  return ok(res, data, '创建成功');
}

export async function getOne(req, res) {
  const data = await campaignService.getCampaign(req.auth, req.params.id);
  return ok(res, data);
}

export async function update(req, res) {
  const data = await campaignService.updateCampaign(req.auth, req.params.id, req.body);
  return ok(res, data, '更新成功');
}

export async function start(req, res) {
  const data = await campaignService.startCampaign(req.auth, req.params.id);
  return ok(res, data, '已启动');
}

export async function pause(req, res) {
  const data = await campaignService.pauseCampaign(req.auth, req.params.id);
  return ok(res, data, '已暂停');
}

export async function end(req, res) {
  const data = await campaignService.endCampaign(req.auth, req.params.id);
  return ok(res, data, '已结束');
}

export async function duplicate(req, res) {
  const data = await campaignService.duplicateCampaign(req.auth, req.params.id);
  return ok(res, data, '已复制');
}

export async function stats(req, res) {
  const data = await campaignService.getCampaignStats(req.auth, req.params.id);
  return ok(res, data);
}

export async function enroll(req, res) {
  const data = await campaignService.enrollCampaign(req.auth, req.params.id, req.body);
  return ok(res, data);
}

export async function getMyEnrollment(req, res) {
  const data = await campaignService.getCampaignEnrollmentForCustomer(
    req.auth,
    req.params.id,
    req.query,
  );
  return ok(res, data);
}

export async function generateInviteCode(req, res) {
  const data = await campaignService.generateInviteCodeAlias(req.auth, req.params.id, req.body);
  return ok(res, data);
}

export async function simulateInvite(req, res) {
  const data = await campaignService.simulateInvite(req.auth, req.params.id, req.body);
  return ok(res, data);
}
