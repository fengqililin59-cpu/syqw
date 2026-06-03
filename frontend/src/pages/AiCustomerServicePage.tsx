/**
 * @file AI客服监控面板：自动回复统计、风险分布、实时状态。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchAiCustomerServiceStats, updateAiCustomerServiceMode } from '../api/aiCustomerService';
import type { AiCustomerServiceStats } from '../api/aiCustomerService';

const RISK_COLORS: Record<string, string> = { p0: '#639922', p1: '#EF9F27', p2: '#E24B4A' };
const RISK_LABELS: Record<string, string> = { p0: 'FAQ低风险', p1: '询价中风险', p2: '投诉高风险' };

type Mode = 'manual' | 'semi_auto' | 'full_auto';

const MODE_OPTIONS: { value: Mode; label: string; desc: string }[] = [
  { value: 'manual', label: '手动模式', desc: '所有消息人工审核后发送' },
  { value: 'semi_auto', label: '半自动模式', desc: 'FAQ类自动回复，询价/投诉人工审核' },
  { value: 'full_auto', label: '全自动模式', desc: 'FAQ+询价自动回复，仅投诉转人工' },
];

export default function AiCustomerServicePage() {
  const [stats, setStats] = useState<AiCustomerServiceStats | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAiCustomerServiceStats(days);
      setStats(data);
    } catch {
      setMsg('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const handleModeChange = async (mode: Mode) => {
    setSaving(true);
    setMsg('');
    try {
      await updateAiCustomerServiceMode(mode);
      setMsg('模式切换成功');
      setTimeout(() => setMsg(''), 3000);
      await load();
    } catch {
      setMsg('切换失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--color-text-secondary)' }}>加载中...</div>;
  }

  if (!stats) {
    return <div style={{ padding: 32, color: 'var(--color-text-danger)' }}>加载失败</div>;
  }

  const { summary, risk_distribution: risk, daily_trend: trend } = stats;
  const currentMode = stats.mode;

  const riskData = [
    { name: 'FAQ低风险', value: risk.p0, color: RISK_COLORS.p0 },
    { name: '询价中风险', value: risk.p1, color: RISK_COLORS.p1 },
    { name: '投诉高风险', value: risk.p2, color: RISK_COLORS.p2 },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>AI客服监控</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}
          >
            <option value={1}>今天</option>
            <option value={7}>近7天</option>
            <option value={30}>近30天</option>
            <option value={90}>近90天</option>
          </select>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '8px 16px', marginBottom: 16, borderRadius: 8,
          background: msg.includes('成功') ? 'var(--color-background-success)' : 'var(--color-background-danger)',
          color: msg.includes('成功') ? 'var(--color-text-success)' : 'var(--color-text-danger)',
          fontSize: 13,
        }}>
          {msg}
        </div>
      )}

      {/* 模式选择器 */}
      <div style={{
        background: 'var(--color-background-primary)', borderRadius: 12,
        border: '0.5px solid var(--color-border-tertiary)', padding: 20, marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 16px 0' }}>AI客服模式</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {MODE_OPTIONS.map((opt) => {
            const active = currentMode === opt.value;
            return (
              <button
                key={opt.value}
                disabled={saving}
                onClick={() => handleModeChange(opt.value)}
                style={{
                  padding: '16px 12px', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer',
                  border: active ? '2px solid #378ADD' : '0.5px solid var(--color-border-tertiary)',
                  background: active ? 'rgba(55,138,221,0.06)' : 'var(--color-background-secondary)',
                  textAlign: 'left', opacity: saving ? 0.6 : 1, fontSize: 13,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 4, color: active ? '#378ADD' : 'var(--color-text-primary)' }}>
                  {opt.label}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 核心指标 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'AI自动回复', value: summary.auto_sent, unit: '条' },
          { label: '人工回复', value: summary.manual_sent, unit: '条' },
          { label: '自动化率', value: summary.auto_rate, unit: '%' },
          { label: '活跃会话', value: summary.active_threads, unit: '个' },
        ].map((m) => (
          <div key={m.label} style={{
            background: 'var(--color-background-secondary)', borderRadius: 8, padding: 16,
          }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500 }}>{m.value}<span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 2 }}>{m.unit}</span></div>
          </div>
        ))}
      </div>

      {/* 趋势 + 风险分布 并排 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* 每日趋势 */}
        <div style={{
          background: 'var(--color-background-primary)', borderRadius: 12,
          border: '0.5px solid var(--color-border-tertiary)', padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 12px 0' }}>每日回复趋势</h3>
          {trend.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              暂无数据
            </div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)' }}
                    formatter={(value: any, _name: any) => [`${value} 条`, '']}
                  />
                  <Bar dataKey="auto_sent" stackId="a" fill="#378ADD" name="AI自动" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="manual" stackId="a" fill="#D3D1C7" name="人工" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 风险分布 */}
        <div style={{
          background: 'var(--color-background-primary)', borderRadius: 12,
          border: '0.5px solid var(--color-border-tertiary)', padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 12px 0' }}>风险等级分布</h3>
          {riskData.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              暂无数据
            </div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {riskData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: any) => [`${value} 条`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => RISK_LABELS[value] || value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 状态栏 */}
      <div style={{
        background: 'var(--color-background-primary)', borderRadius: 12,
        border: '0.5px solid var(--color-border-tertiary)', padding: 16,
        display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 13,
        color: 'var(--color-text-secondary)',
      }}>
        <div>
          平均置信度：<span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{stats.avg_confidence}%</span>
        </div>
        <div>
          待审核草稿：<span style={{ fontWeight: 500, color: stats.summary.pending_drafts > 0 ? '#E24B4A' : 'var(--color-text-primary)' }}>{stats.summary.pending_drafts} 条</span>
        </div>
        <div>
          自动草稿：<span style={{ fontWeight: 500, color: stats.tenant_settings.inbox_auto_draft_enabled ? '#639922' : 'var(--color-text-secondary)' }}>
            {stats.tenant_settings.inbox_auto_draft_enabled ? '已开启' : '已关闭'}
          </span>
        </div>
        <div>
          FAQ自动发送：<span style={{ fontWeight: 500, color: stats.tenant_settings.inbox_ai_auto_send ? '#639922' : 'var(--color-text-secondary)' }}>
            {stats.tenant_settings.inbox_ai_auto_send ? '已开启' : '已关闭'}
          </span>
        </div>
        <div>
          询价自动发送：<span style={{ fontWeight: 500, color: stats.tenant_settings.inbox_ai_auto_send_pricing ? '#639922' : 'var(--color-text-secondary)' }}>
            {stats.tenant_settings.inbox_ai_auto_send_pricing ? '已开启' : '已关闭'}
          </span>
        </div>
      </div>
    </div>
  );
}
