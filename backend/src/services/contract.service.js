/**
 * @file 合同管理服务
 */
import { Op } from 'sequelize';
import { Contract, Customer, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';

function genContractNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.floor(Math.random() * 9000 + 1000);
  return `HT${y}${m}${d}${r}`;
}

const contractIncludes = [
  { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'company'] },
  { model: User, as: 'owner', attributes: ['id', 'real_name', 'username'], required: false },
];

export async function getContracts(auth, query = {}) {
  const { page = 1, pageSize = 20, status, keyword, customer_id } = query;
  const where = { tenant_id: auth.tenantId };
  if (status) where.status = status;
  if (customer_id) where.customer_id = customer_id;
  if (keyword) where[Op.or] = [{ contract_no: { [Op.like]: `%${keyword}%` } }, { title: { [Op.like]: `%${keyword}%` } }];

  const { rows, count } = await Contract.findAndCountAll({
    where,
    include: contractIncludes,
    order: [['id', 'DESC']],
    limit: Math.min(Number(pageSize) || 20, 100),
    offset: (Math.max(Number(page) || 1, 1) - 1) * (Number(pageSize) || 20),
  });

  return { list: rows, total: count };
}

export async function getContract(auth, id) {
  const row = await Contract.findOne({
    where: { id, tenant_id: auth.tenantId },
    include: contractIncludes,
  });
  if (!row) throw new HttpError(404, '合同不存在', 404);
  return row;
}

export async function createContract(auth, payload) {
  const { customer_id, title, amount, status, start_date, end_date, file_url, remark } = payload;
  if (!customer_id || !title) throw new HttpError(400, '客户和标题为必填项', 400);

  const contract_no = payload.contract_no || genContractNo();
  const row = await Contract.create({
    tenant_id: auth.tenantId,
    customer_id,
    owner_id: auth.userId,
    contract_no,
    title,
    amount: amount || 0,
    status: status || 'draft',
    signed_at: status === 'signed' ? new Date() : null,
    start_date: start_date || null,
    end_date: end_date || null,
    attachment_url: file_url || null,
    notes: remark || null,
  });
  return getContract(auth, row.id);
}

export async function updateContract(auth, id, payload) {
  const row = await Contract.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) throw new HttpError(404, '合同不存在', 404);

  const { customer_id, contract_no, title, amount, status, signed_at, start_date, end_date, file_url, remark } = payload;
  const data = {};
  if (customer_id !== undefined) data.customer_id = customer_id;
  if (contract_no !== undefined) data.contract_no = contract_no;
  if (title !== undefined) data.title = title;
  if (amount !== undefined) data.amount = amount;
  if (status !== undefined) {
    data.status = status;
    if (status === 'signed' && !row.signed_at) data.signed_at = new Date();
  }
  if (signed_at !== undefined) data.signed_at = signed_at;
  if (start_date !== undefined) data.start_date = start_date;
  if (end_date !== undefined) data.end_date = end_date;
  if (file_url !== undefined) data.attachment_url = file_url;
  if (remark !== undefined) data.notes = remark;

  await row.update(data);
  return getContract(auth, id);
}

export async function deleteContract(auth, id) {
  const n = await Contract.destroy({ where: { id, tenant_id: auth.tenantId } });
  if (!n) throw new HttpError(404, '合同不存在', 404);
}
