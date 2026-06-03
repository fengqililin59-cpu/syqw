import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchTemplates, createTemplate, updateTemplate, deleteTemplate, toggleTemplateActive,
  type MessageTemplateRecord,
} from '@/api/marketing';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const TYPE_LABEL: Record<string, string> = { email: '📧 邮件', sms: '📱 短信', wechat: '💬 企微' };

export default function MessageTemplatePage() {
  const [list, setList] = useState<MessageTemplateRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MessageTemplateRecord | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; type: 'email' | 'sms' | 'wechat'; subject: string; content: string; variables: string }>({ name: '', type: 'email', subject: '', content: '', variables: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTemplates({ page, page_size: pageSize, type: typeFilter, keyword });
      const rows = res.list ?? (res as { items?: MessageTemplateRecord[] }).items ?? [];
      setList(rows);
      setTotal(res.total ?? rows.length);
    } finally { setLoading(false); }
  }, [page, pageSize, typeFilter, keyword]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ name: '', type: 'email', subject: '', content: '', variables: '' }); setShowForm(true); };
  const openEdit = (t: MessageTemplateRecord) => {
    setEditing(t);
    setForm({ name: t.name, type: t.type, subject: t.subject || '', content: t.content,
      variables: t.variables ? t.variables.join(', ') : '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<MessageTemplateRecord> = {
      ...form,
      variables: form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : null,
    };
    if (editing) await updateTemplate(editing.id, payload);
    else await createTemplate(payload);
    setShowForm(false); load();
  };

  const handleDelete = async (id: number) => { await deleteTemplate(id); setConfirmDel(null); load(); };
  const handleToggle = async (id: number) => { await toggleTemplateActive(id); load(); };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>📝 消息模板库</h2>
        <button onClick={openCreate} style={btnPrimary}>＋ 新建模板</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">全部类型</option><option value="email">邮件</option><option value="sms">短信</option><option value="wechat">企微</option>
        </select>
        <input placeholder="搜索模板名称..." value={keyword} onChange={e => setKeyword(e.target.value)}
          style={inpStyle} onKeyDown={e => e.key === 'Enter' && setPage(1)} />
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>加载中...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {list.map(t => (
            <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #F3F4F6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: t.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{TYPE_LABEL[t.type] || t.type}</div>
                </div>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4,
                  background: t.is_active ? '#D1FAE5' : '#F3F4F6', color: t.is_active ? '#059669' : '#9CA3AF' }}>
                  {t.is_active ? '启用' : '停用'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.subject && <div>📌 {t.subject}</div>}
                <div style={{ marginTop: 4 }}>{(t.content ?? '').substring(0, 80)}{(t.content ?? '').length > 80 ? '...' : ''}</div>
              </div>
              {t.variables && t.variables.length > 0 && (
                <div style={{ marginBottom: 12 }}>{t.variables.map(v => (
                  <span key={v} style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, marginRight: 4, color: '#6B7280' }}>{`{{${v}}}`}</span>
                ))}</div>
              )}
              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                <button onClick={() => handleToggle(t.id)} style={{ ...btnSm, ...(t.is_active ? btnYellow : btnGreen) }}>
                  {t.is_active ? '🖤 停用' : '🟢 启用'}
                </button>
                <button onClick={() => openEdit(t)} style={{ ...btnSm, ...btnGray }}>✏️ 编辑</button>
                <button onClick={() => setConfirmDel(t.id)} style={{ ...btnSm, ...btnRed }}>🗑️ 删除</button>
              </div>
            </div>
          ))}
          {list.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#9CA3AF' }}>暂无消息模板</div>}
        </div>
      )}
      {/* 分页省略，数据量不大用滚动加载更合适，暂用简单分页 */}
      {total > pageSize && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnCancel}>上一页</button>
          <span style={{ margin: '0 12px', color: '#6B7280' }}>{page} / {Math.ceil(total / pageSize)}</span>
          <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)} style={btnCancel}>下一页</button>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ marginTop: 0 }}>{editing ? '编辑模板' : '新建消息模板'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={fieldStyle}><label>模板名称 *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inpStyle} /></div>
              <div style={fieldStyle}><label>类型 *</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} style={selStyle}>
                <option value="email">📧 邮件</option><option value="sms">📱 短信</option><option value="wechat">💬 企微</option>
              </select></div>
              {form.type === 'email' && <div style={fieldStyle}><label>邮件主题</label><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={inpStyle} placeholder="支持变量如 {{customer_name}}" /></div>}
              <div style={fieldStyle}><label>模板内容 *</label><textarea required value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inpStyle, minHeight: 120 }} placeholder="支持变量：{{customer_name}} {{company_name}}" /></div>
              <div style={fieldStyle}><label>可用变量 (逗号分隔)</label><input value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))} style={inpStyle} placeholder="customer_name, company_name" /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnCancel}>取消</button>
                <button type="submit" style={btnPrimary}>{editing ? '保存' : '创建'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDel !== null && (
        <ConfirmDialog message="确定删除此消息模板？" onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

const inpStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const selStyle = inpStyle;
const fieldStyle: React.CSSProperties = { marginBottom: 16 };
const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 };
const btnCancel: React.CSSProperties = { padding: '8px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer' };
const btnSm: React.CSSProperties = { padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnGreen = { background: '#D1FAE5', color: '#059669' };
const btnYellow = { background: '#FEF3C7', color: '#D97706' };
const btnGray = { background: '#F3F4F6', color: '#6B7280' };
const btnRed = { background: '#FEE2E2', color: '#DC2626' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 32, minWidth: 540, maxWidth: 600, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
