/**
 * @file 合同管理控制器
 */
import { Contract } from '../models/index.js';
import * as svc from '../services/contract.service.js';
import Joi from 'joi';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';

const Q = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'pending', 'signed', 'active', 'expired', 'terminated').optional(),
  keyword: Joi.string().max(100).optional(),
  customer_id: Joi.number().integer().positive().optional(),
}).unknown(true);

const BODY = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  contract_no: Joi.string().max(100).optional(),
  title: Joi.string().max(200).required(),
  amount: Joi.number().precision(2).min(0).default(0),
  status: Joi.string().valid('draft', 'pending', 'signed', 'active', 'expired', 'terminated').default('draft'),
  signed_at: Joi.date().iso().optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
  file_url: Joi.string().uri().max(500).optional(),
  remark: Joi.string().max(2000).optional(),
}).unknown(false);

export async function getContracts(req, res) {
  const { error, value } = Q.validate(req.query);
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const data = await svc.getContracts(req.auth, value);
  ok(res, data);
}

export async function getContract(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, '无效ID', 400);
  const data = await svc.getContract(req.auth, id);
  ok(res, data);
}

export async function createContract(req, res) {
  const { error, value } = BODY.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const data = await svc.createContract(req.auth, value);
  ok(res, data, 201);
}

export async function updateContract(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, '无效ID', 400);
  const { error, value } = BODY.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const data = await svc.updateContract(req.auth, id, value);
  ok(res, data);
}

export async function deleteContract(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, '无效ID', 400);
  await svc.deleteContract(req.auth, id);
  ok(res, null, 204);
}
