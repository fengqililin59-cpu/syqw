/**
 * @file 平台运营租户备注。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { Tenant, TenantPlatformOpsNote, User } from '../models/index.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

const createSchema = Joi.object({
  note_type: Joi.string().valid('call', 'wechat', 'email', 'other').default('call'),
  content: Joi.string().trim().min(1).max(5000).required(),
  next_follow_at: Joi.date().iso().allow(null).optional(),
}).unknown(false);

async function assertTenantActive(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'status'] });
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);
  return tenant;
}

export async function listTenantOpsNotes(tenantId) {
  await assertTenantActive(tenantId);
  const rows = await TenantPlatformOpsNote.findAll({
    where: { tenant_id: Number(tenantId) },
    order: [['id', 'DESC']],
    limit: 50,
  });
  const authorIds = [...new Set(rows.map((r) => r.author_user_id).filter(Boolean))];
  const authors =
    authorIds.length > 0
      ? await User.findAll({
          where: { id: authorIds },
          attributes: ['id', 'username', 'real_name'],
        })
      : [];
  const authorMap = Object.fromEntries(authors.map((u) => [u.id, u]));

  return rows.map((r) => {
    const p = r.get({ plain: true });
    const author = p.author_user_id ? authorMap[p.author_user_id] : null;
    return {
      id: p.id,
      note_type: p.note_type,
      content: p.content,
      next_follow_at: p.next_follow_at,
      created_at: p.created_at,
      author: author
        ? { id: author.id, username: author.username, real_name: author.real_name }
        : null,
    };
  });
}

export async function createTenantOpsNote(tenantId, authorUserId, body) {
  await assertTenantActive(tenantId);
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const row = await TenantPlatformOpsNote.create({
    tenant_id: Number(tenantId),
    author_user_id: authorUserId ? Number(authorUserId) : null,
    note_type: value.note_type,
    content: value.content,
    next_follow_at: value.next_follow_at || null,
  });

  const plain = row.get({ plain: true });
  return {
    id: plain.id,
    note_type: plain.note_type,
    content: plain.content,
    next_follow_at: plain.next_follow_at,
    created_at: plain.created_at,
  };
}

function shanghaiTodayRange() {
  const now = dayjs().tz(TZ);
  return {
    start: now.startOf('day').toDate(),
    end: now.endOf('day').toDate(),
    now: now.toDate(),
  };
}

/**
 * 待平台回访：按 next_follow_at 筛选。
 * scope: due（已到期含今日）| overdue | today | upcoming（未来7天）
 */
export async function listDueOpsFollowups(query = {}) {
  const scope = String(query.scope || 'due');
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const { start, end, now } = shanghaiTodayRange();
  const upcomingEnd = dayjs().tz(TZ).add(7, 'day').endOf('day').toDate();

  let nextFollowWhere = { [Op.ne]: null };
  if (scope === 'overdue') nextFollowWhere = { [Op.lt]: start };
  else if (scope === 'today') nextFollowWhere = { [Op.between]: [start, end] };
  else if (scope === 'upcoming') nextFollowWhere = { [Op.gt]: end, [Op.lte]: upcomingEnd };
  else nextFollowWhere = { [Op.lte]: end };

  const rows = await TenantPlatformOpsNote.findAll({
    where: { next_follow_at: nextFollowWhere },
    include: [
      {
        model: Tenant,
        attributes: ['id', 'name', 'contact_name', 'contact_phone'],
        where: { status: 1 },
        required: true,
      },
    ],
    order: [['next_follow_at', 'ASC']],
    limit,
  });

  const list = rows.map((r) => {
    const p = r.get({ plain: true });
    const dueAt = p.next_follow_at ? dayjs(p.next_follow_at).tz(TZ) : null;
    let due_status = 'today';
    if (dueAt && dueAt.isBefore(dayjs(start))) due_status = 'overdue';
    else if (dueAt && dueAt.isAfter(dayjs(end))) due_status = 'upcoming';
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      tenant_name: p.Tenant?.name || `租户#${p.tenant_id}`,
      contact_phone: p.Tenant?.contact_phone || null,
      note_type: p.note_type,
      content: p.content,
      next_follow_at: p.next_follow_at,
      created_at: p.created_at,
      due_status,
    };
  });

  const [overdueCount, todayCount, upcomingCount] = await Promise.all([
    TenantPlatformOpsNote.count({
      where: { next_follow_at: { [Op.lt]: start } },
      include: [{ model: Tenant, where: { status: 1 }, required: true, attributes: [] }],
    }).catch(() => 0),
    TenantPlatformOpsNote.count({
      where: { next_follow_at: { [Op.between]: [start, end] } },
      include: [{ model: Tenant, where: { status: 1 }, required: true, attributes: [] }],
    }).catch(() => 0),
    TenantPlatformOpsNote.count({
      where: { next_follow_at: { [Op.gt]: end, [Op.lte]: upcomingEnd } },
      include: [{ model: Tenant, where: { status: 1 }, required: true, attributes: [] }],
    }).catch(() => 0),
  ]);

  return {
    list,
    total: list.length,
    counts: {
      overdue: overdueCount,
      today: todayCount,
      upcoming: upcomingCount,
      due: overdueCount + todayCount,
    },
    as_of: now,
  };
}

/** 标记回访已完成（清除下次跟进时间） */
export async function completeOpsFollowup(noteId) {
  const row = await TenantPlatformOpsNote.findByPk(Number(noteId));
  if (!row) throw new HttpError(404, '备注不存在', 404);
  await row.update({ next_follow_at: null });
  return { id: row.id, completed: true };
}
