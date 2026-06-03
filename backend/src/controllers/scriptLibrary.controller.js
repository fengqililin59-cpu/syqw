/**
 * @file 话术库 HTTP 入口。
 */
import * as scriptLibraryService from '../services/scriptLibrary.service.js';
import * as industryScriptPackService from '../services/industryScriptPack.service.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await scriptLibraryService.listScriptLibraryItems(req.auth, req.query);
  return ok(res, data);
}

export async function categories(req, res) {
  const data = await scriptLibraryService.listScriptLibraryCategories(req.auth);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await scriptLibraryService.createScriptLibraryItem(req.auth, req.body);
  return ok(res, data, '创建成功');
}

export async function update(req, res) {
  const data = await scriptLibraryService.updateScriptLibraryItem(req.auth, req.params.id, req.body);
  return ok(res, data, '更新成功');
}

export async function remove(req, res) {
  const data = await scriptLibraryService.deleteScriptLibraryItem(req.auth, req.params.id);
  return ok(res, data, '删除成功');
}

export async function listIndustryPacks(req, res) {
  const [packs, status] = await Promise.all([
    Promise.resolve(industryScriptPackService.listIndustryScriptPacks()),
    industryScriptPackService.getIndustryPackStatus(req.auth),
  ]);
  const statusMap = Object.fromEntries(status.map((s) => [s.id, s.imported]));
  return ok(
    res,
    packs.map((p) => ({ ...p, imported: statusMap[p.id] === true })),
  );
}

export async function importIndustryPack(req, res) {
  const { pack_id: packId } = req.body || {};
  if (!packId) throw new HttpError(400, '请选择行业话术包', 400);
  const data = await industryScriptPackService.importIndustryScriptPack(req.auth, packId);
  return ok(res, data, `已导入 ${data.created} 条话术`);
}
