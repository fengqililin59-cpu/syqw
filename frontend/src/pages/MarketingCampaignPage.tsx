import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  fetchCampaignStats,
  type MarketingCampaignRecord,
} from '@/api/marketing';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const TYPE_LABEL: Record<string, string> = { email: '📧 邮件', sms: '📱 短信', wechat: '💬 企微' };
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', scheduled: '已排期', sending: '发送中', sent: '已发送', cancelled: '已取消',
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#6B7280', scheduled: '#3B82F6', sending: '#F59E0B', sent: '#10B981', cancelled: '#EF4444',
};

export default function MarketingCampaignPage() {
  const [list, setList] = useState<MarketingCampaignRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaignRecord | null>(null);
  const [statsModal, setStatsModal] = useState<{
    campaign: MarketingCampaignRecord;
    stats: { status: string; count: number }[];
  } | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'email' as 'email' | 'sms' | 'wechat', subject: '', content: '', target_filter: '{}' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCampaigns({ page, page_size: pageSize, type: typeFilter, status: statusFilter, keyword });
      const rows = res.list ?? (res as { items?: MarketingCampaignRecord[] }).items ?? [];
      setList(rows);
      setTotal(res.total ?? rows.length);
    } finally { setLoading(false); }
  }, [page, pageSize, typeFilter, statusFilter, keyword]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ name: '', type: 'email', subject: '', content: '', target_filter: '{}' }); setShowForm(true); };
  const openEdit = (c: MarketingCampaignRecord) => {
    setEditing(c);
    setForm({
      name: c.name, type: c.type, subject: c.subject || '', content: c.content || '',
      target_filter: c.target_filter ? JSON.stringify(c.target_filter) : '{}',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, target_filter: form.target_filter ? JSON.parse(form.target_filter) : null };
    if (editing) await updateCampaign(editing.id, payload);
    else await createCampaign(payload);
    setShowForm(false); load();
  };

  const handleDelete = async (id: number) => { await deleteCampaign(id); setConfirmDel(null); load(); };

  const handleSend = async (id: number) => {
    setSendingId(id);
    try { await sendCampaign(id); alert('发送任务已提交！'); load(); }
    finally { setSendingId(null); }
  };

  const handleViewStats = async (c: MarketingCampaignRecord) => {
    const data = await fetchCampaignStats(c.id);
    setStatsModal({ campaign: c, stats: data.message_stats || [] });
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>📣 营销活动</h2>
        <button onClick={openCreate} style={btnPrimary}>＋ 新建活动</button>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          style={selStyle}><option value="">全部类型</option><option value="email">邮件</option><option value="sms">短信</option><option value="wechat">企微</option></select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={selStyle}><option value="">全部状态</option><option value="draft">草稿</option><option value="scheduled">已排期</option><option value="sending">发送中</option><option value="sent">已发送</option><option value="cancelled">已取消</option></select>
        <input placeholder="搜索活动名称..." value={keyword} onChange={e => setKeyword(e.target.value)}
          style={inpStyle} onKeyDown={e => e.key === 'Enter' && setPage(1)} />
      </div>

      {/* 表格 */}
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>加载中...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          <thead><tr style={{ background: '#F9FAFB' }}>
            <th style={thStyle}>活动名称</th><th style={thStyle}>类型</th><th style={thStyle}>状态</th>
            <th style={thStyle}>目标数</th><th style={thStyle}>已发送</th><th style={thStyle}>打开率</th>
            <th style={thStyle}>点击率</th><th style={thStyle}>创建时间</th><th style={thStyle}>操作</th>
          </tr></thead>
          <tbody>
            {list.map(c => {
              const openRate = c.sent_count > 0 ? ((c.open_count / c.sent_count) * 100).toFixed(1) : '-';
              const clickRate = c.sent_count > 0 ? ((c.click_count / c.sent_count) * 100).toFixed(1) : '-';
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={tdStyle}><span style={{ fontWeight: 500 }}>{c.name}</span><br/><span style={{ fontSize: 12, color: '#9CA3AF' }}>{c.subject}</span></td>
                  <td style={tdStyle}>{TYPE_LABEL[c.type] || c.type}</td>
                  <td style={tdStyle}><span style={{ color: STATUS_COLOR[c.status] || '#6B7280', fontWeight: 500 }}>{STATUS_LABEL[c.status] || c.status}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{c.target_count}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{c.sent_count}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{openRate}%</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{clickRate}%</td>
                  <td style={tdStyle}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.status === 'draft' && <button onClick={() => handleSend(c.id)} disabled={sendingId === c.id}
                        style={{ ...btnSm, ...btnGreen }}>{sendingId === c.id ? '发送中...' : '📤 发送'}</button>}
                      <button onClick={() => handleViewStats(c)} style={{ ...btnSm, ...btnBlue }}>📊 统计</button>
                      {c.status === 'draft' && <button onClick={() => openEdit(c)} style={{ ...btnSm, ...btnGray }}>✏️</button>}
                      {c.status === 'draft' && <button onClick={() => setConfirmDel(c.id)} style={{ ...btnSm, ...btnRed }}>🗑️</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>暂无营销活动</td></tr>}
          </tbody>
        </table>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />

      {/* 新建/编辑弹窗 */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ marginTop: 0 }}>{editing ? '编辑活动' : '新建营销活动'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={fieldStyle}><label>活动名称 *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inpStyle} /></div>
              <div style={fieldStyle}><label>渠道类型 *</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} style={selStyle}>
                <option value="email">📧 邮件</option><option value="sms">📱 短信</option><option value="wechat">💬 企业微信</option>
              </select></div>
              {form.type === 'email' && <>
                <div style={fieldStyle}><label>邮件主题</label><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={inpStyle} placeholder="支持变量 {{customer_name}}" /></div>
                <div style={fieldStyle}><label>邮件内容 (HTML)</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inpStyle, minHeight: 120 }} placeholder="支持变量 {{customer_name}} {{company_name}}" /></div>
              </>}
              {form.type === 'sms' && <div style={fieldStyle}><label>短信内容</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inpStyle, minHeight: 80 }} placeholder="不超过500字，支持变量" /></div>}
              <div style={fieldStyle}><label>目标筛选 (JSON)</label><textarea value={form.target_filter} onChange={e => setForm(f => ({ ...f, target_filter: e.target.value }))} style={{ ...inpStyle, minHeight: 60, fontFamily: 'monospace', fontSize: 12 }} placeholder='{"tags":[],"stage":"","source":""}' /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnCancel}>取消</button>
                <button type="submit" style={btnPrimary}>{editing ? '保存' : '创建'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 统计弹窗 */}
      {statsModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>📊 {statsModal.campaign.name} — 发送统计</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {statsModal.stats.map(s => (
                <div key={s.status} style={{ padding: '12px 16px', background: '#F9FAFB', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{s.status}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{s.count}</div>
                </div>
              ))}
              {statsModal.stats.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#9CA3AF', padding: 20 }}>暂无发送记录</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setStatsModal(null)} style={btnPrimary}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel !== null && (
        <ConfirmDialog message="确定删除此营销活动？已发送的邮件记录将保留。" onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

// styles
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' };
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 14, color: '#111827', verticalAlign: 'top' };
const inpStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const selStyle = inpStyle;
const fieldStyle: React.CSSProperties = { marginBottom: 16 };
const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 };
const btnCancel: React.CSSProperties = { padding: '8px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer' };
const btnSm: React.CSSProperties = { padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnGreen = { background: '#ECFDF5', color: '#059669' };
const btnBlue = { background: '#EFF6FF', color: '#2563EB' };
const btnGray = { background: '#F3F4F6', color: '#6B7280' };
const btnRed = { background: '#FEF2F2', color: '#DC2626' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 32, minWidth: 540, maxWidth: 600, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
