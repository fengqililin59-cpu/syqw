/**
 * @file 自动化流程编辑器：React Flow 画布 + 可视化配置面板 + 保存到后端。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getJson, postJson, putJson } from '@/api/client'
import { fetchTags } from '@/api/tags'
import { PageHelpCard } from '@/components/PageHelpCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'
import type { TagRow } from '@/api/types'

type FlowNodeKind = 'trigger' | 'condition' | 'action' | 'delay'

type FlowNodeData = {
  config: Record<string, unknown>
}

type TriggerTypeOption = {
  value: string
  label: string
  description?: string
}

type ActionTypeOption = {
  value: string
  label: string
  fields: string[]
}

type ConditionTypeOption = {
  value: string
  label: string
  operators: string[]
}

// ─── canvas node shapes ───────────────────────────────────────────────────────
function TriggerShape(_props: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className="min-w-[140px] rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-emerald-900">⚡ 触发器</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function ConditionShape(_props: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className="min-w-[150px] rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="font-semibold text-amber-900">🔀 条件</div>
      <div className="relative mt-2 h-6">
        <span className="absolute left-2 text-[10px] text-amber-700">✓ 是</span>
        <span className="absolute right-2 text-[10px] text-amber-700">✗ 否</span>
        <Handle id="yes" type="source" position={Position.Bottom} style={{ left: '28%' }} />
        <Handle id="no" type="source" position={Position.Bottom} style={{ left: '72%' }} />
      </div>
    </div>
  )
}

function ActionShape(_props: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className="min-w-[140px] rounded-lg border-2 border-blue-600 bg-blue-50 px-3 py-2 text-xs shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="font-semibold text-blue-900">▶ 动作</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DelayShape(_props: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className="min-w-[140px] rounded-lg border-2 border-violet-600 bg-violet-50 px-3 py-2 text-xs shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="font-semibold text-violet-900">⏱ 延迟</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const initialTrigger: Node<FlowNodeData> = {
  id: 'trigger_1',
  type: 'trigger',
  position: { x: 160, y: 40 },
  data: { config: { type: 'new_customer' } },
}

// ─── constants for visual panel ───────────────────────────────────────────────
const AI_PROMPTS = [
  { value: 'welcome', label: '欢迎语' },
  { value: 'gentle_followup', label: '温和跟进' },
  { value: 'close_nudge', label: '催单提醒' },
  { value: 'intent_high', label: '高意向激活' },
  { value: 'intent_mid', label: '中意向培育' },
  { value: 'intent_low', label: '低意向唤醒' },
]

const STAGE_OPTIONS = [
  { value: 'new', label: '新线索' },
  { value: 'intent_confirm', label: '意向确认' },
  { value: 'proposal', label: '方案报价' },
  { value: 'negotiation', label: '商务谈判' },
  { value: 'deal', label: '成交' },
  { value: 'lost', label: '流失' },
]

const FOLLOW_TYPES = [
  { value: 'other', label: '📝 备注' },
  { value: 'call', label: '📞 电话' },
  { value: 'wechat', label: '💬 微信' },
  { value: 'meeting', label: '🤝 拜访' },
]

function Sel({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

interface ConfigPanelProps {
  node: Node<FlowNodeData> | null
  triggerTypes: TriggerTypeOption[]
  actionTypes: ActionTypeOption[]
  conditionTypes: ConditionTypeOption[]
  allTags: TagRow[]
  onChange: (config: Record<string, unknown>) => void
}

function NodeConfigPanel({ node, triggerTypes, actionTypes, conditionTypes, allTags, onChange }: ConfigPanelProps) {
  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center py-10 text-xs text-muted-foreground">
        点击画布上的节点进行配置
      </div>
    )
  }

  const cfg = node.data?.config ?? {}
  const set = (patch: Record<string, unknown>) => onChange({ ...cfg, ...patch })

  if (node.type === 'trigger') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-emerald-700">⚡ 触发器配置</p>
        <Sel
          label="触发时机"
          value={String(cfg.type || triggerTypes[0]?.value || 'new_customer')}
          onChange={(v) => set({ type: v })}
          options={triggerTypes}
        />
        {triggerTypes.find((t) => t.value === String(cfg.type))?.description && (
          <p className="text-[11px] text-muted-foreground">
            {triggerTypes.find((t) => t.value === String(cfg.type))!.description}
          </p>
        )}
        {String(cfg.type) === 'stage_changed' ? (
          <Sel
            label="目标阶段（可选）"
            value={String(cfg.to_stage || '')}
            onChange={(v) => set({ to_stage: v || undefined })}
            options={[
              { value: '', label: '任意阶段变更' },
              { value: 'intent_confirm', label: '意向确认' },
              { value: 'proposal', label: '方案报价' },
              { value: 'negotiation', label: '商务谈判' },
              { value: 'deal', label: '成交' },
              { value: 'lost', label: '流失' },
            ]}
          />
        ) : null}
      </div>
    )
  }

  if (node.type === 'delay') {
    const minutes = Number(cfg.minutes) || 10
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-violet-700">⏱ 延迟配置</p>
        <div className="space-y-1">
          <Label className="text-xs">等待时间（分钟）</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => set({ minutes: Number(e.target.value) || 1 })}
              className="h-8 w-28 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {minutes >= 1440
                ? `≈ ${Math.round(minutes / 1440)} 天`
                : minutes >= 60
                ? `≈ ${Math.round(minutes / 60)} 小时`
                : `${minutes} 分钟`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            [10, '10 分'],
            [60, '1 小时'],
            [360, '6 小时'],
            [1440, '1 天'],
            [4320, '3 天'],
          ] as [number, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => set({ minutes: m })}
              className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                minutes === m
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'border-input text-muted-foreground hover:border-violet-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (node.type === 'condition') {
    const condType = String(cfg.type || 'intention_score')
    const cond = conditionTypes.find((c) => c.value === condType)
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-amber-700">🔀 条件配置</p>
        <Sel
          label="判断维度"
          value={condType}
          onChange={(v) => onChange({ type: v })}
          options={conditionTypes.length ? conditionTypes : [{ value: 'intention_score', label: '意向分' }]}
        />
        {condType === 'intention_score' && (
          <div className="flex items-end gap-2">
            <Sel
              label="运算符"
              value={String(cfg.operator || '>=')}
              onChange={(v) => set({ operator: v })}
              options={(cond?.operators ?? ['>=', '>', '<=', '<', '==']).map((o) => ({ value: o, label: o }))}
            />
            <div className="space-y-1">
              <Label className="text-xs">值（0-100）</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={Number(cfg.value) || 80}
                onChange={(e) => set({ value: Number(e.target.value) })}
                className="h-8 w-20 text-sm"
              />
            </div>
          </div>
        )}
        {condType === 'no_reply_hours' && (
          <div className="space-y-1">
            <Label className="text-xs">超过 N 小时未回复</Label>
            <Input
              type="number"
              min={1}
              value={Number(cfg.hours) || 24}
              onChange={(e) => set({ hours: Number(e.target.value) })}
              className="h-8 w-28 text-sm"
            />
          </div>
        )}
        <div className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          满足条件走「✓ 是」分支，否则走「✗ 否」分支。
        </div>
      </div>
    )
  }

  if (node.type === 'action') {
    const actType = String(cfg.type || 'ai_notify')
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-blue-700">▶ 动作配置</p>
        <Sel
          label="动作类型"
          value={actType}
          onChange={(v) => onChange({ type: v })}
          options={actionTypes.length ? actionTypes : [{ value: 'ai_notify', label: 'AI 话术提醒销售' }]}
        />
        {actType === 'ai_notify' && (
          <Sel label="AI 话术风格" value={String(cfg.prompt || 'gentle_followup')} onChange={(v) => set({ prompt: v })} options={AI_PROMPTS} />
        )}
        {actType === 'send_message' && (
          <>
            <Sel
              label="发送模式"
              value={String(cfg.mode || 'ai')}
              onChange={(v) => set({ mode: v })}
              options={[{ value: 'ai', label: 'AI 自动生成' }, { value: 'fixed', label: '固定文本' }]}
            />
            {cfg.mode === 'fixed' ? (
              <div className="space-y-1">
                <Label className="text-xs">消息内容</Label>
                <Textarea
                  value={String(cfg.fixed_text || '')}
                  onChange={(e) => set({ fixed_text: e.target.value })}
                  placeholder="直发给客户的消息..."
                  className="min-h-[72px] resize-none text-xs"
                />
              </div>
            ) : (
              <Sel label="AI 话术风格" value={String(cfg.prompt || 'gentle_followup')} onChange={(v) => set({ prompt: v })} options={AI_PROMPTS} />
            )}
            <div className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              ⚠ 需在设置页开启「企微自动发送」，且客户未退订。
            </div>
          </>
        )}
        {actType === 'mark_deal' && (
          <p className="text-[11px] text-muted-foreground">自动将客户阶段改为「成交」，遵守防回退规则。</p>
        )}
        {actType === 'change_stage' && (
          <Sel label="目标阶段" value={String(cfg.stage || 'intent_confirm')} onChange={(v) => set({ stage: v })} options={STAGE_OPTIONS} />
        )}
        {actType === 'add_tag' && (
          <div className="space-y-1.5">
            <Label className="text-xs">选择标签（可多选）</Label>
            {allTags.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">暂无标签，请先在「标签管理」中创建。</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => {
                  const selected = Array.isArray(cfg.tag_ids) && (cfg.tag_ids as number[]).includes(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        const cur = Array.isArray(cfg.tag_ids) ? (cfg.tag_ids as number[]) : []
                        set({ tag_ids: selected ? cur.filter((x) => x !== t.id) : [...cur, t.id] })
                      }}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary'}`}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {actType === 'add_followup' && (
          <>
            <Sel label="跟进类型" value={String(cfg.follow_type || 'other')} onChange={(v) => set({ follow_type: v })} options={FOLLOW_TYPES} />
            <div className="space-y-1">
              <Label className="text-xs">跟进内容</Label>
              <Textarea
                value={String(cfg.content || '')}
                onChange={(e) => set({ content: e.target.value })}
                placeholder="自动写入客户跟进记录..."
                className="min-h-[64px] resize-none text-xs"
              />
            </div>
          </>
        )}
      </div>
    )
  }

  return null
}

export function FlowBuilderPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canManage = hasPermUser(permissions, 'automation:manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const flowId = searchParams.get('id')

  const [name, setName] = useState('未命名流程')
  const [status, setStatus] = useState<'draft' | 'active' | 'paused'>('draft')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [testCustomerId, setTestCustomerId] = useState('')
  const [triggerTypes, setTriggerTypes] = useState<TriggerTypeOption[]>([
    { value: 'new_customer', label: '新客户入库', description: '当客户被创建后自动触发流程' },
  ])
  const [actionTypes, setActionTypes] = useState<ActionTypeOption[]>([])
  const [conditionTypes, setConditionTypes] = useState<ConditionTypeOption[]>([])
  const [allTags, setAllTags] = useState<TagRow[]>([])

  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerShape,
      condition: ConditionShape,
      action: ActionShape,
      delay: DelayShape,
    }),
    [],
  )

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null

  // ── load meta + tags ──
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getJson<{
        trigger_types: TriggerTypeOption[]
        action_types?: ActionTypeOption[]
        condition_types?: ConditionTypeOption[]
      }>('/flows/meta'),
      fetchTags(),
    ])
      .then(([meta, tags]) => {
        if (cancelled) return
        if (Array.isArray(meta.trigger_types) && meta.trigger_types.length)
          setTriggerTypes(meta.trigger_types)
        if (Array.isArray(meta.action_types) && meta.action_types.length)
          setActionTypes(meta.action_types)
        if (Array.isArray(meta.condition_types) && meta.condition_types.length)
          setConditionTypes(meta.condition_types)
        setAllTags(tags)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!flowId) {
      setNodes([initialTrigger])
      setEdges([])
      setName('未命名流程')
      setStatus('draft')
      return
    }
    let cancelled = false
    setLoading(true)
    getJson<{
      id: number
      name: string
      status: string
      nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data?: { config?: unknown } }>
      edges: Array<{ source: string; target: string; sourceHandle?: string }>
    }>(`/flows/${flowId}`)
      .then((data) => {
        if (cancelled) return
        setName(data.name)
        setStatus((data.status as 'draft' | 'active' | 'paused') || 'draft')
        setNodes(
          data.nodes.map((n) => ({
            id: n.id,
            type: n.type as FlowNodeKind,
            position: n.position,
            data: { config: (n.data?.config as Record<string, unknown>) ?? {} },
          })),
        )
        setEdges(
          data.edges.map((e, i) => ({
            id: e.source + e.target + i,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setNodes([initialTrigger])
          setEdges([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [flowId, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  )

  const onNodeClick = useCallback((_e: MouseEvent, node: Node) => {
    setSelectedId(node.id)
  }, [])

  function addNode(kind: FlowNodeKind) {
    const id = `${kind}_${Date.now()}`
    const defaults: Record<FlowNodeKind, Record<string, unknown>> = {
      trigger: { type: triggerTypes[0]?.value || 'new_customer' },
      condition: { type: 'intention_score', operator: '>=', value: 80 },
      action: { type: 'ai_notify', prompt: 'gentle_followup' },
      delay: { minutes: 60 },
    }
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: kind,
        position: { x: 120 + nds.length * 24, y: 120 + nds.length * 18 },
        data: { config: defaults[kind] },
      },
    ])
    setSelectedId(id)
  }

  function handleConfigChange(config: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config } } : n)),
    )
  }

  async function onBootstrapStarterPack() {
    setBootstrapping(true)
    setBootstrapMsg(null)
    try {
      const res = await postJson<{ message: string; welcome?: { flow_id: number } }>(
        '/flows/bootstrap/starter-pack',
        {},
      )
      setBootstrapMsg(res.message)
      if (res.welcome?.flow_id) setSearchParams({ id: String(res.welcome.flow_id) })
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '初始化失败')
    } finally {
      setBootstrapping(false)
    }
  }

  async function onBootstrapWelcome() {
    setBootstrapping(true)
    setBootstrapMsg(null)
    try {
      const res = await postJson<{
        created: boolean
        flow_id: number
        message: string
        hint?: string
      }>('/flows/bootstrap/welcome', {})
      setBootstrapMsg(res.hint ? `${res.message}（${res.hint}）` : res.message)
      setSearchParams({ id: String(res.flow_id) })
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '创建失败')
    } finally {
      setBootstrapping(false)
    }
  }

  async function onSave() {
    setSaving(true)
    try {
      const body = {
        name,
        status,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { config: (n.data?.config as Record<string, unknown>) ?? {} },
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
        })),
      }
      if (flowId) {
        await putJson(`/flows/${flowId}`, body)
        window.alert('已保存')
      } else {
        const created = await postJson<{ id: number }>('/flows', body)
        setSearchParams({ id: String(created.id) })
        window.alert('已创建流程')
      }
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">缺少权限：automation:manage</p>
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">流程编排</h1>
        <p className="mt-1 text-sm text-muted-foreground">客户刚入库或阶段变化时，自动发欢迎语、打标签、通知销售。</p>
      </div>

      <PageHelpCard
        title="新手推荐：不要从空白画布开始"
        summary="大多数团队只需「一键起步包」，系统会自动创建欢迎流程 + 自动跟进规则。"
        steps={[
          { title: '点下方「一键起步包」', detail: '约 10 秒，无需手动画线' },
          { title: '把流程状态改为「启用」', detail: '保存后新客户入库会自动执行' },
          { title: '在「系统设置」配好企微', detail: '配好后发消息、同步客户才会生效' },
        ]}
        tip="与「自动跟进规则」的区别：流程编排管「刚进来时做什么」；自动跟进管「每天扫一遍沉默客户」。"
      />

      {bootstrapMsg ? (
        <p className="text-sm text-green-600 dark:text-green-500">{bootstrapMsg}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="secondary" disabled={bootstrapping} onClick={() => void onBootstrapStarterPack()}>
          {bootstrapping ? '初始化中…' : '一键起步包'}
        </Button>
        <Button type="button" variant="outline" disabled={bootstrapping} onClick={() => void onBootstrapWelcome()}>
          仅欢迎流程
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/app/flows">流程列表</Link>
        </Button>
        <div className="space-y-1">
          <Label>名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
        </div>
        <div className="space-y-1">
          <Label>状态</Label>
          <select
            className="flex h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'paused')}
          >
            <option value="draft">草稿</option>
            <option value="active">启用（新客户触发）</option>
            <option value="paused">暂停</option>
          </select>
        </div>
        <Button type="button" onClick={() => void onSave()} disabled={loading || saving}>
          {saving ? '保存中...' : '保存流程'}
        </Button>
        {flowId && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label>试运行客户 ID</Label>
              <Input
                className="w-28 font-mono text-xs"
                placeholder="客户 id"
                value={testCustomerId}
                onChange={(e) => setTestCustomerId(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const cid = Number(testCustomerId)
                if (!cid) {
                  window.alert('请输入客户 ID')
                  return
                }
                void postJson(`/flows/${flowId}/runs`, { customer_id: cid })
                  .then(() => window.alert('已启动运行'))
                  .catch((e: unknown) => window.alert(e instanceof Error ? e.message : '运行失败'))
              }}
            >
              试运行
            </Button>
          </div>
        )}
      </div>

      {/* 主区域：节点库 + 画布 + 配置面板 */}
      <div className="flex min-h-[540px] flex-1 flex-col gap-2 md:flex-row">
        {/* 左：节点库 */}
        <aside className="flex w-full shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 md:w-44">
          <p className="text-xs font-semibold text-muted-foreground">节点库</p>
          {(
            [
              { kind: 'trigger' as FlowNodeKind, label: '⚡ 触发器', color: 'border-emerald-200 hover:border-emerald-500 text-emerald-800' },
              { kind: 'condition' as FlowNodeKind, label: '🔀 条件', color: 'border-amber-200 hover:border-amber-500 text-amber-800' },
              { kind: 'action' as FlowNodeKind, label: '▶ 动作', color: 'border-blue-200 hover:border-blue-500 text-blue-800' },
              { kind: 'delay' as FlowNodeKind, label: '⏱ 延迟', color: 'border-violet-200 hover:border-violet-500 text-violet-800' },
            ]
          ).map(({ kind, label, color }) => (
            <button
              key={kind}
              type="button"
              onClick={() => addNode(kind)}
              className={`rounded-lg border-2 px-2 py-2 text-left text-xs font-medium transition-colors ${color}`}
            >
              {label}
            </button>
          ))}
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            点击添加节点；从锚点拖线连接；点击节点在右侧配置。
          </p>
        </aside>

        {/* 中：画布 */}
        <div className="min-h-[480px] flex-1 overflow-hidden rounded-xl border bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>

        {/* 右：可视化配置面板 */}
        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4 md:w-72">
          <p className="text-sm font-semibold">
            {selectedNode ? `配置：${selectedId}` : '节点配置'}
          </p>
          <NodeConfigPanel
            node={selectedNode}
            triggerTypes={triggerTypes}
            actionTypes={actionTypes}
            conditionTypes={conditionTypes}
            allTags={allTags}
            onChange={handleConfigChange}
          />
          {selectedNode && (
            <button
              onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selectedId))
                setEdges((eds) =>
                  eds.filter((e) => e.source !== selectedId && e.target !== selectedId),
                )
                setSelectedId(null)
              }}
              className="mt-auto rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50"
            >
              删除此节点
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
