/**
 * @file 销售看板：按 CRM 阶段分列展示客户，拖拽或点击推进阶段。
 *
 * 管道阶段从 /api/pipeline/stages 动态加载，支持租户自定义。
 * 加载失败时回退到硬编码默认6阶段。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GripVertical } from 'lucide-react'
import { getJson, putJson } from '@/api/client'
import { getStages } from '@/api/pipeline'
import type { PipelineStage } from '@/api/pipeline'
import type { CustomerRow, Paginated } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'

/** 默认管道（API 加载失败时回退） */
const FALLBACK_STAGES: PipelineStage[] = [
  { key: 'new',             label: '新线索',   color: '#94a3b8', category: 'open', order: 0 },
  { key: 'intent_confirm',  label: '意向确认', color: '#60a5fa', category: 'open', order: 1 },
  { key: 'proposal',        label: '方案报价', color: '#a78bfa', category: 'open', order: 2 },
  { key: 'negotiation',     label: '商务谈判', color: '#f59e0b', category: 'open', order: 3 },
  { key: 'deal',            label: '成交',     color: '#10b981', category: 'won',  order: 4 },
  { key: 'lost',            label: '流失',     color: '#ef4444', category: 'lost', order: 5 },
]

function formatMoney(v?: number | null) {
  const n = Number(v || 0)
  if (!n || n <= 0) return null
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function columnRevenue(customers: CustomerRow[]) {
  return customers.reduce((sum, c) => sum + Number(c.order_paid_total || 0), 0)
}

export function CustomersPipelinePage() {
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)
  const canEdit = hasPermUser(permissions, 'customer:edit')

  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(FALLBACK_STAGES)
  const [columns, setColumns] = useState<Record<string, CustomerRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<number | null>(null)

  // 加载管道阶段
  useEffect(() => {
    let cancelled = false
    getStages()
      .then((stages) => {
        if (!cancelled) setPipelineStages(stages)
      })
      .catch(() => {
        // 回退到默认
      })
    return () => { cancelled = true }
  }, [])

  // 初始化 columns
  useEffect(() => {
    const init: Record<string, CustomerRow[]> = {}
    pipelineStages.forEach((s) => { init[s.key] = [] })
    setColumns(init)
  }, [pipelineStages])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        pipelineStages.map((s) =>
          getJson<Paginated<CustomerRow>>(
            `/customers?stage=${s.key}&page=1&size=40&with_order_stats=1`,
          ),
        ),
      )
      const next: Record<string, CustomerRow[]> = {}
      pipelineStages.forEach((s, i) => {
        next[s.key] = results[i]?.list ?? []
      })
      setColumns(next)
    } finally {
      setLoading(false)
    }
  }, [pipelineStages])

  useEffect(() => {
    void load()
  }, [load])

  async function moveCustomer(customerId: number, fromKey: string, toKey: string) {
    if (fromKey === toKey || !canEdit) return
    const card = columns[fromKey]?.find((c) => c.id === customerId)
    if (!card) return

    setColumns((prev) => ({
      ...prev,
      [fromKey]: (prev[fromKey] || []).filter((c) => c.id !== customerId),
      [toKey]: [{ ...card, stage: toKey }, ...(prev[toKey] || [])],
    }))

    try {
      await putJson(`/customers/${customerId}`, { stage: toKey })
    } catch {
      await load()
    }
  }

  function onDragStart(id: number) {
    if (!canEdit) return
    setDragId(id)
  }

  function onDrop(stageKey: string) {
    if (dragId == null) return
    let from: string | null = null
    for (const s of pipelineStages) {
      if ((columns[s.key] || []).some((c) => c.id === dragId)) from = s.key
    }
    if (from) void moveCustomer(dragId, from, stageKey)
    setDragId(null)
  }

  const totalCount = pipelineStages.reduce((n, s) => n + (columns[s.key] || []).length, 0)
  const totalRevenue = pipelineStages.reduce((n, s) => n + columnRevenue(columns[s.key] || []), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">销售看板</h1>
          <p className="text-sm text-muted-foreground">
            拖拽客户卡片推进 pipeline；共 {totalCount} 条
            {totalRevenue > 0 ? ` · 关联订单 ${formatMoney(totalRevenue)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/app/pipeline-settings"
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            管道配置
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            刷新
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <p className="text-xs text-amber-700">当前账号无 customer:edit，仅可查看，无法拖拽改阶段。</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipelineStages.map((col) => (
            <div
              key={col.key}
              className="min-w-[220px] flex-1 rounded-xl border-2 p-2"
              style={{
                borderColor: col.color,
                backgroundColor: col.color + '14',
              }}
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={() => onDrop(col.key)}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <span className="text-sm font-semibold">{col.label}</span>
                  {columnRevenue(columns[col.key] || []) > 0 ? (
                    <p className="text-[10px] text-emerald-700">
                      {formatMoney(columnRevenue(columns[col.key] || []))}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">{(columns[col.key] || []).length}</Badge>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                {(columns[col.key] || []).length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无客户</p>
                ) : (
                  (columns[col.key] || []).map((c) => (
                    <Card
                      key={c.id}
                      draggable={canEdit}
                      onDragStart={() => onDragStart(c.id)}
                      className="cursor-grab shadow-sm active:cursor-grabbing"
                    >
                      <CardHeader className="p-3 pb-1">
                        <div className="flex items-start gap-1">
                          {canEdit ? (
                            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                          <CardTitle className="text-sm leading-snug">
                            <Link
                              to={`/app/customers/${c.id}`}
                              className="hover:text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.name || c.nickname || `客户 #${c.id}`}
                            </Link>
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1.5 p-3 pt-0 text-xs text-muted-foreground">
                        {c.company ? <p>{c.company}</p> : null}
                        {c.phone ? <p>{c.phone}</p> : null}
                        {c.intent_score != null && c.intent_score > 0 ? (
                          <p>意向分 {c.intent_score}</p>
                        ) : null}
                        {c.discovery_completeness_percent != null ? (
                          <p className={c.discovery_ready ? 'text-emerald-700' : 'text-amber-700'}>
                            需求登记 {c.discovery_completeness_percent}%
                            {!c.discovery_ready ? ' · 待完善' : ''}
                          </p>
                        ) : null}
                        {c.order_paid_total != null && Number(c.order_paid_total) > 0 ? (
                          <p className="font-medium text-emerald-700">
                            订单 {formatMoney(Number(c.order_paid_total))}
                            {c.order_count && c.order_count > 1 ? ` · ${c.order_count} 笔` : ''}
                          </p>
                        ) : null}
                        {c.owner?.real_name || c.owner?.username ? (
                          <p>负责人 {c.owner?.real_name || c.owner?.username}</p>
                        ) : null}
                        {canEdit ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {pipelineStages
                              .filter((s) => s.key !== col.key)
                              .slice(0, 2)
                              .map((s) => (
                                <button
                                  key={s.key}
                                  type="button"
                                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80"
                                  onClick={() => void moveCustomer(c.id, col.key, s.key)}
                                >
                                  → {s.label}
                                </button>
                              ))}
                            <button
                              type="button"
                              className="text-[10px] text-primary hover:underline"
                              onClick={() => navigate(`/app/customers/${c.id}`)}
                            >
                              详情
                            </button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
