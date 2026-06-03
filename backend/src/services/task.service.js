import { Task, User, Customer, Contract } from '../models/index.js';
import { Op, literal } from 'sequelize';

export async function listTasks(tenantId, query = {}) {
  const { page = 1, page_size = 20, status, priority, assignee_id, creator_id, customer_id, keyword, overdue } = query;
  const where = { tenant_id: tenantId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignee_id) where.assignee_id = assignee_id;
  if (creator_id) where.creator_id = creator_id;
  if (customer_id) where.customer_id = customer_id;
  if (keyword) where.title = { [Op.like]: `%${keyword}%` };
  if (overdue === '1') {
    where.due_date = { [Op.lt]: new Date() };
    where.status = { [Op.in]: ['todo', 'in_progress'] };
  }

  const { rows, count } = await Task.findAndCountAll({
    where,
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'real_name', 'username', 'avatar_url'] },
      { model: User, as: 'creator', attributes: ['id', 'real_name', 'username'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name'] },
      { model: Contract, as: 'contract', attributes: ['id', 'title', 'contract_no'] },
    ],
    order: [
      ['due_date', 'ASC'],
      [literal("FIELD(priority, 'urgent','high','medium','low')"), 'ASC'],
      ['created_at', 'DESC'],
    ],
    limit: Number(page_size),
    offset: (Number(page) - 1) * Number(page_size),
  });

  return { items: rows, total: count, page: Number(page), page_size: Number(page_size) };
}

export async function getTask(tenantId, id) {
  return Task.findOne({
    where: { id, tenant_id: tenantId },
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'real_name', 'username', 'avatar_url'] },
      { model: User, as: 'creator', attributes: ['id', 'real_name', 'username'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name'] },
      { model: Contract, as: 'contract', attributes: ['id', 'title', 'contract_no'] },
    ],
  });
}

export async function createTask(tenantId, data) {
  return Task.create({ ...data, tenant_id: tenantId });
}

export async function updateTask(tenantId, id, data) {
  if (data.status === 'done' && !data.completed_at) {
    data.completed_at = new Date();
  }
  const [n] = await Task.update(data, { where: { id, tenant_id: tenantId } });
  if (!n) return null;
  return Task.findByPk(id, {
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'real_name', 'username', 'avatar_url'] },
      { model: User, as: 'creator', attributes: ['id', 'real_name', 'username'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name'] },
      { model: Contract, as: 'contract', attributes: ['id', 'title'] },
    ],
  });
}

export async function deleteTask(tenantId, id) {
  return Task.destroy({ where: { id, tenant_id: tenantId } });
}

/** 我的待办（当前登录用户） */
export async function myTasks(tenantId, userId, query = {}) {
  return listTasks(tenantId, { ...query, assignee_id: userId });
}

/** 今日概览统计 */
export async function taskStats(tenantId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [total, todo, overdue, todayDue, doneToday] = await Promise.all([
    Task.count({ where: { tenant_id: tenantId, status: { [Op.in]: ['todo', 'in_progress'] } } }),
    Task.count({ where: { tenant_id: tenantId, status: 'todo' } }),
    Task.count({ where: { tenant_id: tenantId, status: { [Op.in]: ['todo', 'in_progress'] }, due_date: { [Op.lt]: new Date() } } }),
    Task.count({ where: { tenant_id: tenantId, due_date: { [Op.between]: [today, tomorrow] } } }),
    Task.count({ where: { tenant_id: tenantId, status: 'done', completed_at: { [Op.gte]: today } } }),
  ]);

  return { total, todo, overdue, today_due: todayDue, done_today: doneToday };
}
