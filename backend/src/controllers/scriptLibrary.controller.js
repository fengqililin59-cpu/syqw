/**
 * @file 话术库 HTTP 入口。
 */
import * as scriptLibraryService from '../services/scriptLibrary.service.js';
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
