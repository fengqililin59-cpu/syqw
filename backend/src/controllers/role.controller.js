/**
 * @file 角色控制器：将 HTTP 请求转给角色服务并返回统一 JSON。
 */
import * as roleService from '../services/role.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await roleService.listRoles(req.auth);
  return ok(res, data);
}

export async function catalog(_req, res) {
  const data = roleService.getPermissionCatalog();
  return ok(res, data);
}

export async function create(req, res) {
  const data = await roleService.createRole(req.auth, req.body);
  return ok(res, data, '创建成功');
}

export async function update(req, res) {
  const data = await roleService.updateRole(req.auth, Number(req.params.id), req.body);
  return ok(res, { ...data, notice: '权限变更将在员工下次登录后生效' }, '更新成功');
}

export async function remove(req, res) {
  const data = await roleService.deleteRole(req.auth, Number(req.params.id));
  return ok(res, data, '删除成功');
}

export async function grantAiEmployeePerms(req, res) {
  const data = await roleService.grantAiEmployeePermsToAdminRoles(req.auth);
  return ok(res, data, data.notice || '完成');
}
