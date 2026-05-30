/**
 * @file 跟进记录页：租户范围内列表、关键词筛选、按客户筛选（URL ?customer_id=）、删除。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { deleteJson, getJson } from '@/api/client'
import type { ExportCustomersResult, FollowUpListItem, OverdueFollowUpItem, Paginated } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const typeLabel: Record<string, string> = {
  call: '电话',
  wechat: '微信',
  meeting: '会议',
  other: '其他',
}

const stageOptions = [
  { value: '', label: '全部阶段' },
  { value: 'new', label: '新线索' },
  { value: 'intent_confirm', label: '意向确认' },
  { value: 'proposal', label: '方案报价' },
  { value: 'negotiation', label: '商务谈判' },
  { value: 'deal', label: '成交' },
  { value: 'lost', label: '流失' },
]

function formatDt(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false })
}

export function FollowUpsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerIdFilter = searchParams.get('customer_id') ?? ''
  const overdueMode = searchParams.get('overdue') === '1'

  const [list, setList] = useState<FollowUpListItem[]>([])
  const [overdueList, setOverdueList] = useState<OverdueFollowUpItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [draftKeyword, setDraftKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [customerIdFilter])

  const runLoad = useCallback(async () => {
    setLoading(true)
    try {
      if (overdueMode) {
        const res = await getJson<{ list: OverdueFollowUpItem[]; total: number }>('/follow-ups/overdue?limit=50')
        setOverdueList(res.list ?? [])
        setList([])
        setTotal(res.total ?? res.list?.length ?? 0)
        return
      }
      const q = new URLSearchParams({ page: String(page), size: '20' })
      if (appliedKeyword.trim()) q.set('keyword', appliedKeyword.trim())
      if (customerIdFilter) q.set('customer_id', customerIdFilter)
      const res = await getJson<Paginated<FollowUpListItem>>(`/follow-ups?${q.toString()}`)
      setList(res.list)
      setOverdueList([])
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [page, appliedKeyword, customerIdFilter, overdueMode])

  useEffect(() => {
    void runLoad()
  }, [runLoad])

  function onSearch() {
    setAppliedKeyword(draftKeyword)
    setPage(1)
  }

  async function onDelete(id: number) {
    if (!window.confirm('确定删除该跟进记录？')) return
    await deleteJson(`/follow-ups/${id}`)
    await runLoad()
  }

  async function onExport() {
    const q = new URLSearchParams()
    if (appliedKeyword.trim()) q.set('keyword', appliedKeyword.trim())
    if (customerIdFilter) q.set('customer_id', customerIdFilter)
    const qs = q.toString()
    const res = await getJson<ExportCustomersResult>(`/follow-ups/export${qs ? `?${qs}` : ''}`)
    const link = document.createElement('a')
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.file_base64}`
    link.download = res.filename
    link.click()
  }

  const filteredList =
    overdueMode || stageFilter.trim() === ''
      ? list
      : list.filter((x) => String(x.Customer?.stage || '').trim() === stageFilter)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight md:text-2xl">
            {overdueMode ? '到期未跟进' : '待跟进'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {overdueMode
              ? `计划跟进日已过且尚未补记 · 共 ${total} 位客户`
              : `本企业范围内跟进 · 共 ${total} 条`}
            {customerIdFilter ? ` · 客户 ID ${customerIdFilter}` : null}
          </p>
        </div>
        <Badge variant={overdueMode ? 'destructive' : 'outline'}>{total} 条</Badge>
        {overdueMode ? (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/app/follow-ups')}>
            查看全部跟进
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/app/follow-ups?overdue=1')}>
            到期未跟进
          </Button>
        )}
        {customerIdFilter ? (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/app/follow-ups')}>
            清除客户筛选
          </Button>
        ) : null}
      </div>

      {overdueMode ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>计划跟进</TableHead>
                <TableHead>逾期</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>加载中…</TableCell>
                </TableRow>
              ) : overdueList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无到期未跟进客户
                  </TableCell>
                </TableRow>
              ) : (
                overdueList.map((r) => (
                  <TableRow key={r.follow_up_id}>
                    <TableCell>
                      {r.customer.name || r.customer.phone || `#${r.customer_id}`}
                    </TableCell>
                    <TableCell>{r.owner?.real_name || r.owner?.username || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDt(r.next_follow_at)}</TableCell>
                    <TableCell>{r.overdue_days > 0 ? `${r.overdue_days} 天` : '今日'}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {r.content || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/app/customers/${r.customer_id}`)}>
                        去跟进
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide md:hidden">
        {stageOptions.map((stage) => (
          <button
            key={stage.value || 'all'}
            type="button"
            onClick={() => setStageFilter(stage.value)}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              stageFilter === stage.value
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {stage.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="max-w-md flex-1 space-y-2">
          <label className="text-sm font-medium">关键词（匹配内容）</label>
          <Input value={draftKeyword} onChange={(e) => setDraftKeyword(e.target.value)} placeholder="输入后点查询" />
        </div>
        <div className="hidden space-y-2 md:block">
          <label className="text-sm font-medium">阶段</label>
          <select
            className="flex h-10 md:h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            {stageOptions.map((s) => (
              <option key={s.value || 'all'} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={onSearch}>
          查询
        </Button>
        <Button type="button" variant="outline" onClick={() => void onExport()}>
          导出 Excel
        </Button>
      </div>

      <div className="hidden rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>跟进人</TableHead>
              <TableHead>内容摘要</TableHead>
              <TableHead>下次跟进</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>加载中…</TableCell>
              </TableRow>
            ) : filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  暂无跟进记录
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDt(r.created_at)}</TableCell>
                  <TableCell>{r.Customer?.name || r.Customer?.phone || `#${r.customer_id}`}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{typeLabel[r.type] ?? r.type}</Badge>
                  </TableCell>
                  <TableCell>{r.author?.real_name || r.author?.username || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{r.content}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDt(r.next_follow_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="destructive" onClick={() => void onDelete(r.id)}>
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
        {!loading && filteredList.length === 0 ? <p className="text-sm text-muted-foreground">暂无跟进记录</p> : null}
        {filteredList.map((f) => (
          <div key={f.id} className="rounded-lg border bg-white p-3">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{f.Customer?.name || '未命名客户'}</p>
                <p className="text-xs text-gray-500">{f.Customer?.phone || '—'}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {f.Customer?.stage || '—'}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">{f.content}</p>
            <p className="mt-2 text-xs text-gray-400">{formatDt(f.created_at)}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          上一页
        </Button>
        <Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
          下一页
        </Button>
      </div>
        </>
      )}
    </div>
  )
}
