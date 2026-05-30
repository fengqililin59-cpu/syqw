/**
 * @file 用户（员工）管理控制器。
 */
import * as userService from '../services/user.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await userService.listUsers(req.auth, req.query);
  return ok(res, data);
}

export async function customerCount(req, res) {
  const data = await userService.countCustomersForOwner(req.auth, req.params.id);
  return ok(res, data);
}

export async function detail(req, res) {
  const data = await userService.getUser(req.auth, req.params.id);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await userService.createUser(req.auth, req.body);
  return ok(res, data, '创建成功');
}

export async function update(req, res) {
  const data = await userService.updateUser(req.auth, req.params.id, req.body);
  return ok(res, data, '更新成功');
}

export async function assignRole(req, res) {
  const data = await userService.assignUserRole(req.auth, req.params.id, req.body);
  return ok(res, data, '角色已更新');
}

export async function remove(req, res) {
  const data = await userService.deleteUser(req.auth, req.params.id);
  return ok(res, data, '已禁用');
}

export async function resetPassword(req, res) {
  const data = await userService.resetUserPassword(req.auth, req.params.id, req.body);
  return ok(res, data, '密码已重置');
}
