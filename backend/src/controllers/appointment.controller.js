/**
 * @file 预约到店控制器。
 */
import * as appointmentService from '../services/appointment.service.js';
import { APPOINTMENT_STATUS } from '../services/appointment.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await appointmentService.listAppointments(req.auth.tenantId, req.query);
  return ok(res, data);
}

export async function calendar(req, res) {
  const data = await appointmentService.getCalendar(req.auth.tenantId, req.query);
  return ok(res, data);
}

export async function today(req, res) {
  const data = await appointmentService.getTodayBoard(req.auth.tenantId, req.query.date);
  return ok(res, data);
}

export async function detail(req, res) {
  const data = await appointmentService.getAppointment(req.auth.tenantId, req.params.id);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await appointmentService.createAppointment(req.auth.tenantId, req.body, {
    userId: req.auth.userId,
  });
  return ok(res, data, '预约创建成功');
}

export async function update(req, res) {
  const data = await appointmentService.updateAppointment(req.auth.tenantId, req.params.id, req.body);
  return ok(res, data, '预约已更新');
}

export async function arrive(req, res) {
  const data = await appointmentService.changeStatus(
    req.auth.tenantId,
    req.params.id,
    APPOINTMENT_STATUS.ARRIVED,
  );
  return ok(res, data, '已标记到店');
}

export async function complete(req, res) {
  const data = await appointmentService.changeStatus(
    req.auth.tenantId,
    req.params.id,
    APPOINTMENT_STATUS.COMPLETED,
  );
  return ok(res, data, '服务已完成');
}

export async function noShow(req, res) {
  const data = await appointmentService.changeStatus(
    req.auth.tenantId,
    req.params.id,
    APPOINTMENT_STATUS.NO_SHOW,
  );
  return ok(res, data, '已标记爽约');
}

export async function cancel(req, res) {
  const data = await appointmentService.changeStatus(
    req.auth.tenantId,
    req.params.id,
    APPOINTMENT_STATUS.CANCELLED,
    { reason: req.body?.reason },
  );
  return ok(res, data, '预约已取消');
}
