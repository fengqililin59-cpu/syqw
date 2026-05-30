/**
 * @file 企微「客户联系」同步：跟进成员列表 → 客户 ID 列表 → 外部联系人详情 → upsert customers。
 * @description 仅同步已在系统中绑定 `users.wework_userid` 的成员；归属人为对应员工。
 */
import { Op } from 'sequelize';
import { Tenant, User, Customer } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { getAccessToken } from './wework.service.js';

const LIST_LIMIT = 100;
const WEWORK_SOURCE = 'wework_sync';

/**
 * @param {unknown} v
 * @returns {string|null}
 */
function strOrNull(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * 按 userid 拉取全部外部联系人 external_userid（支持 cursor 分页）。
 * @param {string} accessToken
 * @param {string} wwUserid 企微成员 userid
 */
async function fetchExternalUserIds(accessToken, wwUserid) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list?access_token=${encodeURIComponent(accessToken)}`;
  const ids = [];
  let cursor;

  for (;;) {
    const body = { userid: wwUserid, limit: LIST_LIMIT };
    if (cursor) body.cursor = cursor;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.errcode !== 0) {
      throw new Error(data.errmsg || `列出客户失败 (${data.errcode})`);
    }

    const chunk = data.external_userid;
    if (Array.isArray(chunk)) {
      ids.push(...chunk);
    }

    const next = data.next_cursor;
    if (!next) break;
    cursor = next;
  }

  return ids;
}

async function fetchExternalDetail(accessToken, externalUserId) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ external_userid: externalUserId }),
  });
  const data = await res.json();
  if (data.errcode !== 0) {
    return { ok: false, errcode: data.errcode, errmsg: data.errmsg };
  }
  return { ok: true, data };
}

function pickFollowInfo(detailRes, wwUserid) {
  const list = detailRes.follow_user || detailRes.follow_info;
  if (!Array.isArray(list)) return null;
  return list.find((x) => x && String(x.userid) === String(wwUserid)) || null;
}

export { fetchExternalDetail, pickFollowInfo, strOrNull };

/**
 * 同步当前租户下企微外部联系人到 `customers`。
 * @param {number} tenantId
 */
export async function syncExternalCustomersForTenant(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }
  if (!tenant.wework_corp_id || !tenant.wework_secret) {
    throw new HttpError(400, '请先在设置中配置企微 CorpID 与应用 Secret', 400);
  }

  const accessToken = await getAccessToken(tenant);

  const fuUrl = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get_follow_user_list?access_token=${encodeURIComponent(accessToken)}`;
  const fuRes = await fetch(fuUrl);
  const fuData = await fuRes.json();
  if (fuData.errcode !== 0) {
    throw new Error(fuData.errmsg || `获取客户联系成员失败 (${fuData.errcode})`);
  }

  /** @type {string[]} */
  const followUsers = fuData.follow_user || [];
  const staff = await User.findAll({
    where: {
      tenant_id: tenantId,
      status: 1,
      wework_userid: { [Op.ne]: null },
    },
  });
  const ownerByWw = new Map(
    staff.filter((u) => u.wework_userid && String(u.wework_userid).trim()).map((u) => [String(u.wework_userid).trim(), u]),
  );

  let created = 0;
  let updated = 0;
  let skippedFetch = 0;
  let skippedUnmappedFollowUsers = 0;
  let listErrors = 0;

  for (const ww of followUsers) {
    const owner = ownerByWw.get(String(ww));
    if (!owner) {
      skippedUnmappedFollowUsers += 1;
      continue;
    }

    let extIds;
    try {
      extIds = await fetchExternalUserIds(accessToken, String(ww));
    } catch {
      listErrors += 1;
      continue;
    }

    for (const extId of extIds) {
      await new Promise((r) => {
        setTimeout(r, 50);
      });

      const got = await fetchExternalDetail(accessToken, extId);
      if (!got.ok) {
        skippedFetch += 1;
        continue;
      }

      const ec = got.data.external_contact;
      if (!ec || !ec.external_userid) {
        skippedFetch += 1;
        continue;
      }

      const fi = pickFollowInfo(got.data, String(ww));
      let addedAt = null;
      if (fi) {
        const raw = fi.createtime ?? fi.create_time;
        if (raw != null) {
          const ts = Number(raw);
          if (!Number.isNaN(ts) && ts > 0) {
            addedAt = new Date(ts * 1000);
          }
        }
      }

      const payload = {
        owner_id: owner.id,
        external_userid: ec.external_userid,
        name: strOrNull(ec.name),
        nickname: strOrNull(fi?.remark) || strOrNull(ec.name),
        avatar_url: strOrNull(ec.avatar),
        gender: ec.gender != null ? Number(ec.gender) : 0,
        company: strOrNull(ec.corp_name || ec.corp_full_name),
        position: strOrNull(ec.position),
        added_at: addedAt,
      };

      const existing = await Customer.findOne({
        where: { tenant_id: tenantId, external_userid: extId },
        paranoid: false,
      });

      if (existing) {
        if (existing.deleted_at) {
          await existing.restore();
        }
        await existing.update({
          ...payload,
          source: existing.source || WEWORK_SOURCE,
        });
        updated += 1;
      } else {
        await Customer.create({
          tenant_id: tenantId,
          owner_id: owner.id,
          external_userid: extId,
          name: payload.name,
          nickname: payload.nickname,
          avatar_url: payload.avatar_url,
          gender: payload.gender,
          company: payload.company,
          position: payload.position,
          phone: null,
          wechat_id: null,
          source: WEWORK_SOURCE,
          stage: 'new',
          added_at: payload.added_at,
        });
        created += 1;
      }
    }
  }

  return {
    created,
    updated,
    skipped_fetch: skippedFetch,
    skipped_follow_users_not_in_system: skippedUnmappedFollowUsers,
    list_errors: listErrors,
    follow_users_count: followUsers.length,
  };
}
