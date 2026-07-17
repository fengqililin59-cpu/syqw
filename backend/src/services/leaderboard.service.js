/**
 * @file 本周销售战力榜：成交 / 跟进 / AI 采纳 / 响应速度。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op, fn, col, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import {
  User,
  Customer,
  CustomerFollowUp,
  CustomerOrder,
  AiGenerationLog,
  CoachingSuggestion,
} from '../models/index.js';
import { isAdmin } from '../utils/permissions.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

const SCRIPT_AI_KINDS = [
  'reply_suggestions',
  'context_chat',
  'quick_score_scripts',
  'sidebar_scripts',
  'followup_scripts',
  'assistant_chat',
  'copywriting',
  'intent_score',
];

const RANK_DIMENSIONS = [
  {
    key: 'deals',
    label: '成交数',
    higherBetter: true,
    pick: (m) => m.deals,
    format: (v) => `${v} 单`,
  },
  {
    key: 'followups',
    label: '跟进数',
    higherBetter: true,
    pick: (m) => m.followups,
    format: (v) => `${v} 次`,
  },
  {
    key: 'ai_adoption',
    label: 'AI 话术采纳率',
    higherBetter: true,
    pick: (m) => m.ai_adoption_rate ?? -1,
    format: (v) => (v < 0 ? '—' : `${v}%`),
  },
  {
    key: 'response_speed',
    label: '平均响应速度',
    higherBetter: false,
    pick: (m) => (m.avg_response_minutes != null ? -m.avg_response_minutes : -999999),
    format: (v, m) =>
      m.avg_response_minutes != null ? `${Math.round(m.avg_response_minutes)} 分钟` : '—',
  },
];

function followUpsTenantInclude(tenantId) {
  return {
    model: Customer,
    required: true,
    attributes: [],
    where: { tenant_id: tenantId },
  };
}

/**
 * @param {'this' | 'last'} kind 自然周：本周一~今天 / 上周一~上周日
 */
export function getWeekBounds(kind = 'this') {
  const today = dayjs().tz(TZ).startOf('day');
  const dayOfWeek = today.day();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = today.subtract(mondayOffset, 'day');

  if (kind === 'last') {
    const lastMonday = thisMonday.subtract(7, 'day');
    const lastSunday = thisMonday.subtract(1, 'day');
    return {
      start: lastMonday.toDate(),
      end: thisMonday.toDate(),
      label: `${lastMonday.format('MM-DD')} ~ ${lastSunday.format('MM-DD')}`,
    };
  }

  return {
    start: thisMonday.toDate(),
    end: today.add(1, 'day').toDate(),
    label: `${thisMonday.format('MM-DD')} ~ ${today.format('MM-DD')}`,
  };
}

/**
 * 聚合租户内本周各销售指标（与 employeeActivity 周界一致）。
 */
export async function buildWeeklyLeaderboardForTenant(tenantId, { start, end }) {
  const users = await User.findAll({
    where: { tenant_id: tenantId, status: 1 },
    attributes: ['id', 'username', 'real_name', 'avatar_url'],
    order: [['real_name', 'ASC']],
  });
  const userIds = users.map((u) => u.id);
  if (!userIds.length) {
    return { members: [], dimensions: [] };
  }

  const periodWhere = { [Op.gte]: start, [Op.lt]: end };

  const [
    followRows,
    orderRows,
    dealStageRows,
    aiLogRows,
    coachImplementedRows,
    responseRows,
  ] = await Promise.all([
    CustomerFollowUp.findAll({
      attributes: ['user_id', [fn('COUNT', col('CustomerFollowUp.id')), 'count']],
      where: { created_at: periodWhere, user_id: { [Op.in]: userIds } },
      include: [followUpsTenantInclude(tenantId)],
      group: ['user_id'],
      raw: true,
    }),
    CustomerOrder.findAll({
      attributes: ['created_by', [fn('COUNT', col('id')), 'count']],
      where: { tenant_id: tenantId, created_at: periodWhere, created_by: { [Op.in]: userIds } },
      group: ['created_by'],
      raw: true,
    }),
    Customer.findAll({
      attributes: ['owner_id', [fn('COUNT', col('id')), 'count']],
      where: {
        tenant_id: tenantId,
        owner_id: { [Op.in]: userIds },
        stage: { [Op.in]: ['deal', 'won'] },
        updated_at: periodWhere,
      },
      group: ['owner_id'],
      raw: true,
    }),
    AiGenerationLog.findAll({
      attributes: ['user_id', [fn('COUNT', col('id')), 'count']],
      where: {
        tenant_id: tenantId,
        user_id: { [Op.in]: userIds },
        kind: { [Op.in]: SCRIPT_AI_KINDS },
        created_at: periodWhere,
      },
      group: ['user_id'],
      raw: true,
    }),
    CoachingSuggestion.findAll({
      attributes: ['user_id', [fn('COUNT', col('id')), 'count']],
      where: {
        tenant_id: tenantId,
        user_id: { [Op.in]: userIds },
        status: 'implemented',
        implemented_at: periodWhere,
      },
      group: ['user_id'],
      raw: true,
    }),
    sequelize.query(
      `
      SELECT t.assignee_id AS user_id,
             AVG(
               TIMESTAMPDIFF(
                 MINUTE,
                 (
                   SELECT MAX(c.created_at)
                   FROM inbox_messages c
                   WHERE c.thread_id = s.thread_id
                     AND c.direction = 'customer'
                     AND c.created_at < s.created_at
                 ),
                 s.created_at
               )
             ) AS avg_minutes,
             COUNT(*) AS samples
      FROM inbox_messages s
      INNER JOIN inbox_threads t ON t.id = s.thread_id
      WHERE s.tenant_id = :tenantId
        AND s.direction = 'staff'
        AND s.created_at >= :start AND s.created_at < :end
        AND t.assignee_id IN (:userIds)
      GROUP BY t.assignee_id
      `,
      {
        replacements: { tenantId: Number(tenantId), start, end, userIds },
        type: QueryTypes.SELECT,
      },
    ).catch(() => []),
  ]);

  const members = users.map((u) => {
    const uid = u.id;
    const followups = Number(followRows.find((r) => r.user_id === uid)?.count) || 0;
    const orders = Number(orderRows.find((r) => r.created_by === uid)?.count) || 0;
    const stageDeals = Number(dealStageRows.find((r) => r.owner_id === uid)?.count) || 0;
    const deals = orders + stageDeals;
    const aiGenerated = Number(aiLogRows.find((r) => r.user_id === uid)?.count) || 0;
    const aiAdopted = Number(coachImplementedRows.find((r) => r.user_id === uid)?.count) || 0;
    const respRow = responseRows.find((r) => Number(r.user_id) === uid);
    const avgResponse =
      respRow?.avg_minutes != null ? Math.round(Number(respRow.avg_minutes)) : null;
    const responseSamples = Number(respRow?.samples) || 0;

    let aiAdoptionRate = null;
    if (aiGenerated > 0) {
      aiAdoptionRate = Math.min(100, Math.round((aiAdopted / aiGenerated) * 100));
    } else if (aiAdopted > 0) {
      aiAdoptionRate = 100;
    }

    return {
      user_id: uid,
      real_name: u.real_name || u.username,
      avatar_url: u.avatar_url,
      deals,
      followups,
      ai_generated: aiGenerated,
      ai_adopted: aiAdopted,
      ai_adoption_rate: aiAdoptionRate,
      avg_response_minutes: avgResponse,
      response_samples: responseSamples,
    };
  });

  const dimensions = RANK_DIMENSIONS.map((dim) => {
    const sorted = members
      .filter((m) => {
        const v = dim.key === 'ai_adoption' ? m.ai_adoption_rate : dim.pick(m);
        if (dim.key === 'ai_adoption') return v != null && v >= 0;
        if (dim.key === 'response_speed') return m.avg_response_minutes != null;
        return dim.pick(m) > 0;
      })
      .sort((a, b) => {
        const av = dim.pick(a);
        const bv = dim.pick(b);
        return dim.higherBetter ? bv - av : av - bv;
      });

    return {
      key: dim.key,
      label: dim.label,
      items: sorted.slice(0, 10).map((m, idx) => ({
        rank: idx + 1,
        user_id: m.user_id,
        real_name: m.real_name,
        value:
          dim.key === 'deals'
            ? m.deals
            : dim.key === 'followups'
              ? m.followups
              : dim.key === 'ai_adoption'
                ? m.ai_adoption_rate ?? 0
                : m.avg_response_minutes ?? 0,
        display: dim.format(
          dim.key === 'deals'
            ? m.deals
            : dim.key === 'followups'
              ? m.followups
              : dim.key === 'ai_adoption'
                ? m.ai_adoption_rate ?? 0
                : m.avg_response_minutes ?? 0,
          m,
        ),
      })),
    };
  });

  return { members, dimensions };
}

/**
 * GET /analytics/leaderboard
 */
export async function getWeeklyLeaderboard(auth) {
  const { start, end, label } = getWeekBounds('this');
  const built = await buildWeeklyLeaderboardForTenant(auth.tenantId, { start, end });

  if (isAdmin(auth)) {
    return {
      week_label: label,
      scope: 'team',
      members: built.members,
      dimensions: built.dimensions,
    };
  }

  const self = built.members.find((m) => m.user_id === auth.userId);
  const myRanks = {};
  for (const dim of built.dimensions) {
    const item = dim.items.find((i) => i.user_id === auth.userId);
    myRanks[dim.key] = item
      ? { rank: item.rank, value: item.value, display: item.display }
      : null;
  }

  return {
    week_label: label,
    scope: 'self',
    my_stats: self ?? null,
    my_ranks: myRanks,
    dimensions: built.dimensions.map((d) => ({
      key: d.key,
      label: d.label,
      my_rank: myRanks[d.key],
      top_items: d.items.slice(0, 3),
    })),
  };
}

/** 上周各维度冠军 + 综合冠军（用于周一晨报） */
export async function getLastWeekChampionSummary(tenantId) {
  const { start, end, label } = getWeekBounds('last');
  const built = await buildWeeklyLeaderboardForTenant(tenantId, { start, end });

  const byDimension = {};
  for (const dim of built.dimensions) {
    const top = dim.items[0];
    if (top) {
      byDimension[dim.key] = {
        label: dim.label,
        user_id: top.user_id,
        name: top.real_name,
        display: top.display,
      };
    }
  }

  const scoreMap = new Map();
  for (const dim of built.dimensions) {
    for (const item of dim.items) {
      const pts = item.rank === 1 ? 3 : item.rank === 2 ? 2 : item.rank === 3 ? 1 : 0;
      scoreMap.set(item.user_id, (scoreMap.get(item.user_id) || 0) + pts);
    }
  }
  let overall = null;
  let bestScore = 0;
  for (const [userId, score] of scoreMap) {
    if (score > bestScore) {
      bestScore = score;
      const member = built.members.find((m) => m.user_id === userId);
      overall = {
        user_id: userId,
        name: member?.real_name || '—',
        score,
      };
    }
  }

  return {
    week_label: label,
    by_dimension: byDimension,
    overall_champion: overall,
  };
}

export function formatChampionDigestLines(championSummary) {
  if (!championSummary) return [];
  const lines = [];
  if (championSummary.overall_champion?.name) {
    lines.push(
      `🏆 上周战力冠军：${championSummary.overall_champion.name}（综合积分 ${championSummary.overall_champion.score}）`,
    );
  }
  const dim = championSummary.by_dimension || {};
  const deals = dim.deals;
  if (deals?.name) {
    lines.push(`· 成交王：${deals.name}（${deals.display}）`);
  }
  const follow = dim.followups;
  if (follow?.name) {
    lines.push(`· 跟进王：${follow.name}（${follow.display}）`);
  }
  if (lines.length <= 1 && championSummary.overall_champion) {
    return lines;
  }
  return lines;
}
