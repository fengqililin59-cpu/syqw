/**
 * @file 客户转移：企微 transfer_customer / resigned.transfer_customer + 本地 owner 更新。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { Customer, CustomerTransfer, Tenant, User } from '../models/index.js';
import { getAccessToken } from './wework.service.js';

const initiateSchema = Joi.object({
  from_user_id: Joi.number().integer().positive().required(),
  to_user_id: Joi.number().integer().positive().required(),
  reason: Joi.string().valid('resigned', 'reassign').optional(),
}).unknown(false);

const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {{ id: number; wework_corp_id?: string | null; wework_secret?: string | null }} tenant
 * @param {'resigned'|'reassign'} reason
 */
async function postWeworkTransferCustomer(tenant, reason, handoverUserid, takeoverUserid, externalUserids) {
  const token = await getAccessToken(tenant);
  const path =
    reason === 'resigned'
      ? 'externalcontact/resigned/transfer_customer'
      : 'externalcontact/transfer_customer';
  const url = `https://qyapi.weixin.qq.com/cgi-bin/${path}?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handover_userid: handoverUserid,
      takeover_userid: takeoverUserid,
      external_userid: externalUserids,
    }),
  });
  return res.json();
}

function formatUserBrief(u) {
  if (!u) return null;
  const p = u.get ? u.get({ plain: true }) : u;
  return {
    id: p.id,
    username: p.username,
    real_name: p.real_name,
  };
}

function formatTransferRow(row) {
  const p = row.get({ plain: true });
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    from_user_id: p.from_user_id,
    to_user_id: p.to_user_id,
    initiated_by: p.initiated_by,
    reason: p.reason,
    status: p.status,
    total_count: p.total_count,
    success_count: p.success_count,
    failed_count: p.failed_count,
    detail_json: p.detail_json,
    started_at: p.started_at,
    finished_at: p.finished_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
    from_user: formatUserBrief(row.from_user),
    to_user: formatUserBrief(row.to_user),
    initiator: formatUserBrief(row.initiator),
  };
}

/**
 * @param {number} tenantId
 * @param {number} initiatedBy
 * @param {number} fromUserId
 * @param {number} toUserId
 * @param {'resigned'|'reassign'} [reason]
 */
export async function initiateTransfer(tenantId, initiatedBy, fromUserId, toUserId, reason = 'resigned') {
  if (Number(fromUserId) === Number(toUserId)) {
    throw new HttpError(400, '转出与接收不能为同一人', 400);
  }

  const fromUser = await User.findOne({ where: { id: fromUserId, tenant_id: tenantId } });
  const toUser = await User.findOne({ where: { id: toUserId, tenant_id: tenantId } });
  if (!fromUser || !toUser) throw new HttpError(404, '用户不存在', 404);

  const totalCount = await Customer.count({
    where: {
      tenant_id: tenantId,
      owner_id: fromUserId,
      external_userid: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
  });

  const transfer = await CustomerTransfer.create({
    tenant_id: tenantId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    initiated_by: initiatedBy,
    reason: reason === 'reassign' ? 'reassign' : 'resigned',
    status: 'pending',
    total_count: totalCount,
    success_count: 0,
    failed_count: 0,
  });

  executeTransfer(transfer.id).catch((err) => console.error('[Transfer]', err));

  return getTransferStatus(tenantId, transfer.id);
}

/**
 * @param {number} transferId
 */
export async function executeTransfer(transferId) {
  let transfer;
  try {
    transfer = await CustomerTransfer.findByPk(transferId);
    if (!transfer) return;

    const tenant = await Tenant.findByPk(transfer.tenant_id);
    if (!tenant) {
      await transfer.update({
        status: 'failed',
        finished_at: new Date(),
        detail_json: [{ customer_id: null, external_userid: null, status: 'failed', errmsg: '租户不存在' }],
      });
      return;
    }

    const fromUser = await User.findOne({
      where: { id: transfer.from_user_id, tenant_id: transfer.tenant_id },
      attributes: ['id', 'wework_userid'],
    });
    const toUser = await User.findOne({
      where: { id: transfer.to_user_id, tenant_id: transfer.tenant_id },
      attributes: ['id', 'wework_userid'],
    });

    if (!fromUser?.wework_userid?.trim() || !toUser?.wework_userid?.trim()) {
      await transfer.update({
        status: 'failed',
        finished_at: new Date(),
        detail_json: [
          {
            customer_id: null,
            external_userid: null,
            status: 'failed',
            errmsg: '转出或接收成员未绑定企微 userid，无法调用继承接口',
          },
        ],
      });
      return;
    }

    await transfer.update({
      status: 'processing',
      started_at: new Date(),
    });

    const customerRows = await Customer.findAll({
      where: {
        tenant_id: transfer.tenant_id,
        owner_id: transfer.from_user_id,
        external_userid: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
      },
      attributes: ['id', 'external_userid'],
      order: [['id', 'ASC']],
    });

    await transfer.update({ total_count: customerRows.length });

    if (customerRows.length === 0) {
      await transfer.update({
        status: 'done',
        success_count: 0,
        failed_count: 0,
        detail_json: [],
        finished_at: new Date(),
      });
      return;
    }

    const extToId = new Map();
    const externalList = [];
    for (const row of customerRows) {
      const ext = String(row.external_userid).trim();
      if (!ext) continue;
      extToId.set(ext, row.id);
      externalList.push(ext);
    }

    const handover = String(fromUser.wework_userid).trim();
    const takeover = String(toUser.wework_userid).trim();

    const allDetails = [];
    let successCount = 0;
    let failedCount = 0;

    const BATCH = 100;
    for (let i = 0; i < externalList.length; i += BATCH) {
      const batch = externalList.slice(i, i + BATCH);
      const data = await postWeworkTransferCustomer(tenant, transfer.reason, handover, takeover, batch);

      if (Number(data.errcode) !== 0) {
        for (const ext of batch) {
          const cid = extToId.get(ext);
          failedCount += 1;
          allDetails.push({
            customer_id: cid ?? null,
            external_userid: ext,
            status: 'failed',
            errmsg: data.errmsg || `企微错误码 ${data.errcode}`,
          });
        }
      } else {
        const byExt = new Map((data.customer || []).map((x) => [x.external_userid, x]));
        for (const ext of batch) {
          const cid = extToId.get(ext);
          const item = byExt.get(ext);
          if (!item) {
            failedCount += 1;
            allDetails.push({
              customer_id: cid ?? null,
              external_userid: ext,
              status: 'failed',
              errmsg: '企微响应缺少该客户结果',
            });
            continue;
          }
          const itemOk = Number(item.errcode) === 0;
          if (itemOk) {
            successCount += 1;
            allDetails.push({
              customer_id: cid ?? null,
              external_userid: ext,
              status: 'ok',
              errmsg: null,
            });
            await Customer.update(
              { owner_id: transfer.to_user_id },
              { where: { id: cid, tenant_id: transfer.tenant_id, external_userid: ext } },
            );
          } else {
            failedCount += 1;
            allDetails.push({
              customer_id: cid ?? null,
              external_userid: ext,
              status: 'failed',
              errmsg: item.errmsg || String(item.errcode),
            });
          }
        }
      }

      if (i + BATCH < externalList.length) {
        await sleep(1000);
      }
    }

    let finalStatus = 'done';
    if (failedCount > 0 && successCount === 0) finalStatus = 'failed';
    else if (failedCount > 0) finalStatus = 'partial';

    await transfer.update({
      status: finalStatus,
      success_count: successCount,
      failed_count: failedCount,
      detail_json: allDetails,
      finished_at: new Date(),
    });
  } catch (err) {
    console.error('[Transfer] executeTransfer', err);
    if (transfer) {
      try {
        await transfer.update({
          status: 'failed',
          finished_at: new Date(),
          detail_json: [
            {
              customer_id: null,
              external_userid: null,
              status: 'failed',
              errmsg: String(err?.message || err).slice(0, 500),
            },
          ],
        });
      } catch (e) {
        console.error('[Transfer] persist failed', e);
      }
    }
  }
}

/**
 * @param {number} tenantId
 * @param {number} transferId
 */
export async function getTransferStatus(tenantId, transferId) {
  const row = await CustomerTransfer.findOne({
    where: { id: transferId, tenant_id: tenantId },
    include: [
      { model: User, as: 'from_user', attributes: ['id', 'username', 'real_name'], required: false },
      { model: User, as: 'to_user', attributes: ['id', 'username', 'real_name'], required: false },
      { model: User, as: 'initiator', attributes: ['id', 'username', 'real_name'], required: false },
    ],
  });
  if (!row) throw new HttpError(404, '转移记录不存在', 404);
  return formatTransferRow(row);
}

/**
 * @param {number} tenantId
 * @param {object} query
 */
export async function listTransfers(tenantId, query) {
  const { error, value } = listSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const { rows, count } = await CustomerTransfer.findAndCountAll({
    where: { tenant_id: tenantId },
    include: [
      { model: User, as: 'from_user', attributes: ['id', 'username', 'real_name'], required: false },
      { model: User, as: 'to_user', attributes: ['id', 'username', 'real_name'], required: false },
      { model: User, as: 'initiator', attributes: ['id', 'username', 'real_name'], required: false },
    ],
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });

  return {
    list: rows.map((r) => formatTransferRow(r)),
    total: count,
    page: value.page,
    size: value.size,
  };
}

export function validateInitiateBody(body) {
  const { error, value } = initiateSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  return value;
}
