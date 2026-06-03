/**
 * @file 加购包HTTP接口。
 */
import * as usageAddonService from '../services/usageAddon.service.js';

export async function listAddonPackages(_req, res) {
  const packages = await usageAddonService.listAddonPackages();
  res.json({ list: packages });
}

export async function getActiveAddons(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const data = await usageAddonService.getActiveAddons(tenantId);
  res.json(data);
}

export async function purchaseAddon(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const { addon_package_id } = req.body || {};
  if (!addon_package_id) return res.status(400).json({ error: '请选择加购包' });

  const addon = await usageAddonService.purchaseAddon(tenantId, Number(addon_package_id));
  res.json({
    id: addon.id,
    resource_type: addon.resource_type,
    quantity: addon.quantity,
    expires_at: addon.expires_at,
  });
}
