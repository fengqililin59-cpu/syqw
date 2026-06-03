import { useEffect, useState, useCallback } from 'react';
import {
  fetchTasks, createTask, updateTask, deleteTask, fetchTaskStats,
  type TaskItem, type TaskStats,
} from '../api/task';

const PRIORITY_MAP = { urgent: { label: '紧急', color: '#F56C6C' }, high: { label: '高', color: '#E6A23C' }, medium: { label: '中', color: '#378ADD' }, low: { label: '低', color: '#999' } } as const;
const STATUS_MAP = { todo: '待处理', in_progress: '进行中', done: '已完成', cancelled: '已取消' } as const;

export default function TaskListPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const defaultStats: TaskStats = { total: 0, todo: 0, overdue: 0, today_due: 0, done_today: 0 };
  const [stats, setStats] = useState<TaskStats>(defaultStats);
  const applyStats = (s: TaskStats | null | undefined) => setStats({ ...defaultStats, ...(s && typeof s === 'object' ? s : {}) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const data = await fetchTasks(params);
      setTasks(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
    } catch {
      setTasks([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [page, statusFilter, priorityFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTaskStats().then(applyStats).catch(() => applyStats(null)); }, []);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`删除任务「${title}」？`)) return;
    await deleteTask(id);
    load();
    fetchTaskStats().then(applyStats).catch(() => applyStats(null));
  };

  const handleStatus = async (task: TaskItem, status: string) => {
    await updateTask(task.id, { status } as any);
    load();
    fetchTaskStats().then(applyStats).catch(() => applyStats(null));
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📋 任务管理</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: 'var(--color-background-brand, #378ADD)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, cursor: 'pointer' }}>＋ 新建任务</button>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '全部待办', value: stats.total, color: '#378ADD' },
          { label: '待处理', value: stats.todo, color: '#E6A23C' },
          { label: '已逾期', value: stats.overdue, color: '#F56C6C' },
          { label: '今日截止', value: stats.today_due, color: '#67C23A' },
          { label: '今日完成', value: stats.done_today, color: '#909399' },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--color-background-primary)', borderRadius: 10, padding: 14, border: '0.5px solid var(--color-border-tertiary)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
          <option value="">全部优先级</option>
          {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* 任务列表 */}
      <div style={{ background: 'var(--color-background-primary)', borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>加载中...</div> : tasks.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>暂无任务</div> : tasks.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', gap: 12 }}>
            {/* 状态勾选 */}
            <input type="checkbox" checked={t.status === 'done'} onChange={() => handleStatus(t, t.status === 'done' ? 'todo' : 'done')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            {/* 优先级 */}
            <span style={{ fontSize: 11, color: PRIORITY_MAP[t.priority]?.color, background: `${PRIORITY_MAP[t.priority]?.color}18`, padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{PRIORITY_MAP[t.priority]?.label}</span>
            {/* 标题 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? 'var(--color-text-secondary)' : 'inherit' }}>{t.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {t.assignee && <span>👤 {t.assignee.real_name || t.assignee.username} · </span>}
                {t.customer && <span>🏢 {t.customer.name} · </span>}
                {t.due_date && <span>📅 {new Date(t.due_date).toLocaleDateString('zh-CN')}</span>}
              </div>
            </div>
            {/* 状态标签 */}
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '2px 8px', borderRadius: 4, background: 'var(--color-background-secondary)' }}>{STATUS_MAP[t.status]}</span>
            {/* 操作 */}
            <button onClick={() => { setEditing(t); setShowForm(true); }} style={{ border: 'none', background: 'none', color: 'var(--color-text-link)', cursor: 'pointer', fontSize: 12 }}>编辑</button>
            <button onClick={() => handleDelete(t.id, t.title)} style={{ border: 'none', background: 'none', color: '#F56C6C', cursor: 'pointer', fontSize: 12 }}>删除</button>
          </div>
        ))}
      </div>

      {/* 分页 */}
      {total > 20 && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '4px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', marginRight: 8 }}>←</button>
          第 {page} 页 / 共 {Math.ceil(total / 20)} 页
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)} style={{ padding: '4px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', marginLeft: 8 }}>→</button>
        </div>
      )}

      {/* 弹窗 */}
      {showForm && <TaskFormModal task={editing} onSuccess={() => { setShowForm(false); setEditing(null); load(); fetchTaskStats().then(applyStats).catch(() => applyStats(null)); }} onCancel={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

// ─── 表单弹窗 ───
function TaskFormModal({ task, onSuccess, onCancel }: { task: TaskItem | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title || '', description: task?.description || '',
    priority: task?.priority || 'medium', status: task?.status || 'todo',
    due_date: task?.due_date?.slice(0, 10) || '', assignee_id: task?.assignee_id || '',
    customer_id: task?.customer_id || '', contract_id: task?.contract_id || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title) { alert('请输入任务标题'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        contract_id: form.contract_id ? Number(form.contract_id) : null,
        due_date: form.due_date ? `${form.due_date}T23:59:59` : null,
      };
      if (isEdit) await updateTask(task.id, payload as any);
      else await createTask(payload as any);
      onSuccess();
    } catch (e: any) { alert('保存失败：' + (e.message || '未知错误')); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 500 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17 }}>{isEdit ? '编辑任务' : '新建任务'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>标题 *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="任务标题" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>优先级</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as any }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
                {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>状态</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }}>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>截止日期</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>描述</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)', background: '#fff', cursor: 'pointer', fontSize: 14 }}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--color-background-brand, #378ADD)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>{saving ? '保存中...' : (isEdit ? '保存' : '创建')}</button>
        </div>
      </div>
    </div>
  );
}
