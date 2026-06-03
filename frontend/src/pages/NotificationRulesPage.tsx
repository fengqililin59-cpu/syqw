import { useEffect, useState, useCallback } from 'react'
import {
  fetchRules, createRule, updateRule, deleteRule, toggleRule,
  triggerRule, fetchEventTypes, fetchRuleLogs,
} from '@/api/notificationRules'
import type {
  NotificationRule, RuleLog, EventType, RecipientConfig,
  TriggerType, TriggerConfig, RuleTemplate,
} from '@/api/notificationRules'
import { usePushSubscription } from '@/hooks/usePushSubscription'

// --- 常量 ---

const CHANNEL_OPTIONS = [
  { value: 'in_app', label: '站内通知', icon: '🔔', desc: '通知中心 + 铃铛提醒' },
  { value: 'wecom', label: '企业微信', icon: '💬', desc: '企微应用消息推送' },
  { value: 'browser', label: '浏览器推送', icon: '🌐', desc: '桌面通知（需授权）' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低', color: '#6B7280' },
  { value: 'normal', label: '中', color: '#2563EB' },
  { value: 'high', label: '高', color: '#D97706' },
  { value: 'urgent', label: '紧急', color: '#DC2626' },
]

const TRIGGER_DEFAULTS: Record<TriggerType, TriggerConfig> = {
  schedule: { type: 'daily', time: '09:00' },
  event: { event: 'followup_overdue', filters: { days_overdue: 7 } },
  cron: { expression: '0 9 * * 1-5' },
}

const VARIABLE_HINTS = [
  { var: 'customer_name', desc: '客户名称' },
  { var: 'customer_id', desc: '客户ID' },
  { var: 'stage', desc: '当前阶段' },
  { var: 'days', desc: '天数' },
  { var: 'last_followup', desc: '最后跟进时间' },
  { var: 'user_name', desc: '接收人姓名' },
  { var: 'score', desc: '意向分' },
  { var: 'task_title', desc: '任务标题' },
  { var: 'source', desc: '客户来源' },
]

// --- 组件 ---

export default function NotificationRulesPage() {
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<NotificationRule | null>(null)
  const [form, setForm] = useState({
    name: '', description: '',
    trigger_type: 'schedule' as TriggerType,
    trigger_config: TRIGGER_DEFAULTS.schedule as TriggerConfig,
    channels: ['in_app'] as string[],
    recipient_type: 'specific' as string,
    recipient_config: { user_ids: [] } as RecipientConfig,
    template: { title: '', body: '', link: '' } as RuleTemplate,
    priority: 'normal' as string,
    cooldown_minutes: 60,
    max_per_run: 50,
  })
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<RuleLog[]>([])
  const [loading, setLoading] = useState(false)
  const [triggeringId, setTriggeringId] = useState<number | null>(null)

  const pushHook = usePushSubscription()

  const load = useCallback(async () => {
    try {
      const { data } = await fetchRules({ page_size: 100 })
      setRules(data.items)
    } catch { /* ignore */ }
  }, [])

  const loadEventTypes = useCallback(async () => {
    try {
      const { data } = await fetchEventTypes()
      setEventTypes(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load(); loadEventTypes() }, [load, loadEventTypes])

  // --- 表单操作 ---

  const resetForm = () => {
    setForm({
      name: '', description: '',
      trigger_type: 'schedule',
      trigger_config: TRIGGER_DEFAULTS.schedule,
      channels: ['in_app'],
      recipient_type: 'specific',
      recipient_config: { user_ids: [] },
      template: { title: '', body: '', link: '' },
      priority: 'normal', cooldown_minutes: 60, max_per_run: 50,
    })
    setEditing(null)
  }

  const openCreate = () => { resetForm(); setShowModal(true) }

  const openEdit = (rule: NotificationRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      description: rule.description || '',
      trigger_type: rule.trigger_type,
      trigger_config: rule.trigger_config,
      channels: rule.channels,
      recipient_type: rule.recipient_type,
      recipient_config: rule.recipient_config || { user_ids: [] },
      template: rule.template,
      priority: rule.priority,
      cooldown_minutes: rule.cooldown_minutes,
      max_per_run: rule.max_per_run,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.template.title.trim()) return
    setLoading(true)
    try {
      if (editing) {
        await updateRule(editing.id, form as Partial<NotificationRule>)
      } else {
        await createRule(form as Partial<NotificationRule>)
      }
      setShowModal(false)
      await load()
    } catch (e) {
      alert('保存失败: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id: number) => {
    try {
      const { data } = await toggleRule(id)
      setRules(prev => prev.map(r => r.id === id ? data : r))
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除规则「${name}」吗？`)) return
    try {
      await deleteRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
  }

  const handleTrigger = async (rule: NotificationRule) => {
    setTriggeringId(rule.id)
    try {
      const res = await triggerRule(rule.id)
      if (res.success) {
        alert(`规则「${rule.name}」已手动触发`)
      }
    } catch (e) {
      alert('触发失败: ' + (e as Error).message)
    } finally {
      setTriggeringId(null)
    }
  }

  const openLogs = async (ruleId: number) => {
    setShowLogs(true)
    try {
      const { data } = await fetchRuleLogs({ rule_id: ruleId, page_size: 50 })
      setLogs(data.items)
    } catch { /* ignore */ }
  }

  // --- 辅助函数 ---

  const triggerTypeLabel = (t: TriggerType) => {
    const map: Record<string, string> = { schedule: '定时', event: '事件', cron: 'Cron' }
    return map[t] || t
  }

  const channelLabel = (ch: string) => {
    const opt = CHANNEL_OPTIONS.find(o => o.value === ch)
    return opt ? `${opt.icon} ${opt.label}` : ch
  }

  const priorityColor = (p: string) => PRIORITY_OPTIONS.find(o => o.value === p)?.color || '#6B7280'

  const formatTriggerConfig = (rule: NotificationRule): string => {
    const cfg = rule.trigger_config
    if (rule.trigger_type === 'schedule') {
      if (cfg.type === 'daily') return `每日 ${cfg.time || '09:00'}`
      if (cfg.type === 'weekly') return `每周 ${(cfg.days_of_week || []).join(',')} ${cfg.time || '09:00'}`
      if (cfg.type === 'interval') return `每 ${cfg.interval_minutes || 30} 分钟`
    }
    if (rule.trigger_type === 'event') {
      const evt = eventTypes.find(e => e.value === cfg.event)
      const filters = cfg.filters || {}
      const extra = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ')
      return `${evt?.label || cfg.event}${extra ? ` (${extra})` : ''}`
    }
    if (rule.trigger_type === 'cron') return `Cron: ${cfg.expression || ''}`
    return JSON.stringify(cfg)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>智能通知规则</h1>
          <p style={{ color: '#6B7280', margin: '4px 0 0' }}>
            自定义通知触发条件，通过站内 / 企微 / 浏览器多渠道推送
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* 浏览器推送订阅按钮 */}
          {pushHook.isSupported && (
            <button
              onClick={pushHook.isSubscribed ? pushHook.unsubscribe : pushHook.subscribe}
              disabled={pushHook.isLoading}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #D1D5DB',
                background: pushHook.isSubscribed ? '#ECFDF5' : '#F3F4F6',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              title={pushHook.error || ''}
            >
              {pushHook.isSubscribed ? '🔔 已开启推送' : '🌐 开启浏览器推送'}
            </button>
          )}
          <button
            onClick={openCreate}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#4F46E5',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + 新建规则
          </button>
        </div>
      </div>

      {/* 规则列表 */}
      {rules.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#9CA3AF',
          background: '#F9FAFB', borderRadius: 12,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>暂无通知规则</p>
          <p style={{ fontSize: 14 }}>点击「新建规则」创建你的第一条智能通知规则</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {rules.map(rule => (
            <div
              key={rule.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
                padding: 20,
                position: 'relative',
                opacity: rule.enabled ? 1 : 0.6,
              }}
            >
              {/* 状态指示器 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: rule.enabled ? '#10B981' : '#D1D5DB',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 4,
                    background: '#F3F4F6', color: '#374151',
                  }}>
                    {triggerTypeLabel(rule.trigger_type)}
                  </span>
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 4,
                    background: priorityColor(rule.priority) + '15',
                    color: priorityColor(rule.priority),
                    fontWeight: 600,
                  }}>
                    {PRIORITY_OPTIONS.find(o => o.value === rule.priority)?.label}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  触发 {rule.trigger_count} 次
                </span>
              </div>

              {/* 名称 */}
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>{rule.name}</h3>
              {rule.description && (
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>{rule.description}</p>
              )}

              {/* 触发条件 */}
              <div style={{
                background: '#F9FAFB', borderRadius: 8, padding: 10, marginBottom: 12,
                fontSize: 13,
              }}>
                <div style={{ color: '#374151', marginBottom: 4 }}>
                  ⚡ {formatTriggerConfig(rule)}
                </div>
                <div style={{ color: '#6B7280' }}>
                  📨 {(rule.channels || []).map(ch => channelLabel(ch)).join(' · ')}
                </div>
              </div>

              {/* 模板预览 */}
              <div style={{
                borderLeft: '3px solid #4F46E5', paddingLeft: 10,
                marginBottom: 16, fontSize: 13,
              }}>
                <div style={{ fontWeight: 500, color: '#111827' }}>{rule.template?.title || '无标题'}</div>
                <div style={{ color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rule.template?.body || '无内容'}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleToggle(rule.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13,
                    border: '1px solid #D1D5DB', background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {rule.enabled ? '⏸ 禁用' : '▶ 启用'}
                </button>
                <button
                  onClick={() => handleTrigger(rule)}
                  disabled={triggeringId === rule.id}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13,
                    border: '1px solid #D1D5DB', background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {triggeringId === rule.id ? '⏳' : '🚀'} 手动触发
                </button>
                <button
                  onClick={() => openLogs(rule.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13,
                    border: '1px solid #D1D5DB', background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  📊 日志
                </button>
                <button
                  onClick={() => openEdit(rule)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13,
                    border: '1px solid #D1D5DB', background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ 编辑
                </button>
                <button
                  onClick={() => handleDelete(rule.id, rule.name)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13,
                    border: '1px solid #FEE2E2', background: '#FEF2F2',
                    color: '#DC2626', cursor: 'pointer',
                  }}
                >
                  🗑 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== 创建/编辑弹窗 ========== */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setShowModal(false); resetForm() }}>
          <div style={{
            background: '#fff', borderRadius: 16, width: 680, maxHeight: '90vh',
            overflow: 'auto', padding: 32,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>
              {editing ? '编辑通知规则' : '新建通知规则'}
            </h2>

            {/* 基本信息 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>规则名称 *</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="例如：每日跟进逾期提醒"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>描述</label>
              <input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="简要说明这个规则的作用"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {/* 触发类型 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>触发类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['schedule', 'event', 'cron'] as TriggerType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm({
                      ...form, trigger_type: t,
                      trigger_config: TRIGGER_DEFAULTS[t],
                    })}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 14,
                      border: form.trigger_type === t ? '2px solid #4F46E5' : '1px solid #D1D5DB',
                      background: form.trigger_type === t ? '#EEF2FF' : '#fff',
                      fontWeight: form.trigger_type === t ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {triggerTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            {/* 触发配置（动态） */}
            {form.trigger_type === 'schedule' && (
              <div style={{ marginBottom: 20, background: '#F9FAFB', padding: 16, borderRadius: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>定时配置</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <select
                    value={form.trigger_config.type || 'daily'}
                    onChange={e => setForm({
                      ...form, trigger_config: {
                        ...form.trigger_config, type: e.target.value as 'daily' | 'weekly' | 'interval',
                      },
                    })}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }}
                  >
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                    <option value="interval">间隔</option>
                  </select>
                  <input
                    type="time"
                    value={form.trigger_config.time || '09:00'}
                    onChange={e => setForm({
                      ...form, trigger_config: { ...form.trigger_config, time: e.target.value },
                    })}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }}
                  />
                  {form.trigger_config.type === 'interval' && (
                    <input
                      type="number"
                      value={form.trigger_config.interval_minutes || 30}
                      onChange={e => setForm({
                        ...form, trigger_config: {
                          ...form.trigger_config, interval_minutes: parseInt(e.target.value) || 30,
                        },
                      })}
                      placeholder="分钟"
                      style={{ width: 80, padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }}
                    />
                  )}
                </div>
              </div>
            )}

            {form.trigger_type === 'event' && (
              <div style={{ marginBottom: 20, background: '#F9FAFB', padding: 16, borderRadius: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>事件类型</label>
                <select
                  value={form.trigger_config.event || ''}
                  onChange={e => setForm({
                    ...form, trigger_config: {
                      ...form.trigger_config, event: e.target.value,
                    },
                  })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14 }}
                >
                  {eventTypes.map(et => (
                    <option key={et.value} value={et.value}>{et.label} - {et.description}</option>
                  ))}
                </select>

                {/* 事件筛选条件 */}
                {form.trigger_config.event === 'followup_overdue' && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 13, color: '#374151' }}>逾期天数：</label>
                    <input
                      type="number"
                      value={(form.trigger_config.filters?.days_overdue as number) || 7}
                      onChange={e => setForm({
                        ...form, trigger_config: {
                          ...form.trigger_config,
                          filters: { ...(form.trigger_config.filters || {}), days_overdue: parseInt(e.target.value) || 7 },
                        },
                      })}
                      style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', marginLeft: 8 }}
                    />
                    <span style={{ marginLeft: 4, fontSize: 13, color: '#6B7280' }}>天</span>
                  </div>
                )}

                {form.trigger_config.event === 'intent_high' && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 13, color: '#374151' }}>意向分阈值：</label>
                    <input
                      type="number"
                      value={(form.trigger_config.filters?.min_score as number) || 80}
                      onChange={e => setForm({
                        ...form, trigger_config: {
                          ...form.trigger_config,
                          filters: { ...(form.trigger_config.filters || {}), min_score: parseInt(e.target.value) || 80 },
                        },
                      })}
                      style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', marginLeft: 8 }}
                    />
                  </div>
                )}

                {form.trigger_config.event === 'customer_inactive' && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 13, color: '#374151' }}>不活跃天数：</label>
                    <input
                      type="number"
                      value={(form.trigger_config.filters?.days_inactive as number) || 30}
                      onChange={e => setForm({
                        ...form, trigger_config: {
                          ...form.trigger_config,
                          filters: { ...(form.trigger_config.filters || {}), days_inactive: parseInt(e.target.value) || 30 },
                        },
                      })}
                      style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', marginLeft: 8 }}
                    />
                    <span style={{ marginLeft: 4, fontSize: 13, color: '#6B7280' }}>天</span>
                  </div>
                )}

                {form.trigger_config.event === 'task_due' && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 13, color: '#374151' }}>提前提醒（小时）：</label>
                    <input
                      type="number"
                      value={(form.trigger_config.filters?.hours_ahead as number) || 24}
                      onChange={e => setForm({
                        ...form, trigger_config: {
                          ...form.trigger_config,
                          filters: { ...(form.trigger_config.filters || {}), hours_ahead: parseInt(e.target.value) || 24 },
                        },
                      })}
                      style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #D1D5DB', marginLeft: 8 }}
                    />
                  </div>
                )}
              </div>
            )}

            {form.trigger_type === 'cron' && (
              <div style={{ marginBottom: 20, background: '#F9FAFB', padding: 16, borderRadius: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Cron 表达式</label>
                <input
                  value={form.trigger_config.expression || ''}
                  onChange={e => setForm({
                    ...form, trigger_config: { ...form.trigger_config, expression: e.target.value },
                  })}
                  placeholder="例如：0 9 * * 1-5"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  格式：分 时 日 月 周（例如 0 9 * * 1-5 = 工作日早9点）
                </p>
              </div>
            )}

            {/* 通知渠道 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>通知渠道（可多选）</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CHANNEL_OPTIONS.map(ch => (
                  <button
                    key={ch.value}
                    onClick={() => {
                      const channels = form.channels.includes(ch.value)
                        ? form.channels.filter(c => c !== ch.value)
                        : [...form.channels, ch.value]
                      setForm({ ...form, channels })
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: 8, fontSize: 14,
                      border: form.channels.includes(ch.value) ? '2px solid #4F46E5' : '1px solid #D1D5DB',
                      background: form.channels.includes(ch.value) ? '#EEF2FF' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>{ch.icon} {ch.label}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{ch.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 通知模板 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                通知模板 *
              </label>
              <input
                value={form.template.title}
                onChange={e => setForm({
                  ...form, template: { ...form.template, title: e.target.value },
                })}
                placeholder="通知标题，支持 {{变量}}"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', marginBottom: 8 }}
              />
              <textarea
                value={form.template.body}
                onChange={e => setForm({
                  ...form, template: { ...form.template, body: e.target.value },
                })}
                placeholder="通知内容，支持 {{变量}}"
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', marginBottom: 8, resize: 'vertical' }}
              />
              <input
                value={form.template.link || ''}
                onChange={e => setForm({
                  ...form, template: { ...form.template, link: e.target.value },
                })}
                placeholder="跳转链接（可选）例如：/app/customers/{{customer_id}}"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }}
              />
              {/* 变量提示 */}
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {VARIABLE_HINTS.map(h => (
                  <span
                    key={h.var}
                    onClick={() => {
                      const varStr = `{{${h.var}}}`
                      setForm({
                        ...form, template: {
                          ...form.template,
                          body: form.template.body + (form.template.body ? ' ' : '') + varStr,
                        },
                      })
                    }}
                    style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4,
                      background: '#EEF2FF', color: '#4F46E5',
                      cursor: 'pointer', userSelect: 'none',
                    }}
                    title={h.desc}
                  >
                    {`{{${h.var}}}`}
                  </span>
                ))}
              </div>
            </div>

            {/* 高级设置 */}
            <details style={{ marginBottom: 20 }}>
              <summary style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#6B7280' }}>
                高级设置
              </summary>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#374151' }}>冷却时间（分钟）</label>
                  <input
                    type="number"
                    value={form.cooldown_minutes}
                    onChange={e => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 60 })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#374151' }}>单次最大触发数</label>
                  <input
                    type="number"
                    value={form.max_per_run}
                    onChange={e => setForm({ ...form, max_per_run: parseInt(e.target.value) || 50 })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#374151' }}>优先级</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', marginTop: 4 }}
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </details>

            {/* 底部按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                style={{
                  padding: '10px 24px', borderRadius: 8,
                  border: '1px solid #D1D5DB', background: '#fff',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !form.name.trim() || !form.template.title.trim()}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: loading ? '#9CA3AF' : '#4F46E5',
                  color: '#fff', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '保存中...' : (editing ? '保存修改' : '创建规则')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 日志面板 ========== */}
      {showLogs && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowLogs(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, width: 600, maxHeight: '80vh',
            overflow: 'auto', padding: 32,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>触发日志</h3>
              <button
                onClick={() => setShowLogs(false)}
                style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            {logs.length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>暂无日志</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px' }}>时间</th>
                    <th style={{ textAlign: 'left', padding: '8px 4px' }}>规则</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px' }}>接收人</th>
                    <th style={{ textAlign: 'left', padding: '8px 4px' }}>渠道</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 4px', color: '#6B7280' }}>
                        {new Date(log.triggered_at).toLocaleString('zh-CN')}
                      </td>
                      <td style={{ padding: '8px 4px' }}>{log.rule?.name || '-'}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>{log.recipients_count}</td>
                      <td style={{ padding: '8px 4px' }}>
                        {(log.channels_used || []).map(ch => channelLabel(ch)).join(' ')}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: log.status === 'success' ? '#ECFDF5' : log.status === 'partial' ? '#FEF3C7' : '#FEE2E2',
                          color: log.status === 'success' ? '#059669' : log.status === 'partial' ? '#D97706' : '#DC2626',
                        }}>
                          {log.status === 'success' ? '成功' : log.status === 'partial' ? '部分' : '失败'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
