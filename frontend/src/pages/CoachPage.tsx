import React, { useEffect, useState, useCallback } from 'react'
import {
  fetchCoachSuggestions, generateCoaching, generateAllCoaching,
  dismissCoaching, implementCoaching,
  COACH_TYPE_LABELS, COACH_TYPE_ICONS, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS,
} from '@/api/coaching'
import type {
  CoachSuggestion, CoachType, SuggestionStatus, SnapshotData,
} from '@/api/coaching'

// ============================================================
// 维度 Tab
// ============================================================

const ALL_TABS: { key: CoachType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '📋' },
  { key: 'followup', label: '跟进效率', icon: '🔁' },
  { key: 'call', label: '通话能力', icon: '📞' },
  { key: 'deal', label: '成交转化', icon: '💰' },
  { key: 'develop', label: '客户开发', icon: '🌱' },
  { key: 'time', label: '时间管理', icon: '⏰' },
  { key: 'overall', label: '综合建议', icon: '🎯' },
]

// ============================================================
// 指标快照 Popover 内容
// ============================================================

const SnapshotPopover: React.FC<{ data: SnapshotData }> = ({ data }) => {
  if (!data) return null
  const { today, yesterday, week7, month30, customers, tasks, kpi } = data

  const growthColor = (v: number) => (v > 0 ? '#10B981' : v < 0 ? '#EF4444' : '#6B7280')
  const formatGrowth = (t: number, y: number) => {
    if (!y) return t ? '+新增' : '—'
    const pct = Math.round(((t - y) / y) * 100)
    return pct >= 0 ? `↑${pct}%` : `↓${Math.abs(pct)}%`
  }

  return (
    <div style={{ padding: 12, fontSize: 12, minWidth: 200 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#1F2937' }}>📊 今日指标</div>
      <Row label="跟进" value={`${today.followups} 次`} sub={formatGrowth(today.followups, yesterday.followups)} subColor={growthColor(today.followups - yesterday.followups)} />
      <Row label="通话" value={`${today.calls} 次 (${today.call_duration_min}min)`} sub={formatGrowth(today.calls, yesterday.calls)} subColor={growthColor(today.calls - yesterday.calls)} />
      <Row label="成交" value={`${today.orders} 笔 ¥${today.revenue.toLocaleString()}`} sub={formatGrowth(today.orders, yesterday.orders)} subColor={growthColor(today.orders - yesterday.orders)} />
      <Row label="新客" value={`${today.new_customers} 个`} />
      <Row label="收件箱" value={`${today.inbox_replies} 条回复`} />
      <div style={{ borderTop: '1px solid #E5E7EB', margin: '8px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#1F2937' }}>📈 短期趋势</div>
      <Row label="7天跟进" value={`${week7.followups} 次`} />
      <Row label="7天通话" value={`${week7.calls} 次`} />
      <Row label="7天成交" value={`${week7.orders} 笔`} />
      <Row label="7天任务" value={`${week7.tasks} 个`} />
      <div style={{ borderTop: '1px solid #E5E7EB', margin: '8px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#1F2937' }}>👥 客户与任务</div>
      <Row label="客户池" value={`${customers.total} 个`} />
      <Row label="高意向" value={`${customers.high_intent} 个`} />
      <Row label="30天新客" value={`${customers.new_30d} 个`} />
      <Row label="任务完成" value={`${tasks.done_rate}% (${tasks.done}/${tasks.total})`} />
      <Row label="月度成交额" value={`¥${month30.revenue.toLocaleString()}`} />
      {kpi && Object.keys(kpi).length > 0 && (
        <>
          <div style={{ borderTop: '1px solid #E5E7EB', margin: '8px 0' }} />
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#1F2937' }}>🎯 KPI 达成</div>
          {kpi.followups_pct != null && <Row label="跟进" value={`${kpi.followups_pct}%`} />}
          {kpi.calls_pct != null && <Row label="通话" value={`${kpi.calls_pct}%`} />}
          {kpi.orders_pct != null && <Row label="订单" value={`${kpi.orders_pct}%`} />}
          {kpi.revenue_pct != null && <Row label="成交额" value={`${kpi.revenue_pct}%`} />}
        </>
      )}
    </div>
  )
}

const Row: React.FC<{ label: string; value: string; sub?: string; subColor?: string }> = ({ label, value, sub, subColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#374151' }}>
    <span>{label}</span>
    <span>
      {value}
      {sub && <span style={{ marginLeft: 8, color: subColor || '#6B7280', fontSize: 11 }}>{sub}</span>}
    </span>
  </div>
)

// ============================================================
// 主页面
// ============================================================

const CoachPage: React.FC = () => {
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<CoachType | 'all'>('all');
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<number>>(new Set());

  // 加载列表
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (activeTab !== 'all') params.coachType = activeTab;
      const res = await fetchCoachSuggestions(params);
      setSuggestions(res.items);
      setTotal(res.total);
    } catch (e: any) {
      console.error('加载教练建议失败:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  // 为指定员工生成
  const handleGenerate = async (userId: number) => {
    setGenerating(true);
    try {
      await generateCoaching(userId);
      await load();
    } catch (e: any) {
      alert('生成失败: ' + (e.message || '未知错误'));
    } finally {
      setGenerating(false);
    }
  };

  // 批量生成
  const handleGenerateAll = async () => {
    if (!confirm('将为所有活跃员工生成教练建议，需消耗 AI 配额，确认？')) return;
    setGenerating(true);
    try {
      const r = await generateAllCoaching();
      alert(`已为 ${r.users.length} 名员工生成 ${r.generated} 条建议`);
      await load();
    } catch (e: any) {
      alert('批量生成失败: ' + (e.message || '未知错误'));
    } finally {
      setGenerating(false);
    }
  };

  // 忽略/实施
  const handleDismiss = async (id: number) => {
    try {
      await dismissCoaching(id);
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'dismissed' as SuggestionStatus } : s));
    } catch (e: any) { alert('操作失败: ' + e.message); }
  };

  const handleImplement = async (id: number) => {
    try {
      await implementCoaching(id);
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'implemented' as SuggestionStatus } : s));
    } catch (e: any) { alert('操作失败: ' + e.message); }
  };

  // 按员工分组
  const grouped = suggestions.reduce((acc, s) => {
    const uid = s.user_id;
    if (!acc[uid]) acc[uid] = { user: s.target_user, items: [] };
    acc[uid].items.push(s);
    return acc;
  }, {} as Record<number, { user: CoachSuggestion['target_user']; items: CoachSuggestion[] }>);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
            🧠 AI 教练建议
          </h1>
          <p style={{ color: '#6B7280', fontSize: 13, margin: '4px 0 0' }}>
            每天 8:00 自动分析数据生成个性化教练建议，也可手动触发
          </p>
        </div>
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          style={{
            padding: '10px 24px', background: generating ? '#9CA3AF' : '#6366F1',
            color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14,
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? '⏳ 生成中...' : '🔄 批量生成全部'}
        </button>
      </div>

      {/* 维度 Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {ALL_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none',
              background: activeTab === tab.key ? '#EEF2FF' : '#F3F4F6',
              color: activeTab === tab.key ? '#4338CA' : '#6B7280',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 列表内容 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF' }}>加载中...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState onGenerateAll={handleGenerateAll} generating={generating} />
      ) : (
        Object.entries(grouped).map(([userId, group]) => (
          <EmployeeGroup
            key={userId}
            userId={Number(userId)}
            user={group.user}
            items={group.items}
            onGenerate={handleGenerate}
            onDismiss={handleDismiss}
            onImplement={handleImplement}
            generating={generating}
            expandedSnapshots={expandedSnapshots}
            toggleSnapshot={(id) => {
              setExpandedSnapshots(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              });
            }}
          />
        ))
      )}

      <div style={{ marginTop: 16, color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>
        共 {total} 条建议 · 每天 8:00 自动刷新 · 基于 DeepSeek AI 生成
      </div>
    </div>
  );
};

// ============================================================
// 空状态
// ============================================================

const EmptyState: React.FC<{ onGenerateAll: () => void; generating: boolean }> = ({ onGenerateAll, generating }) => (
  <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF' }}>
    <div style={{ fontSize: 64, marginBottom: 16 }}>🧠</div>
    <h2 style={{ fontSize: 16, fontWeight: 600, color: '#6B7280', margin: '0 0 8px' }}>暂无教练建议</h2>
    <p style={{ fontSize: 13, marginBottom: 24 }}>点击下方按钮，AI 将自动分析团队数据并生成个性化建议</p>
    <button
      onClick={onGenerateAll}
      disabled={generating}
      style={{
        padding: '10px 24px', background: generating ? '#9CA3AF' : '#6366F1',
        color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14,
        cursor: generating ? 'not-allowed' : 'pointer',
      }}
    >
      {generating ? '⏳ 生成中...' : '🚀 开始生成'}
    </button>
  </div>
);

// ============================================================
// 员工分组卡片
// ============================================================

const EmployeeGroup: React.FC<{
  userId: number; user: CoachSuggestion['target_user'];
  items: CoachSuggestion[]; onGenerate: (id: number) => void;
  onDismiss: (id: number) => void; onImplement: (id: number) => void;
  generating: boolean; expandedSnapshots: Set<number>;
  toggleSnapshot: (id: number) => void;
}> = ({ userId, user, items, onGenerate, onDismiss, onImplement, generating, expandedSnapshots, toggleSnapshot }) => {
  const userName = user?.real_name || user?.username || `员工 #${userId}`;
  const activeCount = items.filter(i => i.status === 'active').length;
  const implementedCount = items.filter(i => i.status === 'implemented').length;

  return (
    <div style={{ marginBottom: 20, border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* 员工头部 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: '#6366F1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
            {userName.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>{userName}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {activeCount} 条待处理 · {implementedCount} 条已实施 · {items.length} 条总计
            </div>
          </div>
        </div>
        <button
          onClick={() => onGenerate(userId)}
          disabled={generating}
          style={{
            padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 6,
            background: '#fff', color: '#374151', fontSize: 12, fontWeight: 500,
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? '⏳' : '🔄'} 重新生成
        </button>
      </div>

      {/* 建议卡片 */}
      <div style={{ padding: '12px 20px 20px' }}>
        {items.map(item => (
          <SuggestionCard
            key={item.id}
            item={item}
            onDismiss={onDismiss}
            onImplement={onImplement}
            expanded={expandedSnapshots.has(item.id)}
            onToggle={() => toggleSnapshot(item.id)}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================
// 单条建议卡片
// ============================================================

const SuggestionCard: React.FC<{
  item: CoachSuggestion;
  onDismiss: (id: number) => void;
  onImplement: (id: number) => void;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, onDismiss, onImplement, expanded, onToggle }) => {
  const isActive = item.status === 'active';
  const statusColor =
    item.status === 'active' ? '#3B82F6' :
    item.status === 'implemented' ? '#10B981' : '#9CA3AF';
  const priorityColor = PRIORITY_COLORS[item.priority];

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 10, borderRadius: 10,
      border: `1px solid ${isActive ? '#E5E7EB' : '#F3F4F6'}`,
      background: isActive ? '#fff' : '#F9FAFB',
      opacity: isActive ? 1 : 0.7,
      transition: 'all 0.15s',
    }}>
      {/* 头部：维度 + 优先级 + 状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{COACH_TYPE_ICONS[item.coach_type]}</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
          {COACH_TYPE_LABELS[item.coach_type]}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
          background: priorityColor + '15', color: priorityColor,
        }}>
          {PRIORITY_LABELS[item.priority]}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
          background: statusColor + '15', color: statusColor,
        }}>
          {STATUS_LABELS[item.status]}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          {item.generated_by || 'AI'} · {new Date(item.generated_at).toLocaleDateString('zh-CN')}
        </span>
      </div>

      {/* 内容 */}
      <div style={{ fontSize: 14, lineHeight: 1.6, color: '#374151', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
        {item.content}
      </div>

      {/* 操作区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 指标快照展开 */}
        {item.context_data && (
          <button
            onClick={onToggle}
            style={{
              padding: '4px 10px', border: '1px solid #E5E7EB', borderRadius: 6,
              background: expanded ? '#EEF2FF' : '#fff', color: expanded ? '#4338CA' : '#6B7280',
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {expanded ? '📊 收起指标' : '📊 查看指标'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {isActive && (
          <>
            <button
              onClick={() => onImplement(item.id)}
              style={{
                padding: '5px 12px', border: '1px solid #10B981', borderRadius: 6,
                background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              ✅ 已实施
            </button>
            <button
              onClick={() => onDismiss(item.id)}
              style={{
                padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: 6,
                background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer',
              }}
            >
              忽略
            </button>
          </>
        )}
      </div>

      {/* 展开后的指标 */}
      {expanded && item.context_data && (
        <div style={{
          marginTop: 12, padding: 12, background: '#F9FAFB', borderRadius: 8,
          border: '1px solid #E5E7EB',
        }}>
          <SnapshotPopover data={item.context_data} />
        </div>
      )}
    </div>
  );
};

export default CoachPage;
