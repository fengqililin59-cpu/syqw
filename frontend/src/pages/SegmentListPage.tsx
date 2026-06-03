import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchSegments, createSegment, updateSegment, deleteSegment,
  refreshSegmentMembers, refreshAllSegments, previewSegmentRules, fetchSegmentMembers,
} from '@/api/segment';
import type { SegmentRecord, SegmentRule, SegmentMemberList } from '@/api/segment';

const FIELD_OPTIONS: { label: string; value: SegmentRule['field']; operators: SegmentRule['operator'][] }[] = [
  { label: '跟进阶段', value: 'stage', operators: ['eq', 'neq', 'in'] },
  { label: '客户标签', value: 'tags', operators: ['contains', 'not_contains'] },
  { label: '客户来源', value: 'source', operators: ['eq', 'neq'] },
  { label: '负责人', value: 'assigned_to', operators: ['eq', 'neq'] },
  { label: '最后活跃(天)', value: 'last_activity_days', operators: ['gt', 'lt', 'eq'] },
  { label: '创建天数', value: 'created_days', operators: ['gt', 'lt'] },
  { label: '成交订单数', value: 'order_count', operators: ['gt', 'lt', 'gte', 'lte'] },
  { label: '累计消费', value: 'total_spent', operators: ['gt', 'lt', 'gte', 'lte'] },
  { label: '自定义字段', value: 'custom_field', operators: ['eq', 'neq', 'contains'] },
];

const OP_LABELS: Record<string, string> = {
  eq: '等于', neq: '不等于', gt: '大于', lt: '小于',
  gte: '大于等于', lte: '小于等于', contains: '包含', not_contains: '不包含', in: '属于',
};

const STAGE_LABELS: Record<string, string> = {
  lead: '线索', contact: '意向', negotiation: '谈判', deal: '成交', lost: '流失',
};

const COLORS = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#4338CA'];

export default function SegmentListPage() {
  const [segments, setSegments] = useState<SegmentRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SegmentRecord | null>(null);
  const [form, setForm] = useState<{
    name: string; description: string; match_type: 'all' | 'any';
    color_tag: string; is_auto_refresh: boolean; rules: SegmentRule[];
  }>({ name: '', description: '', match_type: 'all', color_tag: '#4F46E5', is_auto_refresh: false, rules: [] });
  const [preview, setPreview] = useState<{ total: number; sample: { id: number; name: string; stage: string; tags: string }[] } | null>(null);
  const [memberPanel, setMemberPanel] = useState<{ seg: SegmentRecord; data: SegmentMemberList | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try { setSegments(await fetchSegments()); } catch (_) { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 规则预览（防抖 800ms）
  useEffect(() => {
    if (!showModal) return;
    const t = setTimeout(async () => {
      if (form.rules.length === 0) { setPreview(null); return; }
      try {
        const r = await previewSegmentRules({ rules: form.rules, match_type: form.match_type });
        setPreview(r);
      } catch (_) { setPreview(null); }
    }, 800);
    return () => clearTimeout(t);
  }, [form.rules, form.match_type, showModal]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', match_type: 'all', color_tag: '#4F46E5', is_auto_refresh: false, rules: [] });
    setPreview(null);
    setShowModal(true);
  };

  const openEdit = (s: SegmentRecord) => {
    setEditing(s);
    setForm({
      name: s.name, description: s.description || '', match_type: s.match_type,
      color_tag: s.color_tag, is_auto_refresh: s.is_auto_refresh,
      rules: JSON.parse(JSON.stringify(s.rules || [])),
    });
    setPreview(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        await updateSegment(editing.id, form);
      } else {
        await createSegment(form);
      }
      setShowModal(false);
      await load();
    } catch (_) { /* ignore */ }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此分群？')) return;
    await deleteSegment(id);
    load();
  };

  const handleRefresh = async (id: number) => {
    await refreshSegmentMembers(id);
    load();
  };

  const handleRefreshAll = async () => {
    await refreshAllSegments();
    load();
  };

  const openMembers = async (seg: SegmentRecord) => {
    try {
      const data = await fetchSegmentMembers(seg.id);
      setMemberPanel({ seg, data });
    } catch (_) { setMemberPanel({ seg, data: null }); }
  };

  // ============ 规则编辑器辅助 ============
  const addRule = () => {
    setForm(f => ({
      ...f, rules: [...f.rules, { field: 'stage', operator: 'eq', value: 'lead' }],
    }));
  };

  const updateRule = (i: number, part: Partial<SegmentRule>) => {
    setForm(f => {
      const rules = [...f.rules];
      const merged = { ...rules[i], ...part };
      // 切换字段时重置 operator
      if (part.field && part.field !== rules[i].field) {
        const def = FIELD_OPTIONS.find(o => o.value === part.field);
        merged.operator = def?.operators[0] || 'eq';
        merged.value = '';
      }
      rules[i] = merged;
      return { ...f, rules };
    });
  };

  const removeRule = (i: number) => {
    setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }));
  };

  const currentOps = (field: SegmentRule['field']) =>
    FIELD_OPTIONS.find(o => o.value === field)?.operators || ['eq'];

  // ============ 样式 ============
  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' };
  const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 14 };
  const btnSm: React.CSSProperties = { padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
  const overlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
  const modal: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 32, minWidth: 700, maxWidth: 780, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' };

  return (
    <div style={{ padding: 32 }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>客户分群</h1>
          <p style={{ color: '#6B7280', margin: '4px 0 0' }}>智能分组 · 精准触达 · 自动刷新</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleRefreshAll} style={{ ...btnPrimary, background: '#F3F4F6', color: '#374151' }}>
            🔄 全部刷新
          </button>
          <button onClick={openCreate} style={btnPrimary}>+ 新建分群</button>
        </div>
      </div>

      {/* 分群列表 */}
      {segments.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9CA3AF', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>暂无客户分群</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>创建分群后，系统自动匹配符合条件的客户</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {segments.map(s => (
            <div key={s.id} style={{ ...card, borderLeft: `4px solid ${s.color_tag || '#4F46E5'}`, cursor: 'pointer' }}
              onClick={() => openMembers(s)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color_tag, display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</span>
                    {s.is_auto_refresh && (
                      <span style={{ fontSize: 11, background: '#EFF6FF', color: '#2563EB', padding: '1px 6px', borderRadius: 3 }}>自动</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{s.description || '无描述'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{s.member_count}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>成员数</div>
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {s.match_type === 'all' ? '🔗 满足全部' : '🔀 满足任一'} · {s.rules?.length || 0} 条规则
                </div>
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {s.rules?.slice(0, 3).map((r, i) => (
                  <span key={i} style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 8px', borderRadius: 10, color: '#374151' }}>
                    {FIELD_OPTIONS.find(o => o.value === r.field)?.label} {OP_LABELS[r.operator]} {typeof r.value === 'object' ? r.value.value : r.value}
                  </span>
                ))}
                {(s.rules?.length || 0) > 3 && (
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>+{s.rules.length - 3}</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {s.last_refreshed_at ? `更新于 ${new Date(s.last_refreshed_at).toLocaleDateString()}` : '从未刷新'}
                </span>
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleRefresh(s.id)} style={{ ...btnSm, background: '#EFF6FF', color: '#2563EB' }}>刷新</button>
                  <button onClick={() => openEdit(s)} style={{ ...btnSm, background: '#F3F4F6', color: '#374151' }}>编辑</button>
                  <button onClick={() => handleDelete(s.id)} style={{ ...btnSm, background: '#FEF2F2', color: '#DC2626' }}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== 新建/编辑弹窗 ==================== */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 24px' }}>
              {editing ? '编辑分群' : '新建客户分群'}
            </h2>

            {/* 基本信息 */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>名称 *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder='如：高意向未成交、沉睡客户' />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>描述</label>
              <input style={inp} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder='分组说明（可选）' />
            </div>

            {/* 匹配条件 + 颜色 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>匹配条件</label>
                <select style={sel} value={form.match_type}
                  onChange={e => setForm(f => ({ ...f, match_type: e.target.value as 'all' | 'any' }))}>
                  <option value="all">满足全部规则（AND）</option>
                  <option value="any">满足任一规则（OR）</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>颜色标签</label>
                <select style={sel} value={form.color_tag}
                  onChange={e => setForm(f => ({ ...f, color_tag: e.target.value }))}>
                  {COLORS.map(c => <option key={c} value={c}>● {c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.is_auto_refresh}
                    onChange={e => setForm(f => ({ ...f, is_auto_refresh: e.target.checked }))} />
                  每日自动刷新
                </label>
              </div>
            </div>

            {/* 规则编辑器 */}
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>筛选规则</span>
                <button onClick={addRule} style={{ ...btnSm, background: '#4F46E5', color: '#fff' }}>+ 添加规则</button>
              </div>

              {form.rules.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20, fontSize: 13 }}>
                  尚未添加规则，点击上方按钮添加
                </div>
              ) : (
                form.rules.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#9CA3AF', minWidth: 20 }}>{i + 1}.</span>
                    <select style={sel} value={r.field}
                      onChange={e => updateRule(i, { field: e.target.value as SegmentRule['field'] })}>
                      {FIELD_OPTIONS.map(fo => <option key={fo.value} value={fo.value}>{fo.label}</option>)}
                    </select>
                    <select style={{ ...sel, width: 120 }} value={r.operator}
                      onChange={e => updateRule(i, { operator: e.target.value as SegmentRule['operator'] })}>
                      {currentOps(r.field).map(op => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
                    </select>
                    {r.field === 'stage' ? (
                      <select style={sel} value={String(r.value)}
                        onChange={e => updateRule(i, { value: e.target.value })}>
                        {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : r.field === 'custom_field' ? (
                      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                        <input style={{ ...inp, width: 80 }} placeholder='字段ID'
                          value={typeof r.value === 'object' ? String(r.value.field_id) : ''}
                          onChange={e => updateRule(i, { value: { field_id: Number(e.target.value), value: typeof r.value === 'object' ? r.value.value : '' } })} />
                        <input style={inp} placeholder='值'
                          value={typeof r.value === 'object' ? r.value.value : ''}
                          onChange={e => updateRule(i, { value: { field_id: typeof r.value === 'object' ? r.value.field_id : 0, value: e.target.value } })} />
                      </div>
                    ) : (
                      <input style={inp} value={String(r.value)}
                        onChange={e => updateRule(i, { value: e.target.value })}
                        placeholder='输入值' />
                    )}
                    <button onClick={() => removeRule(i)} style={{ ...btnSm, background: '#FEF2F2', color: '#DC2626' }}>✕</button>
                  </div>
                ))
              )}
            </div>

            {/* 预览结果 */}
            {preview !== null && (
              <div style={{ background: preview.total > 0 ? '#ECFDF5' : '#FEF2F2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                  匹配预览：{preview.total} 人
                </div>
                {preview.sample.length > 0 && (
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #D1D5DB' }}>
                        <th style={th}>姓名</th><th style={th}>阶段</th><th style={th}>标签</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={td}>{c.name}</td>
                          <td style={td}>{c.stage}</td>
                          <td style={td}>{c.tags}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ ...btnPrimary, background: '#F3F4F6', color: '#374151' }}>
                取消
              </button>
              <button onClick={handleSave} disabled={loading || !form.name.trim()} style={{
                ...btnPrimary, opacity: loading || !form.name.trim() ? 0.5 : 1,
              }}>
                {editing ? '保存修改' : '创建分群'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 成员面板 ==================== */}
      {memberPanel && (
        <div style={overlay} onClick={() => setMemberPanel(null)}>
          <div style={{ ...modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: memberPanel.seg.color_tag, display: 'inline-block', marginRight: 8 }} />
                {memberPanel.seg.name}
              </h3>
              <button onClick={() => setMemberPanel(null)} style={{ ...btnSm, background: '#F3F4F6', color: '#374151' }}>关闭</button>
            </div>

            {!memberPanel.data ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 30 }}>加载中...</div>
            ) : memberPanel.data.list.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 30 }}>暂无匹配客户</div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
                  共 {memberPanel.data.total} 人
                </div>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #D1D5DB' }}>
                      <th style={th}>姓名</th><th style={th}>电话</th><th style={th}>阶段</th><th style={th}>标签</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberPanel.data.list.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={td}>{m.customer.name}</td>
                        <td style={td}>{m.customer.phone}</td>
                        <td style={td}>{m.customer.stage}</td>
                        <td style={td}>{m.customer.tags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 共享样式 ============
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const sel: React.CSSProperties = { padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box' };
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: '#111827' };
