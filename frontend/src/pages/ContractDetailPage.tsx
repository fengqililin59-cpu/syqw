/**
 * @file 合同详情页
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchContract, updateContract, deleteContract, type Contract } from '../api/contract';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#999' },
  pending: { label: '待签署', color: '#E6A23C' },
  signed: { label: '已签署', color: '#67C23A' },
  active: { label: '执行中', color: '#378ADD' },
  expired: { label: '已到期', color: '#F56C6C' },
  terminated: { label: '已终止', color: '#999' },
};
const TYPE_MAP: Record<string, string> = {
  sales: '销售合同', service: '服务合同', nda: '保密协议', other: '其他',
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await fetchContract(Number(id));
        setContract(c);
        setForm({ ...c, amount: String(c.amount) });
      } finally { setLoading(false); }
    })();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        signed_at: form.signed_at || undefined,
        reminder_days: Number(form.reminder_days) || 7,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
      };
      const updated = await updateContract(Number(id), payload as any);
      setContract(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('确认删除此合同？')) return;
    await deleteContract(Number(id));
    navigate('/app/contracts', { replace: true });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>加载中...</div>;
  if (!contract) return <div style={{ padding: 40, textAlign: 'center', color: '#F56C6C' }}>合同不存在</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => navigate('/app/contracts')} style={{ border: 'none', background: 'none', color: 'var(--color-text-link)', cursor: 'pointer', fontSize: 14 }}>← 返回合同列表</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} style={{ padding: '6px 16px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>编辑</button>
              <button onClick={handleDelete} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#F56C6C', color: '#fff', cursor: 'pointer', fontSize: 13 }}>删除</button>
            </>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--color-background-primary)', borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)', padding: 28 }}>
        {editing ? (
          // 编辑模式
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: 17 }}>编辑合同</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: '标题', key: 'title', type: 'text' },
                { label: '编号', key: 'contract_no', type: 'text' },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key] || ''} onChange={(e) => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>类型</label>
                <select value={form.type || 'sales'} onChange={(e) => setForm((prev: any) => ({ ...prev, type: e.target.value }))} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
                  {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>状态</label>
                <select value={form.status || 'draft'} onChange={(e) => setForm((prev: any) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>金额</label>
                <input type="number" value={form.amount || ''} onChange={(e) => setForm((prev: any) => ({ ...prev, amount: e.target.value }))} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>签署日期</label>
                <input type="date" value={(form.signed_at || '').slice(0, 10)} onChange={(e) => setForm((prev: any) => ({ ...prev, signed_at: e.target.value }))} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>到期日期</label>
                <input type="date" value={(form.end_date || '').slice(0, 10)} onChange={(e) => setForm((prev: any) => ({ ...prev, end_date: e.target.value }))} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>合同内容</label>
              <textarea value={form.content || ''} onChange={(e) => setForm((prev: any) => ({ ...prev, content: e.target.value }))} rows={4} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>备注</label>
              <textarea value={form.notes || ''} onChange={(e) => setForm((prev: any) => ({ ...prev, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setEditing(false); setForm({ ...contract, amount: String(contract.amount) }); }} style={{ padding: '8px 20px', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', fontSize: 14 }}>取消</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--color-background-brand, #378ADD)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>{saving ? '保存中...' : '保存修改'}</button>
            </div>
          </div>
        ) : (
          // 详情模式
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{contract.title}</h2>
              <span style={{ color: STATUS_MAP[contract.status]?.color, background: `${STATUS_MAP[contract.status]?.color}18`, padding: '4px 12px', borderRadius: 6, fontSize: 13 }}>
                {STATUS_MAP[contract.status]?.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              <DetailCard label="合同类型" value={TYPE_MAP[contract.type] || contract.type} />
              <DetailCard label="合同编号" value={contract.contract_no || '-'} />
              <DetailCard label="金额" value={`¥${(contract.amount || 0).toLocaleString()} ${contract.currency || 'CNY'}`} highlight />
              <DetailCard label="签署日期" value={contract.signed_at ? contract.signed_at.slice(0, 10) : '-'} />
              <DetailCard label="到期日期" value={contract.end_date ? contract.end_date.slice(0, 10) : '-'} />
              <DetailCard label="合同有效期" value={contract.start_date && contract.end_date ? `${contract.start_date.slice(0, 10)} ~ ${contract.end_date.slice(0, 10)}` : '-'} />
              <DetailCard label="甲方（我方）" value={contract.party_a || '-'} />
              <DetailCard label="乙方（客户方）" value={contract.party_b || '-'} />
              <DetailCard label="创建日期" value={contract.created_at?.slice(0, 10) || '-'} />
            </div>

            {contract.customer && (
              <div style={{ marginBottom: 20, padding: 12, background: 'var(--color-background-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>关联客户</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{contract.customer.name} <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{contract.customer.phone}</span></div>
              </div>
            )}

            {contract.content && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>合同条款</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--color-background-secondary)', padding: 16, borderRadius: 8 }}>{contract.content}</div>
              </div>
            )}

            {contract.notes && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>备注</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{contract.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: highlight ? 600 : 400, color: highlight ? 'var(--color-text-primary)' : 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
