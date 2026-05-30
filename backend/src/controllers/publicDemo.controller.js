import * as dashboardService from '../services/dashboard.service.js';
import * as customerService from '../services/customer.service.js';
import * as intentAlertService from '../services/intentAlert.service.js';
import { ok } from '../utils/response.js';
import { DEMO_TENANT_ID } from '../config/constants.js';

const demoAuth = {
  tenantId: DEMO_TENANT_ID,
  userId: 9999,
  roleName: '管理员',
  legacyRole: 'admin',
  permissions: ['settings:manage', 'customer:view', 'dashboard:view'],
};

export async function stats(req, res) {
  const data = await dashboardService.getStats(demoAuth);
  return ok(res, data);
}

export async function customers(req, res) {
  const data = await customerService.listCustomers(demoAuth, req.query || {});
  return ok(res, data);
}

export async function alerts(req, res) {
  const data = await intentAlertService.listAlerts(DEMO_TENANT_ID, req.query || {});
  return ok(res, data);
}
