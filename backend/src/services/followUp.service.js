/**
 * @file 跟进记录服务：租户维度列表（通过客户表关联强制 tenant_id）。
 */
import { Op } from 'sequelize';
import XLSX from 'xlsx';
import { HttpError } from '../utils/httpError.js';
import { CustomerFollowUp, Customer, User } from '../models/index.js';
import { customerWhereScope } from '../utils/permissions.js';
import { listOverdueFollowUpsForTenant } from './followUpDueReminder.service.js';

/**
 * 分页查询当前租户下全部跟进（可选客户、关键词）。
 */
export async function listFollowUpsForTenant(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const customerWhere = { ...customerWhereScope(auth) };
  if (query.customer_id) {
    customerWhere.id = Number(query.customer_id);
  }

  const whereFollowUp = {};
  if (query.keyword) {
    const kw = String(query.keyword).trim();
    if (kw) {
      whereFollowUp.content = { [Op.like]: `%${kw}%` };
    }
  }

  const { rows, count } = await CustomerFollowUp.findAndCountAll({
    where: whereFollowUp,
    include: [
      {
        model: Customer,
        required: true,
        where: customerWhere,
        attributes: ['id', 'name', 'phone', 'stage'],
      },
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'real_name'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  const list = rows.map((r) => {
    const plain = r.get({ plain: true });
    return {
      id: plain.id,
      customer_id: plain.customer_id,
      user_id: plain.user_id,
      type: plain.type,
      content: plain.content,
      next_follow_at: plain.next_follow_at,
      created_at: plain.created_at,
      Customer: plain.Customer,
      author: plain.author,
    };
  });

  return { list, total: count, page, size };
}

/**
 * 删除单条跟进（校验客户属于本租户）。
 */
export async function deleteFollowUp(auth, id) {
  const row = await CustomerFollowUp.findByPk(id, {
    include: [{ model: Customer, required: true, where: { ...customerWhereScope(auth) }, attributes: ['id'] }],
  });
  if (!row) {
    throw new HttpError(404, '跟进记录不存在', 404);
  }
  await row.destroy();
  return { id: Number(id) };
}

/**
 * 导出跟进记录（Excel base64）。
 */
export async function exportFollowUpsForTenant(auth, query) {
  const customerWhere = { ...customerWhereScope(auth) };
  if (query.customer_id) {
    customerWhere.id = Number(query.customer_id);
  }

  const whereFollowUp = {};
  if (query.keyword) {
    const kw = String(query.keyword).trim();
    if (kw) whereFollowUp.content = { [Op.like]: `%${kw}%` };
  }

  const rows = await CustomerFollowUp.findAll({
    where: whereFollowUp,
    include: [
      {
        model: Customer,
        required: true,
        where: customerWhere,
        attributes: ['id', 'name', 'phone', 'stage'],
      },
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'real_name'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: 10000,
  });

  const data = rows.map((r) => {
    const p = r.get({ plain: true });
    return {
      跟进时间: p.created_at || '',
      客户ID: p.customer_id,
      客户名称: p.Customer?.name || '',
      客户手机: p.Customer?.phone || '',
      客户阶段: p.Customer?.stage || '',
      跟进类型: p.type || '',
      跟进内容: p.content || '',
      下次跟进时间: p.next_follow_at || '',
      跟进人: p.author?.real_name || p.author?.username || '',
      跟进人ID: p.user_id || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 跟进时间: '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'follow_ups');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return {
    filename: `followups_export_${Date.now()}.xlsx`,
    file_base64: Buffer.from(out).toString('base64'),
  };
}

export async function listOverdueFollowUps(auth, query) {
  const list = await listOverdueFollowUpsForTenant(auth, query);
  return { list, total: list.length };
}
