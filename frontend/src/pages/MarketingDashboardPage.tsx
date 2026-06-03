import React, { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchMarketingDashboard, type MarketingDashboardData } from '@/api/marketing';

const TYPE_LABELS: Record<string, string> = { email: '邮件', sms: '短信', wechat: '微信' };
const TYPE_COLORS: Record<string, string> = { email: '#4F46E5', sms: '#F59E0B', wechat: '#10B981' };

// ---- 样式常量 ----
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: 1, minWidth: 160,
};
const cardLabel: React.CSSProperties = { fontSize: 13, color: '#6B7280', marginBottom: 6 };
const cardValue: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: '#111827' };
const cardSub: React.CSSProperties = { fontSize: 12, color: '#9CA3AF', marginTop: 4 };
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 };
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' };

export default function MarketingDashboardPage() {
  const [data, setData] = useState<MarketingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchMarketingDashboard({ days });
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>加载中...</div>;
  }
  if (!data) return null;

  const { summary, trend, campaigns, channels } = data;

  // 趋势图数据
  const chartData = trend.map(t => ({
    ...t,
    open_rate_num: parseFloat(t.open_rate),
    click_rate_num: parseFloat(t.click_rate),
  }));

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>📊 营销看板</h2>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{ padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#374151', background: '#fff' }}
        >
          <option value={7}>最近 7 天</option>
          <option value={14}>最近 14 天</option>
          <option value={30}>最近 30 天</option>
          <option value={60}>最近 60 天</option>
        </select>
      </div>

      {/* 概览卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={card}>
          <div style={cardLabel}>总发送量</div>
          <div style={cardValue}>{summary.total_sent.toLocaleString()}</div>
          <div style={cardSub}>{days} 天内</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>打开率</div>
          <div style={{ ...cardValue, color: '#059669' }}>{summary.open_rate}%</div>
          <div style={cardSub}>{summary.total_opened.toLocaleString()} 次打开</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>点击率</div>
          <div style={{ ...cardValue, color: '#2563EB' }}>{summary.click_rate}%</div>
          <div style={cardSub}>{summary.total_clicked.toLocaleString()} 次点击</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>退订率</div>
          <div style={{ ...cardValue, color: '#DC2626' }}>{summary.bounce_rate}%</div>
          <div style={cardSub}>{summary.total_unsubscribed.toLocaleString()} 人退订</div>
        </div>
      </div>

      {/* 渠道对比 */}
      {channels.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {channels.map(ch => (
            <div key={ch.type} style={{ ...card, borderLeft: `4px solid ${TYPE_COLORS[ch.type] || '#9CA3AF'}` }}>
              <div style={cardLabel}>{TYPE_LABELS[ch.type] || ch.type} 渠道</div>
              <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>发送</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{Number(ch.sent).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>打开率</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#059669' }}>{ch.open_rate}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>点击率</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#2563EB' }}>{ch.click_rate}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 趋势图 */}
      <div style={{ ...card, marginBottom: 24, padding: '24px 28px' }}>
        <div style={sectionTitle}>📈 打开率 / 点击率趋势（{days} 天）</div>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              label={{ value: '发送量', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9CA3AF' } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              label={{ value: '百分比 (%)', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9CA3AF' } }}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              {...{} as any}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <Bar yAxisId="left" dataKey="sent" name="发送量" fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={20} />
            <Area yAxisId="right" type="monotone" dataKey="open_rate_num" name="打开率 %" stroke="#059669" fill="#ECFDF5" strokeWidth={2} dot={false} />
            <Area yAxisId="right" type="monotone" dataKey="click_rate_num" name="点击率 %" stroke="#2563EB" fill="#EFF6FF" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 活动排行榜 */}
      <div style={{ ...card, padding: '24px 28px' }}>
        <div style={sectionTitle}>🏆 活动排行榜（按打开率）</div>
        {campaigns.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            暂无已发送活动数据
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40 }}>#</th>
                  <th style={thStyle}>活动名称</th>
                  <th style={thStyle}>渠道</th>
                  <th style={thStyle}>发送量</th>
                  <th style={thStyle}>打开率</th>
                  <th style={thStyle}>点击率</th>
                  <th style={thStyle}>发送时间</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#9CA3AF', width: 40 }}>
                      {i + 1}
                    </td>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        background: `${TYPE_COLORS[c.type] || '#9CA3AF'}18`,
                        color: TYPE_COLORS[c.type] || '#6B7280',
                      }}>
                        {TYPE_LABELS[c.type] || c.type}
                      </span>
                    </td>
                    <td style={tdStyle}>{c.sent_count.toLocaleString()}</td>
                    <td style={tdStyle}>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{c.open_rate}%</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                        ({c.open_count})
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: '#2563EB', fontWeight: 600 }}>{c.click_rate}%</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                        ({c.click_count})
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {c.sent_at ? new Date(c.sent_at).toLocaleDateString('zh-CN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
