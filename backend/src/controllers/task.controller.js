import * as taskSvc from '../services/task.service.js';

export async function listTasks(req, res, next) {
  try {
    const data = await taskSvc.listTasks(req.auth.tenantId, req.query);
    res.json({ code: 0, data });
  } catch (err) { next(err); }
}

export async function getTask(req, res, next) {
  try {
    const task = await taskSvc.getTask(req.auth.tenantId, req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    res.json({ code: 0, data: task });
  } catch (err) { next(err); }
}

export async function createTask(req, res, next) {
  try {
    const { tenantId, userId } = req.auth;
    const task = await taskSvc.createTask(tenantId, { ...req.body, creator_id: userId });
    res.status(201).json({ code: 0, data: task });
  } catch (err) { next(err); }
}

export async function updateTask(req, res, next) {
  try {
    const task = await taskSvc.updateTask(req.auth.tenantId, req.params.id, req.body);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
    res.json({ code: 0, data: task });
  } catch (err) { next(err); }
}

export async function deleteTask(req, res, next) {
  try {
    const n = await taskSvc.deleteTask(req.auth.tenantId, req.params.id);
    if (!n) return res.status(404).json({ code: 404, message: '任务不存在' });
    res.json({ code: 0, message: '已删除' });
  } catch (err) { next(err); }
}

export async function myTasks(req, res, next) {
  try {
    const data = await taskSvc.myTasks(req.auth.tenantId, req.auth.userId, req.query);
    res.json({ code: 0, data });
  } catch (err) { next(err); }
}

export async function taskStats(req, res, next) {
  try {
    const data = await taskSvc.taskStats(req.auth.tenantId);
    res.json({ code: 0, data });
  } catch (err) { next(err); }
}
