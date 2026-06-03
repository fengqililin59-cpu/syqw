/**
 * @file 合同管理列表页
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchContracts, deleteContract, createContract, updateContract,
  type Contract, type ContractListParams,
} from '../api/contract';
import { searchCustomers as searchCustomerApi } from '../api/customers';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#999' },
  pending: { label: '待签署', color: '#E6A23C' },
  signed: { label: '已签署', color: '#67C23A' },
  active: { label: '执行中', color: '#378ADD' },
  expired: { label: '已到期', color: '#F56C6C' },
  terminated: { label: '已终止', color: '#999' },
};

const TYPE_MAP: Record<string, string> = {
  sales: '销售合同',
  service: '服务合同',
  nda: '保密协议',
  other: '其他',
};

export default function ContractListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [params, setParams] = useState<ContractListParams>({});
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchContracts({ ...params, page, page_size: pageSize });
      setContracts(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [params, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`确认删除合同「${title}」？`)) return;
    await deleteContract(id);
    load();
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingContract(null);
    load();
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* 顶部标题 + 新建按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📄 合同管理</h2>
        <button
          onClick={() => { setEditingContract(null); setShowForm(true); }}
          style={{
            background: 'var(--color-background-brand, #378ADD)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 20px',
            fontSize: 14, cursor: 'pointer',
          }}
        >
          ＋ 新建合同
        </button>
      </div>

      {/* 筛选栏 */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 10, padding: 14,
      }}>
        <input
          placeholder="搜索合同标题/编号..."
          value={params.keyword || ''}
          onChange={(e) => setParams((p) => ({ ...p, keyword: e.target.value }))}
          style={{ flex: 1, minWidth: 200, padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}
        />
        <select
          value={params.status || ''}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value || undefined }))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={params.type || ''}
          onChange={(e) => setParams((p) => ({ ...p, type: e.target.value || undefined }))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}
        >
          <option value="">全部类型</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          onClick={() => { setPage(1); load(); }}
          style={{ padding: '6px 16px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          搜索
        </button>
      </div>

      {/* 合同表格 */}
      <div style={{
        background: 'var(--color-background-primary)',
        borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px' }}>合同标题</th>
              <th style={{ padding: '10px 14px' }}>类型</th>
              <th style={{ padding: '10px 14px' }}>客户</th>
              <th style={{ padding: '10px 14px' }}>金额</th>
              <th style={{ padding: '10px 14px' }}>状态</th>
              <th style={{ padding: '10px 14px' }}>签署日期</th>
              <th style={{ padding: '10px 14px' }}>到期日期</th>
              <th style={{ padding: '10px 14px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>加载中...</td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>暂无合同记录</td></tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer' }}
                  onClick={() => navigate(`/app/contracts/${c.id}`)}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{c.title}</td>
                  <td style={{ padding: '10px 14px' }}>{TYPE_MAP[c.type] || c.type}</td>
                  <td style={{ padding: '10px 14px' }}>{c.customer?.name || '-'}</td>
                  <td style={{ padding: '10px 14px' }}>¥{(c.amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      color: STATUS_MAP[c.status]?.color || '#999',
                      background: `${STATUS_MAP[c.status]?.color || '#999'}18`,
                      padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    }}>
                      {STATUS_MAP[c.status]?.label || c.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>{c.signed_at ? c.signed_at.slice(0, 10) : '-'}</td>
                  <td style={{ padding: '10px 14px' }}>{c.end_date ? c.end_date.slice(0, 10) : '-'}</td>
                  <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditingContract(c); setShowForm(true); }} style={{ border: 'none', background: 'none', color: 'var(--color-text-link)', cursor: 'pointer', marginRight: 8, fontSize: 12 }}>编辑</button>
                    <button onClick={() => handleDelete(c.id, c.title)} style={{ border: 'none', background: 'none', color: '#F56C6C', cursor: 'pointer', fontSize: 12 }}>删除</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, fontSize: 13 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '4px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer' }}>上一页</button>
          <span style={{ lineHeight: '30px' }}>第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页（{total} 条）</span>
          <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)} style={{ padding: '4px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer' }}>下一页</button>
        </div>
      )}

      {/* 新建/编辑表单弹窗 */}
      {showForm && (
        <ContractFormModal
          contract={editingContract}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditingContract(null); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 合同表单弹窗
// ──────────────────────────────────────────────

function ContractFormModal({ contract, onSuccess, onCancel }: {
  contract: Contract | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!contract;
  const [form, setForm] = useState({
    title: contract?.title || '',
    contract_no: contract?.contract_no || '',
    type: contract?.type || 'sales',
    status: contract?.status || 'draft',
    amount: contract?.amount?.toString() || '',
    currency: contract?.currency || 'CNY',
    start_date: contract?.start_date?.slice(0, 10) || '',
    end_date: contract?.end_date?.slice(0, 10) || '',
    signed_at: contract?.signed_at?.slice(0, 10) || '',
    party_a: contract?.party_a || '',
    party_b: contract?.party_b || '',
    content: contract?.content || '',
    reminder_days: contract?.reminder_days ?? 7,
    notes: contract?.notes || '',
    customer_id: contract?.customer_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState('');
  const [customerResults, setCustomerResults] = useState<{ id: number; name: string }[]>([]);

  const handleSearchCustomers = async () => {
    if (customerKeyword.length < 1) return;
    try {
      const res = await searchCustomerApi({ keyword: customerKeyword, size: 10 });
      setCustomerResults(res.list.map((c: any) => ({ id: c.id, name: c.name })));
    } catch {}
  };

  const handleSubmit = async () => {
    if (!form.title || !form.amount) { alert('请填写合同标题和金额'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        customer_id: form.customer_id ? Number(form.customer_id) : undefined,
        reminder_days: Number(form.reminder_days),
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        signed_at: form.signed_at || undefined,
      };
      if (isEdit) {
        await updateContract(contract.id, payload);
      } else {
        await createContract(payload);
      }
      onSuccess();
    } catch (e: any) {
      alert('保存失败：' + (e.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 600, maxHeight: '90vh', overflow: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17 }}>{isEdit ? '编辑合同' : '新建合同'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>合同标题 *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="合同标题" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>合同编号</label>
            <input value={form.contract_no} onChange={(e) => setForm((f) => ({ ...f, contract_no: e.target.value }))} placeholder="自动生成或手动填写" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>类型</label>
            <select value={form.type} onChange={(e) => setForm((f: any) => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
              {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>状态</label>
            <select value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>金额 *</label>
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>币种</label>
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
              <option value="CNY">CNY (¥)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>签署日期</label>
            <input type="date" value={form.signed_at} onChange={(e) => setForm((f) => ({ ...f, signed_at: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>到期日期</label>
            <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>关联客户</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={customerKeyword}
              onChange={(e) => { setCustomerKeyword(e.target.value); if (!e.target.value) setCustomerResults([]); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchCustomers()}
              placeholder="搜索客户名称..."
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}
            />
            {form.customer_id && <span style={{ fontSize: 12, color: 'var(--color-text-link)', lineHeight: '34px' }}>已关联 ID:{form.customer_id}</span>}
          </div>
          {customerResults.length > 0 && (
            <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, marginTop: 4, maxHeight: 120, overflow: 'auto' }}>
              {customerResults.map((c) => (
                <div key={c.id} onClick={() => { setForm((f) => ({ ...f, customer_id: c.id })); setCustomerResults([]); setCustomerKeyword(c.name); }} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>{c.name}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>我方（甲方）</label>
            <input value={form.party_a} onChange={(e) => setForm((f) => ({ ...f, party_a: e.target.value }))} placeholder="我方公司名称" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>客户方（乙方）</label>
            <input value={form.party_b} onChange={(e) => setForm((f) => ({ ...f, party_b: e.target.value }))} placeholder="客户公司名称" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>合同内容</label>
          <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="合同主要条款..." rows={3} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', fontSize: 14 }}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--color-background-brand, #378ADD)', color: '#fff', cursor: 'pointer', fontSize: 14, opacity: saving ? 0.6 : 1 }}>{saving ? '保存中...' : (isEdit ? '保存修改' : '创建合同')}</button>
        </div>
      </div>
    </div>
  );
}
