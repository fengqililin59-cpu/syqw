/**
 * @file 销售看板：按 CRM 阶段分列展示客户，拖拽或点击推进阶段。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GripVertical } from 'lucide-react'
import { getJson, putJson } from '@/api/client'
import type { CustomerRow, Paginated } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'

const PIPELINE_STAGES = [
  { value: 'new', label: '新线索', color: 'border-slate-200 bg-slate-50' },
  { value: 'intent_confirm', label: '意向确认', color: 'border-blue-200 bg-blue-50' },
  { value: 'proposal', label: '方案报价', color: 'border-purple-200 bg-purple-50' },
  { value: 'negotiation', label: '商务谈判', color: 'border-amber-200 bg-amber-50' },
  { value: 'deal', label: '成交', color: 'border-emerald-200 bg-emerald-50' },
  { value: 'lost', label: '流失', color: 'border-red-100 bg-red-50' },
] as const

type StageValue = (typeof PIPELINE_STAGES)[number]['value']

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

  const [columns, setColumns] = useState<Record<StageValue, CustomerRow[]>>({
    new: [],
    intent_confirm: [],
    proposal: [],
    negotiation: [],
    deal: [],
    lost: [],
  })
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        PIPELINE_STAGES.map((s) =>
          getJson<Paginated<CustomerRow>>(
            `/customers?stage=${s.value}&page=1&size=40&with_order_stats=1`,
          ),
        ),
      )
      const next = {} as Record<StageValue, CustomerRow[]>
      PIPELINE_STAGES.forEach((s, i) => {
        next[s.value] = results[i]?.list ?? []
      })
      setColumns(next)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function moveCustomer(customerId: number, fromStage: StageValue, toStage: StageValue) {
    if (fromStage === toStage || !canEdit) return
    const card = columns[fromStage].find((c) => c.id === customerId)
    if (!card) return

    setColumns((prev) => ({
      ...prev,
      [fromStage]: prev[fromStage].filter((c) => c.id !== customerId),
      [toStage]: [{ ...card, stage: toStage }, ...prev[toStage]],
    }))

    try {
      await putJson(`/customers/${customerId}`, { stage: toStage })
    } catch {
      await load()
    }
  }

  function onDragStart(id: number) {
    if (!canEdit) return
    setDragId(id)
  }

  function onDrop(stage: StageValue) {
    if (dragId == null) return
    let from: StageValue | null = null
    for (const s of PIPELINE_STAGES) {
      if (columns[s.value].some((c) => c.id === dragId)) from = s.value
    }
    if (from) void moveCustomer(dragId, from, stage)
    setDragId(null)
  }

  const totalCount = PIPELINE_STAGES.reduce((n, s) => n + columns[s.value].length, 0)
  const totalRevenue = PIPELINE_STAGES.reduce((n, s) => n + columnRevenue(columns[s.value]), 0)

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
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
      </div>

      {!canEdit ? (
        <p className="text-xs text-amber-700">当前账号无 customer:edit，仅可查看，无法拖拽改阶段。</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((col) => (
            <div
              key={col.value}
              className={`min-w-[220px] flex-1 rounded-xl border-2 ${col.color} p-2`}
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={() => onDrop(col.value)}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <span className="text-sm font-semibold">{col.label}</span>
                  {columnRevenue(columns[col.value]) > 0 ? (
                    <p className="text-[10px] text-emerald-700">{formatMoney(columnRevenue(columns[col.value]))}</p>
                  ) : null}
                </div>
                <Badge variant="secondary">{columns[col.value].length}</Badge>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                {columns[col.value].length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无客户</p>
                ) : (
                  columns[col.value].map((c) => (
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
                            {PIPELINE_STAGES.filter((s) => s.value !== col.value)
                              .slice(0, 2)
                              .map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80"
                                  onClick={() => void moveCustomer(c.id, col.value, s.value)}
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
