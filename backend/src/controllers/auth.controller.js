/**
 * @file 认证控制器：注册/登录等 HTTP 入口。
 */
import * as authService from '../services/auth.service.js';
import * as registrationOtp from '../services/registrationOtp.service.js';
import { ok } from '../utils/response.js';

export async function registerOptions(req, res) {
  return ok(res, {
    otpRequired: registrationOtp.isRegisterOtpEnabled(),
    channels: registrationOtp.getRegisterOtpChannels(),
  });
}

export async function sendRegisterOtp(req, res) {
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const data = await registrationOtp.sendRegisterOtp(req.body, String(ip));
  return ok(res, data, '验证码已发送');
}

export async function register(req, res) {
  const data = await authService.register(req.body);
  return ok(res, data, '注册成功');
}

export async function login(req, res) {
  const data = await authService.login(req.body);
  return ok(res, data, '登录成功');
}

export async function guestLogin(_req, res) {
  const data = await authService.guestLogin();
  return ok(res, data, '登录成功');
}

export async function logout(req, res) {
  return ok(res, null, 'ok');
}

export async function me(req, res) {
  const data = await authService.getMe(req.auth);
  return ok(res, data);
}

export async function myPermissions(req, res) {
  const u = req.user;
  const perms = u?.perm_codes ?? [];
  const roleId = u?.role_id != null ? Number(u.role_id) : null;
  const roleName =
    u && Object.prototype.hasOwnProperty.call(u, '__jwtRole') && u.__jwtRole !== undefined && u.__jwtRole !== null
      ? u.__jwtRole
      : u?.get?.('role') ?? u?.role ?? null;
  return ok(res, {
    role_id: roleId,
    role_name: roleName,
    perm_codes: perms,
    permissions: perms,
    role: u?.Role ? { id: u.Role.id, name: u.Role.name } : null,
  });
}
