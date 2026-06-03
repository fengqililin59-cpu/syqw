/**
 * @file 员工活动监控面板：老板视角，看谁在干什么。
 * 功能：概览卡、环比、异常告警、趋势图、时段分布、排行榜、
 *        筛选/排序/关注置顶、员工详情抽屉、KPI目标进度、30天活动热力图、KPI管理。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getJson } from '../api/client';
import type { Paginated } from '../api/types';
import { fetchEmployeeActivity, fetchKpiTargets, upsertKpiTarget, deleteKpiTarget, fetchCoachingInsight, type EmployeeActivityData, type DailyTrendPoint, type RankingDimension, type HourlyPoint, type EmployeeMember, type KpiTargetRecord } from '../api/employeeActivity';

type UserRow = { id: number; real_name?: string | null; username: string };

const ACTION_LABELS: Record<string, string> = {
  'customer:create': '新建客户',
  'customer:update': '更新客户',
  'customer:delete': '删除客户',
  'customer:import': '导入客户',
  'customer:export': '导出客户',
  'followup:create': '添加跟进',
  'call:initiate': '发起通话',
  'broadcast:send': '客户群发',
  'order:create': '创建订单',
  'order:update': '更新订单',
  'inbox:reply': '回复消息',
  'settings:update': '修改设置',
};

const TREND_BARS: { key: string; label: string; fill: string }[] = [
  { key: 'followup:create', label: '跟进', fill: '#378ADD' },
  { key: 'call:initiate', label: '通话', fill: '#EF9F27' },
  { key: 'order:create', label: '订单', fill: '#8B5CF6' },
  { key: 'inbox:reply', label: '回复', fill: '#639922' },
  { key: 'customer:create', label: '新增客户', fill: '#14B8A6' },
];

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return '刚刚';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} 小时前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatRevenue(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

function growthPct(today: number, yesterday: number): { arrow: string; pct: number | null; color: string } {
  if (!yesterday) return { arrow: '', pct: null, color: 'var(--color-text-secondary)' };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct > 0) return { arrow: '↑', pct, color: '#DC2626' };
  if (pct < 0) return { arrow: '↓', pct: Math.abs(pct), color: '#16A34A' };
  return { arrow: '→', pct: 0, color: 'var(--color-text-secondary)' };
}

function exportCSV(data: EmployeeActivityData) {
  const headers = ['姓名', '企微账号', '在线', '跟进', '通话', '通话时长(秒)', '订单', '成交额', '新增客户', '回复'];
  const rows = data.members.map((m) => [
    m.real_name || m.username,
    m.wework_userid || '',
    m.is_online ? '是' : '否',
    m.today.followups,
    m.today.calls,
    m.today.call_duration_sec,
    m.today.orders,
    m.today.revenue,
    m.today.new_customers,
    m.today.inbox_replies,
  ]);
  const summaryRow = ['合计', '', '', data.summary.total_followups_today, data.summary.total_calls_today, '',
    data.summary.total_orders_today, data.summary.total_revenue_today, data.summary.total_new_customers_today,
    data.summary.total_inbox_replies_today];
  const bom = '\uFEFF';
  const csv = bom + [headers, ...rows, summaryRow].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `员工活动报表_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 30天活动热力图组件 ───────────────────────────────
function ActivityHeatmap({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const theme = document.documentElement.style.getPropertyValue('--color-background-brand') || '#378ADD';
  const brand = theme.startsWith('#') ? theme : '#378ADD';

  // 按周分组：找到第一个周一
  const firstDate = new Date(data[0]?.date || '');
  const startOffset = (firstDate.getDay() + 6) % 7; // 周一=0
  const cells = [];
  // 前面补空
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (const d of data) cells.push(d);
  // 后面补空对齐
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const getColor = (count: number) => {
    if (!count) return 'var(--color-background-tertiary, #F1F5F9)';
    const ratio = count / maxCount;
    if (ratio < 0.25) return `${brand}22`;
    if (ratio < 0.5) return `${brand}55`;
    if (ratio < 0.75) return `${brand}99`;
    return brand;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 4, fontSize: 10, color: 'var(--color-text-secondary)' }}>
        {weeks.map((_, wi) => <div key={wi} style={{ width: 28, textAlign: 'center' }}>{wi % 2 === 0 ? `${data[wi * 7 - startOffset]?.date?.slice(5) || ''}` : ''}</div>)}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {/* 星期标签 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: 'var(--color-text-secondary)', paddingRight: 4 }}>
          {['一', '二', '三', '四', '五', '六', '日'].map((d) => <div key={d} style={{ height: 28, display: 'flex', alignItems: 'center' }}>{d}</div>)}
        </div>
        {/* 热力格子 */}
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map((cell, di) => (
                <div key={di} title={cell ? `${cell.date}: ${cell.count} 次操作` : ''}
                  style={{
                    width: 28, height: 28, borderRadius: 4,
                    background: cell ? getColor(cell.count) : 'transparent',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
        少
        {[0.15, 0.4, 0.7, 1].map((r) => (
          <div key={r} style={{ width: 20, height: 20, borderRadius: 4, background: `${brand}${Math.round(r * 255).toString(16).padStart(2, '0')}` }} />
        ))}
        多
      </div>
    </div>
  );
}

// ─── KPI 目标管理弹窗 ────────────────────────────────
function KpiTargetModal({ visible, onClose, targets, users, onRefresh }: {
  visible: boolean;
  onClose: () => void;
  targets: KpiTargetRecord[];
  users: { id: number; real_name: string; username: string }[];
  onRefresh: () => void;
}) {
  const [form, setForm] = useState<{ id?: number; user_id: string; dimension: string; target_value: string; period: string }>({
    user_id: '', dimension: 'followups', target_value: '', period: 'daily',
  });
  const [saving, setSaving] = useState(false);

  const DIMENSIONS = [
    { key: 'followups', label: '跟进数' },
    { key: 'calls', label: '通话数' },
    { key: 'orders', label: '订单数' },
    { key: 'revenue', label: '成交额' },
    { key: 'new_customers', label: '新增客户' },
  ];
  const PERIODS = [
    { key: 'daily', label: '每日' },
    { key: 'weekly', label: '每周' },
    { key: 'monthly', label: '每月' },
  ];

  const handleSave = async () => {
    if (!form.dimension || !form.target_value) return;
    setSaving(true);
    try {
      await upsertKpiTarget({
        id: form.id,
        user_id: form.user_id ? Number(form.user_id) : null,
        dimension: form.dimension,
        target_value: Number(form.target_value),
        period: form.period,
      });
      setForm({ user_id: '', dimension: 'followups', target_value: '', period: 'daily' });
      onRefresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await deleteKpiTarget(id);
    onRefresh();
  };

  if (!visible) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 2000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 520, background: 'var(--color-background-primary)', borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)', zIndex: 2001, padding: 24,
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>KPI 目标管理</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>✕</button>
        </div>

        {/* 新增 / 编辑表单 */}
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <select value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
              <option value="">全员默认</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.real_name || u.username}</option>)}
            </select>
            <select value={form.dimension} onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
              {DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <input type="number" placeholder="目标值" value={form.target_value}
              onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}
            />
            <select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <button onClick={handleSave} disabled={saving || !form.target_value}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 6, border: 'none',
              background: 'var(--color-background-brand)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
            {saving ? '保存中...' : form.id ? '更新' : '添加目标'}
          </button>
        </div>

        {/* 目标列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {targets.length === 0 && <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13, padding: 16 }}>暂无目标，请添加</div>}
          {targets.map((t) => (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--color-background-secondary)', borderRadius: 6, padding: '8px 12px', fontSize: 13,
            }}>
              <div>
                <span style={{ fontWeight: 500 }}>{t.user_id ? users.find((u) => u.id === t.user_id)?.real_name || `#${t.user_id}` : '全员'}</span>
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                  {DIMENSIONS.find((d) => d.key === t.dimension)?.label} · {['daily', 'weekly', 'monthly'].indexOf(t.period) >= 0 ? PERIODS[[ 'daily', 'weekly', 'monthly' ].indexOf(t.period)]?.label : t.period} · 目标 {t.target_value}
                </span>
              </div>
              <button onClick={() => handleDelete(t.id!)} style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>删除</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── KPI 进度条组件 ────────────────────────────────
function KpiProgress({ label, value, target }: { label: string; value: number; target: number | null }) {
  if (!target || target <= 0) return null;
  const pct = Math.min(Math.round((value / target) * 100), 999);
  const color = pct >= 100 ? '#16A34A' : pct >= 70 ? '#F59E0B' : 'var(--color-text-secondary)';
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 500 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 3,
          background: pct >= 100 ? '#16A34A' : pct >= 70 ? '#F59E0B' : 'var(--color-background-brand)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ─── 主组件 ─────────────────────────────────────────
export default function EmployeeActivityPage() {
  const [data, setData] = useState<EmployeeActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [trendDays, setTrendDays] = useState(7);
  const [detailMember, setDetailMember] = useState<EmployeeMember | null>(null);
  const [kpiTargets, setKpiTargets] = useState<KpiTargetRecord[]>([]);
  const [kpiModalVisible, setKpiModalVisible] = useState(false);
  const [kpiUsers, setKpiUsers] = useState<{ id: number; real_name: string; username: string }[]>([]);

  // 筛选 & 排序
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('default');

  // 关注置顶
  const pinnedKey = 'employee_activity_pinned';
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(pinnedKey) || '[]'); } catch { return []; }
  });
  const togglePin = (id: number) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev];
      localStorage.setItem(pinnedKey, JSON.stringify(next));
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const d = await fetchEmployeeActivity();
      setData(d);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  const loadKpi = useCallback(async () => {
    try {
      const targets = await fetchKpiTargets();
      setKpiTargets(targets);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    loadKpi();
    // 获取用户列表用于 KPI 弹窗
    getJson<Paginated<UserRow>>('/users?page=1&size=200')
      .then((j) => setKpiUsers((j.list ?? []).map((u) => ({
        id: u.id,
        username: u.username,
        real_name: u.real_name ?? '',
      }))))
      .catch(() => {});
    intervalRef.current = setInterval(load, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load, loadKpi]);

  if (loading) return <div style={{ padding: 32, color: 'var(--color-text-secondary)' }}>加载中...</div>;
  if (!data) return <div style={{ padding: 32, color: 'var(--color-text-danger)' }}>加载失败</div>;

  const { summary, summary_prev: prev, week_summary: wk, week_prev: wkPrev, members, recent_logs: logs } = data;
  const trendSlice = data.daily_trend.slice(-trendDays);

  // 构建 KPI Map: key = `${userId||'default'}_${dimension}_${period}`
  const kpiMap: Record<string, number> = {};
  for (const t of kpiTargets) {
    const uid = t.user_id ?? 'default';
    kpiMap[`${uid}_${t.dimension}_${t.period}`] = Number(t.target_value);
  }

  // 筛选排序逻辑
  const SORT_OPTIONS: { key: string; label: string; fn: (m: EmployeeMember) => number }[] = [
    { key: 'default', label: '默认排序', fn: (m) => m.today.followups + m.today.calls + m.today.orders + m.today.new_customers + m.today.inbox_replies },
    { key: 'revenue', label: '成交额 ↓', fn: (m) => m.today.revenue },
    { key: 'orders', label: '订单数 ↓', fn: (m) => m.today.orders },
    { key: 'followups', label: '跟进数 ↓', fn: (m) => m.today.followups },
    { key: 'calls', label: '通话数 ↓', fn: (m) => m.today.calls },
    { key: 'customers', label: '新客户 ↓', fn: (m) => m.today.new_customers },
    { key: 'replies', label: '回复数 ↓', fn: (m) => m.today.inbox_replies },
  ];
  const sortOpt = SORT_OPTIONS.find((o) => o.key === sortKey)!;
  const getActivity = (m: EmployeeMember) => m.today.followups + m.today.calls + m.today.orders + m.today.new_customers + m.today.inbox_replies;
  const filteredMembers = members
    .filter((m) => {
      const q = searchQuery.toLowerCase();
      if (q && !(m.real_name || m.username).toLowerCase().includes(q) && !(m.wework_userid || '').toLowerCase().includes(q)) return false;
      if (statusFilter === 'online' && !m.is_online) return false;
      if (statusFilter === 'offline' && m.is_online) return false;
      if (statusFilter === 'active' && getActivity(m) === 0) return false;
      return true;
    })
    .sort((a, b) => {
      const aPin = pinnedIds.indexOf(a.id);
      const bPin = pinnedIds.indexOf(b.id);
      if (aPin !== -1 || bPin !== -1) {
        if (aPin === -1) return 1;
        if (bPin === -1) return -1;
        return aPin - bPin;
      }
      return sortOpt.fn(b) - sortOpt.fn(a);
    });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>员工活动监控</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>每30秒自动刷新</span>
          <button
            onClick={() => { loadKpi(); setKpiModalVisible(true); }}
            style={{
              border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, padding: '4px 12px',
              fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
            }}
          >⚙️ KPI目标</button>
          <button
            onClick={() => exportCSV(data)}
            style={{
              border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, padding: '4px 12px',
              fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
            }}
          >📥 导出CSV</button>
        </div>
      </div>

      {/* 异常告警 */}
      {(() => {
        const anomalies = members.filter((m) => m.is_online && getActivity(m) === 0);
        if (anomalies.length === 0) return null;
        return (
          <div style={{
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)',
            border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#991B1B', flex: 1 }}>
              有 <strong>{anomalies.length}</strong> 名员工在线但今日暂无活动：
              {anomalies.map((m) => m.real_name || m.username).join('、')}
            </span>
          </div>
        );
      })()}

      {/* 概览卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard label="在线员工" value={summary.online_users} unit={`/ ${summary.total_users}`} color="#639922" />
        <MetricCard label="今日活跃" value={summary.active_today} unit={`/ 7日${summary.active_past_7days}人`} color="#378ADD" />
        <MetricCard label="今日跟进" value={summary.total_followups_today} unit="次" growth={growthPct(summary.total_followups_today, prev.total_followups)} />
        <MetricCard label="今日通话" value={summary.total_calls_today} unit="通" growth={growthPct(summary.total_calls_today, prev.total_calls)} />
        <MetricCard label="今日订单" value={summary.total_orders_today} unit="单" growth={growthPct(summary.total_orders_today, prev.total_orders)} />
        <MetricCard label="今日成交额" value={`¥${formatRevenue(summary.total_revenue_today)}`} color="#EF9F27" growth={growthPct(summary.total_revenue_today, prev.total_revenue)} />
        <MetricCard label="今日新增客户" value={summary.total_new_customers_today} unit="人" color="#378ADD" growth={growthPct(summary.total_new_customers_today, prev.total_new_customers)} />
        <MetricCard label="今日回复" value={summary.total_inbox_replies_today} unit="条" color="#639922" growth={growthPct(summary.total_inbox_replies_today, prev.total_inbox_replies)} />
      </div>

      {/* 本周汇总 vs 上周 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          本周汇总（周一至今） vs 上周同期
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <MetricCard label="本周跟进" value={wk.total_followups} unit="次" growth={growthPct(wk.total_followups, wkPrev.total_followups)} />
          <MetricCard label="本周通话" value={wk.total_calls} unit="通" growth={growthPct(wk.total_calls, wkPrev.total_calls)} />
          <MetricCard label="本周订单" value={wk.total_orders} unit="单" growth={growthPct(wk.total_orders, wkPrev.total_orders)} />
          <MetricCard label="本周成交额" value={`¥${formatRevenue(wk.total_revenue)}`} color="#EF9F27" growth={growthPct(wk.total_revenue, wkPrev.total_revenue)} />
          <MetricCard label="本周新增客户" value={wk.total_new_customers} unit="人" color="#378ADD" growth={growthPct(wk.total_new_customers, wkPrev.total_new_customers)} />
          <MetricCard label="本周回复" value={wk.total_inbox_replies} unit="条" color="#639922" growth={growthPct(wk.total_inbox_replies, wkPrev.total_inbox_replies)} />
        </div>
      </div>

      {/* 活动趋势 */}
      <div style={{
        background: 'var(--color-background-primary)', borderRadius: 10,
        border: '0.5px solid var(--color-border-tertiary)', padding: '16px 20px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>活动趋势</span>
            <div style={{ display: 'flex', gap: 2, background: 'var(--color-background-tertiary)', borderRadius: 6, padding: 2 }}>
              {[7, 14, 30].map((n) => (
                <button key={n} onClick={() => setTrendDays(n)}
                  style={{
                    border: 'none', borderRadius: 4, padding: '3px 8px',
                    fontSize: 11, cursor: 'pointer', fontWeight: trendDays === n ? 500 : 400,
                    background: trendDays === n ? 'var(--color-background-brand)' : 'transparent',
                    color: trendDays === n ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >{n}天</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {TREND_BARS.map((b) => (
              <span key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: b.fill, display: 'inline-block' }} />
                {b.label}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trendSlice} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              interval={trendDays > 14 ? 'preserveStartEnd' : undefined}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => `${label} (${new Date(label).toLocaleDateString('zh-CN', { weekday: 'short' })})`}
            />
            {TREND_BARS.map((b) => (
              <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.fill} stackId="a" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 今日时段分布 */}
      <HourlyDistribution data={data.hourly_distribution} />

      {/* 排行榜 */}
      <Leaderboard rankings={data.rankings} />

      {/* 员工卡片 + 日志 两栏 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* 员工列表 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>
              团队成员（{filteredMembers.length}/{members.length}人）
            </h3>
          </div>
          {/* 筛选工具栏 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="搜索姓名或企微号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, padding: '4px 10px',
                fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
                width: 160, outline: 'none',
              }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, padding: '4px 6px', fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none' }}>
              <option value="all">全部状态</option>
              <option value="online">🟢 在线</option>
              <option value="offline">⚫ 离线</option>
              <option value="active">🔥 有活动</option>
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
              style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, padding: '4px 6px', fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none' }}>
              {SORT_OPTIONS.map((o) => (<option key={o.key} value={o.key}>{o.label}</option>))}
            </select>
          </div>
          {filteredMembers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              无匹配结果
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredMembers.map((m) => {
              const isPinned = pinnedIds.includes(m.id);
              const hasActivity = getActivity(m) > 0;
              // KPI 进度
              const kpiItems = [
                { key: 'followups', label: '跟进', val: m.today.followups, tgt: kpiMap[`${m.id}_followups_daily`] ?? kpiMap['default_followups_daily'] ?? null },
                { key: 'calls', label: '通话', val: m.today.calls, tgt: kpiMap[`${m.id}_calls_daily`] ?? kpiMap['default_calls_daily'] ?? null },
                { key: 'orders', label: '订单', val: m.today.orders, tgt: kpiMap[`${m.id}_orders_daily`] ?? kpiMap['default_orders_daily'] ?? null },
                { key: 'revenue', label: '成交', val: m.today.revenue, tgt: kpiMap[`${m.id}_revenue_daily`] ?? kpiMap['default_revenue_daily'] ?? null },
              ];
              return (
                <div key={m.id} style={{
                  background: 'var(--color-background-primary)', borderRadius: 10,
                  border: isPinned ? '2px solid #F59E0B' : m.is_online ? '1.5px solid #378ADD' : '0.5px solid var(--color-border-tertiary)',
                  padding: '12px 16px',
                  opacity: m.is_online ? 1 : 0.65,
                  transition: 'opacity 0.2s, box-shadow 0.15s',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                  onClick={() => setDetailMember(m)}
                  title="点击查看详情"
                >
                  {/* 星标按钮 */}
                  <button onClick={(e) => { e.stopPropagation(); togglePin(m.id); }}
                    title={isPinned ? '取消关注' : '关注置顶'}
                    style={{
                      position: 'absolute', top: 6, right: 8,
                      border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: isPinned ? 16 : 14, padding: 0,
                      color: isPinned ? '#F59E0B' : 'var(--color-text-secondary)',
                      opacity: isPinned ? 1 : 0.4,
                      lineHeight: 1,
                    }}
                  >{isPinned ? '★' : '☆'}</button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: m.is_online ? '#378ADD' : 'var(--color-background-tertiary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: m.is_online ? '#fff' : 'var(--color-text-secondary)',
                        fontSize: 14, fontWeight: 500, flexShrink: 0,
                      }}>
                        {(m.real_name || m.username)?.slice(0, 2) || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {m.real_name || m.username}
                          {isPinned && <span style={{ fontSize: 11, color: '#F59E0B', marginLeft: 6 }}>⭐</span>}
                          {m.is_online && (
                            <span style={{
                              fontSize: 11, color: '#639922', marginLeft: 8,
                              background: 'rgba(99,153,34,0.1)', padding: '1px 6px', borderRadius: 4,
                            }}>
                              在线
                            </span>
                          )}
                          {!m.is_online && m.last_login_at && (
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                              {formatTime(m.last_login_at)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {m.wework_userid ? `企微: ${m.wework_userid}` : '未绑定企微'}
                        </div>
                      </div>
                    </div>

                    {hasActivity && (
                      <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {m.today.new_customers > 0 && <span>新增{m.today.new_customers}</span>}
                        {m.today.followups > 0 && <span>跟进{m.today.followups}</span>}
                        {m.today.calls > 0 && <span>通话{m.today.calls}</span>}
                        {m.today.inbox_replies > 0 && <span style={{ color: '#639922' }}>回复{m.today.inbox_replies}</span>}
                        {m.today.orders > 0 && (
                          <span style={{ fontWeight: 500, color: '#EF9F27' }}>
                            成交{m.today.orders}
                            <span style={{ marginLeft: 4, fontSize: 12 }}>
                              ¥{formatRevenue(m.today.revenue)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {!hasActivity && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>暂无活动</span>
                    )}
                  </div>

                  {/* KPI 进度条 */}
                  {kpiItems.some((k) => k.tgt !== null && k.tgt > 0) && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                      {kpiItems.filter((k) => k.tgt !== null && k.tgt > 0).map((k) => (
                        <KpiProgress key={k.key} label={k.label} value={k.val} target={k.tgt} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* 最近操作日志 */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 12px 0' }}>
            最近操作
          </h3>
          <div style={{
            background: 'var(--color-background-primary)', borderRadius: 10,
            border: '0.5px solid var(--color-border-tertiary)', padding: 12,
            maxHeight: 'calc(100vh - 320px)', overflowY: 'auto',
          }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, padding: 16, textAlign: 'center' }}>
                暂无操作记录
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {logs.map((log) => (
                  <div key={log.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '6px 0', borderBottom: '0.5px solid var(--color-border-tertiary)',
                  }}>
                    <span style={{
                      fontSize: 12, color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap', minWidth: 48, textAlign: 'right',
                    }}>
                      {formatTime(log.created_at)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 }}>
                      {log.actor?.real_name || '系统'}
                    </span>
                    <span style={{
                      fontSize: 12, color: 'var(--color-text-secondary)',
                      background: 'var(--color-background-tertiary)',
                      padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                    }}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 员工详情抽屉 */}
      {detailMember && (
        <EmployeeDetail
          member={detailMember}
          dailyTrend={data.daily_trend}
          dailyActivity={data.member_daily_activity?.[detailMember.id] || []}
          logs={logs.filter((l) => l.actor?.id === detailMember.id)}
          rankings={data.rankings}
          kpiMap={kpiMap}
          onClose={() => setDetailMember(null)}
        />
      )}

      {/* KPI 目标管理弹窗 */}
      <KpiTargetModal
        visible={kpiModalVisible}
        onClose={() => setKpiModalVisible(false)}
        targets={kpiTargets}
        users={kpiUsers}
        onRefresh={() => { loadKpi(); setData(null); load(); }}
      />
    </div>
  );
}

// ─── 指标卡片 ─────────────────────────────────────
function MetricCard({ label, value, unit, color, growth }: {
  label: string; value: number | string; unit?: string; color?: string;
  growth?: { arrow: string; pct: number | null; color: string };
}) {
  return (
    <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 500, color: color || 'var(--color-text-primary)' }}>
          {value}
          {unit && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 4 }}>{unit}</span>}
        </span>
        {growth && growth.pct !== null && growth.pct !== 0 && (
          <span style={{ fontSize: 12, fontWeight: 500, color: growth.color }}>
            {growth.arrow} {growth.pct}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 时段分布 ─────────────────────────────────────
function HourlyDistribution({ data }: { data: HourlyPoint[] }) {
  const peakHour = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);

  return (
    <div style={{
      background: 'var(--color-background-primary)', borderRadius: 10,
      border: '0.5px solid var(--color-border-tertiary)', padding: '16px 20px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>今日时段活跃分布</span>
          {peakHour.count > 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              高峰 {peakHour.hour}:00-{peakHour.hour + 1}:00（{peakHour.count} 次操作）
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#378ADD" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#378ADD" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="hour"
            tickFormatter={(h: number) => `${h}h`}
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8,
              fontSize: 12,
            }}
            {...{ labelFormatter: (h: number) => `${h}:00 - ${h + 1}:00`, formatter: (value: number) => [`${value} 次操作`, '活跃量'] } as any}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#378ADD"
            strokeWidth={2}
            fill="url(#hourlyGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#378ADD' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 排行榜 ───────────────────────────────────────
function Leaderboard({ rankings }: { rankings: RankingDimension[] }) {
  const [tab, setTab] = useState(0);
  const dim = rankings[tab];
  if (!dim) return null;

  const maxVal = dim.items[0]?.value || 1;

  return (
    <div style={{
      background: 'var(--color-background-primary)', borderRadius: 10,
      border: '0.5px solid var(--color-border-tertiary)', padding: '16px 20px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>排行榜</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {rankings.map((r, i) => (
            <button
              key={r.key}
              onClick={() => setTab(i)}
              style={{
                border: 'none', borderRadius: 6, padding: '4px 10px',
                fontSize: 12, cursor: 'pointer', fontWeight: tab === i ? 500 : 400,
                background: tab === i ? 'var(--color-background-brand)' : 'var(--color-background-tertiary)',
                color: tab === i ? '#fff' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {dim.items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          暂无数据
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dim.items.map((item, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
            const barPct = Math.max((item.value / maxVal) * 100, 4);
            const rankColor = idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#D97706' : 'var(--color-text-secondary)';
            return (
              <div key={item.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 28, textAlign: 'center', fontSize: 16, fontWeight: 500, color: rankColor }}>
                  {medal || item.rank}
                </span>
                <span style={{ width: 70, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.real_name}
                </span>
                <div style={{ flex: 1, height: 20, background: 'var(--color-background-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${barPct}%`,
                    background: idx === 0
                      ? 'linear-gradient(90deg, #F59E0B, #FCD34D)'
                      : idx === 1
                      ? 'linear-gradient(90deg, #94A3B8, #CBD5E1)'
                      : idx === 2
                      ? 'linear-gradient(90deg, #D97706, #FBBF24)'
                      : 'var(--color-fill-brand)',
                    minWidth: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 500, color: rankColor }}>
                  {item.display}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 员工详情抽屉 ─────────────────────────────────
function EmployeeDetail({ member, dailyTrend, dailyActivity, logs, rankings, kpiMap, onClose }: {
  member: EmployeeMember;
  dailyTrend: DailyTrendPoint[];
  dailyActivity: { date: string; count: number }[];
  logs: { id: number; action: string; target_type: string | null; target_id: string | null; actor: { id: number; real_name: string } | null; created_at: string }[];
  rankings: RankingDimension[];
  kpiMap: Record<string, number>;
  onClose: () => void;
}) {
  const trend7 = dailyTrend.slice(-7);
  const rankPositions = rankings.map((dim) => {
    const idx = dim.items.findIndex((i) => i.user_id === member.id);
    return idx >= 0 ? { key: dim.key, label: dim.label, rank: idx + 1, display: dim.items[idx].display } : null;
  }).filter(Boolean);

  // KPI 进度（抽屉中的详细展示）
  const kpiList = [
    { key: 'followups', label: '跟进目标', val: member.today.followups, tgt: kpiMap[`${member.id}_followups_daily`] ?? kpiMap['default_followups_daily'] ?? null, unit: '次' },
    { key: 'calls', label: '通话目标', val: member.today.calls, tgt: kpiMap[`${member.id}_calls_daily`] ?? kpiMap['default_calls_daily'] ?? null, unit: '通' },
    { key: 'orders', label: '订单目标', val: member.today.orders, tgt: kpiMap[`${member.id}_orders_daily`] ?? kpiMap['default_orders_daily'] ?? null, unit: '单' },
    { key: 'revenue', label: '成交额目标', val: member.today.revenue, tgt: kpiMap[`${member.id}_revenue_daily`] ?? kpiMap['default_revenue_daily'] ?? null, unit: '元', fmt: (v: number) => `¥${formatRevenue(v)}` },
    { key: 'new_customers', label: '新客目标', val: member.today.new_customers, tgt: kpiMap[`${member.id}_new_customers_daily`] ?? kpiMap['default_new_customers_daily'] ?? null, unit: '人' },
  ].filter((k) => k.tgt !== null && k.tgt > 0);

  // AI 教练建议
  const [coachingInsight, setCoachingInsight] = useState<string | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const handleGenerateInsight = useCallback(async () => {
    setCoachingLoading(true);
    try {
      const rankData = rankPositions.map((rp) => ({ dimension: rp!.label, rank: rp!.rank }));
      const res = await fetchCoachingInsight({
        name: member.real_name || member.username,
        today: member.today,
        yesterday: member.yesterday,
        kpi: member.kpi,
        trend30: dailyActivity,
        rankings: rankData,
      });
      setCoachingInsight(res.insight);
    } catch {
      setCoachingInsight('AI 生成失败，请稍后重试');
    } finally {
      setCoachingLoading(false);
    }
  }, [member, dailyActivity, rankPositions]);

  return (
    <>
      {/* 背景遮罩 */}
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)', zIndex: 1000,
      }} />
      {/* 抽屉 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: 'var(--color-background-primary)', zIndex: 1001,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 头部 */}
        <div style={{ padding: '20px 24px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: member.is_online ? '#378ADD' : 'var(--color-background-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: member.is_online ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 18, fontWeight: 500,
            }}>
              {(member.real_name || member.username)?.slice(0, 2) || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 16 }}>{member.real_name || member.username}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {member.is_online ? <span style={{ color: '#639922' }}>● 在线</span> : '离线'}
                {member.wework_userid && ` · 企微: ${member.wework_userid}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>✕</button>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* 今日明细（含昨日对比） */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>今日 vs 昨日</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: '跟进', key: 'followups' as const, unit: '次' },
                { label: '通话', key: 'calls' as const, unit: '通', sub: `${member.today.call_duration_sec}秒` },
                { label: '订单', key: 'orders' as const, unit: '单' },
                { label: '成交额', key: 'revenue' as const, unit: '', fmt: (v: number) => `¥${formatRevenue(v)}` },
                { label: '新增客户', key: 'new_customers' as const, unit: '人' },
                { label: '回复', key: 'inbox_replies' as const, unit: '条' },
              ].map((item) => {
                const todayVal = member.today[item.key];
                const yestVal = member.yesterday[item.key];
                const g = growthPct(todayVal, yestVal);
                const displayVal = item.fmt ? item.fmt(todayVal) : todayVal;
                return (
                <div key={item.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.label}</span>
                    {g.pct !== null && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: g.color }}>vs 昨 {g.arrow}{g.pct}%</span>
                    )}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 500 }}>
                    {displayVal}{item.unit && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 2 }}>{item.unit}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                    昨日: {item.fmt ? item.fmt(yestVal) : yestVal}{item.unit}
                  </div>
                  {item.sub && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.sub}</div>}
                </div>
                );
              })}
            </div>
          </div>

          {/* KPI 目标进度（抽屉中详细展示） */}
          {kpiList.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>今日 KPI 进度</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {kpiList.map((k) => {
                  const pct = Math.min(Math.round((k.val / k.tgt!) * 100), 999);
                  const color = pct >= 100 ? '#16A34A' : pct >= 70 ? '#F59E0B' : 'var(--color-background-brand)';
                  return (
                    <div key={k.key} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13 }}>{k.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color }}>
                          {k.fmt ? k.fmt(k.val) : k.val} / {k.fmt ? k.fmt(k.tgt!) : k.tgt}{k.unit}
                        </span>
                      </div>
                      <div style={{ height: 10, background: 'var(--color-background-tertiary)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${Math.min(pct, 100)}%`,
                          background: pct >= 100 ? '#16A34A' : pct >= 70 ? '#F59E0B' : 'var(--color-background-brand)',
                          borderRadius: 5, transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: color, marginTop: 4, fontWeight: 500 }}>{pct}% 完成</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 30天活动热力图 */}
          {dailyActivity.length > 0 && dailyActivity.some((d) => d.count > 0) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>近30天活动热力图</div>
              <ActivityHeatmap data={dailyActivity} />
            </div>
          )}

          {/* AI 教练建议 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>🤖 AI 教练建议</div>
              {!coachingInsight && (
                <button
                  onClick={handleGenerateInsight}
                  disabled={coachingLoading}
                  style={{
                    border: 'none', background: 'var(--color-background-brand, #378ADD)', color: '#fff',
                    borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                    opacity: coachingLoading ? 0.6 : 1,
                  }}
                >
                  {coachingLoading ? '生成中...' : '生成建议'}
                </button>
              )}
            </div>
            {coachingInsight && (
              <div style={{
                background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FAFE 100%)',
                border: '0.5px solid #D6E4F0',
                borderRadius: 10, padding: 14,
                fontSize: 13, lineHeight: 1.7, color: '#2C3E50',
              }}>
                <div style={{ marginBottom: 4 }}>{coachingInsight}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <button
                    onClick={handleGenerateInsight}
                    disabled={coachingLoading}
                    style={{
                      border: 'none', background: 'transparent', color: 'var(--color-text-link, #378ADD)',
                      fontSize: 11, cursor: 'pointer', padding: 0,
                    }}
                  >
                    {coachingLoading ? '刷新中...' : '🔄 重新生成'}
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>Powered by AI</span>
                </div>
              </div>
            )}
            {!coachingInsight && !coachingLoading && (
              <div style={{
                background: 'var(--color-background-secondary)',
                borderRadius: 10, padding: 16, textAlign: 'center',
                fontSize: 12, color: 'var(--color-text-secondary)',
              }}>
                点击「生成建议」，AI 将分析该员工的活动数据并给出个性化改善建议
              </div>
            )}
          </div>

          {/* 7天趋势 */}
          {trend7.some((d) => d.total > 0) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>近7天趋势</div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={trend7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#378ADD" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#378ADD" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" stroke="#378ADD" strokeWidth={2} fill="url(#memberGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 排行榜位置 */}
          {rankPositions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>排行榜表现</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rankPositions.map((rp) => (
                  <div key={rp!.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span>{rp!.label}</span>
                    <span style={{ fontWeight: 500, color: rp!.rank <= 3 ? '#EF9F27' : 'var(--color-text-secondary)' }}>
                      #{rp!.rank} {rp!.display}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作日志 */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>操作日志</div>
            {logs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>暂无操作记录</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {logs.slice(0, 20).map((log) => (
                  <div key={log.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatTime(log.created_at)}</span>
                    <span style={{
                      background: 'var(--color-background-tertiary)', padding: '1px 6px', borderRadius: 4,
                      color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
                    }}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
