/**
 * @file 统一收件箱：会话列表 + 消息流 + 人工回复 + AI 草稿 + 跟进任务。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bot, RefreshCw, Send, CheckSquare, Ticket } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fetchInboxMessages,
  fetchInboxThreads,
  replyInboxThread,
  syncInboxWework,
  updateInboxThread,
} from '@/api/inbox'
import { fetchAiOpsStats } from '@/api/aiEmployee'
import {
  completeInboxFollowup,
  createInboxFollowup,
  fetchInboxFollowups,
  type InboxFollowupRow,
} from '@/api/inboxFollowups'
import { createAiReplyDraft } from '@/api/aiEmployee'
import { createTicketFromInbox } from '@/api/tickets'
import type { InboxMessageRow, InboxThreadRow } from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusLabel: Record<string, string> = {
  open: '进行中',
  pending_human: '待人工',
  closed: '已关闭',
}

const salesStages = [
  { value: 'new', label: '新客' },
  { value: 'qualify', label: '需求确认' },
  { value: 'proposal', label: '方案' },
  { value: 'quote', label: '报价' },
  { value: 'followup', label: '跟单' },
  { value: 'deal', label: '成交' },
  { value: 'after_sale', label: '售后' },
]

const crmStageLabels: Record<string, string> = {
  new: '新线索',
  intent_confirm: '意向确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  lost: '流失',
  contacted: '意向确认',
  intent: '意向确认',
}

function customerLabel(t: InboxThreadRow) {
  const c = t.Customer
  return c?.name || c?.nickname || c?.phone || `会话 #${t.id}`
}

export function InboxPage() {
  const [searchParams] = useSearchParams()
  const customerIdParam = searchParams.get('customer_id')
  const filterCustomerId = customerIdParam ? Number(customerIdParam) : undefined

  const hasPerm = useAuthStore((s) => s.hasPerm)
  const canSync = hasPerm('settings:manage') || hasPerm('inbox:manage')

  const [threads, setThreads] = useState<InboxThreadRow[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<InboxMessageRow[]>([])
  const [followups, setFollowups] = useState<InboxFollowupRow[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sendHint, setSendHint] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [slaOverdue, setSlaOverdue] = useState(0)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketDesc, setTicketDesc] = useState('')
  const [ticketType, setTicketType] = useState('consultation')
  const [listFilter, setListFilter] = useState<'all' | 'needs_reply' | 'sla_overdue' | 'pending_human'>(
    'all',
  )
  const [listSort, setListSort] = useState<'priority' | 'recent'>('priority')

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await fetchInboxThreads({
        page: 1,
        size: 50,
        customer_id: filterCustomerId,
        sort: listSort,
        filter: listFilter,
      })
      setThreads(data.list)
      if (filterCustomerId && data.list[0]) {
        setActiveId(data.list[0].id)
      } else {
        setActiveId((prev) => prev ?? data.list[0]?.id ?? null)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [filterCustomerId, listFilter, listSort])

  const loadMessages = useCallback(async (threadId: number) => {
    setMsgLoading(true)
    try {
      const data = await fetchInboxMessages(threadId, { limit: 80 })
      setMessages(data.list)
    } catch {
      setMessages([])
    } finally {
      setMsgLoading(false)
    }
  }, [])

  const loadFollowups = useCallback(async (threadId: number) => {
    try {
      const list = await fetchInboxFollowups({ thread_id: threadId, status: 'open', limit: 20 })
      setFollowups(list)
    } catch {
      setFollowups([])
    }
  }, [])

  useEffect(() => {
    void loadThreads()
    fetchAiOpsStats({ days: 1 })
      .then((s) => setSlaOverdue(s.sla_overdue_threads ?? 0))
      .catch(() => setSlaOverdue(0))
  }, [loadThreads])

  useEffect(() => {
    if (activeId) {
      void loadMessages(activeId)
      void loadFollowups(activeId)
    }
  }, [activeId, loadMessages, loadFollowups])

  const active = threads.find((t) => t.id === activeId) ?? null

  async function onSend() {
    if (!activeId || !reply.trim()) return
    setBusy(true)
    setSendHint(null)
    try {
      const res = await replyInboxThread(activeId, { content: reply.trim() })
      const ws = res.wework_send
      if (ws?.sent) {
        setSendHint(`已通过企微发送（${ws.via || 'message_send'}）`)
      } else if (ws?.skipped) {
        setSendHint(`已记入收件箱，未发企微：${ws.reason || '未知原因'}`)
      } else {
        setSendHint('已发送')
      }
      setReply('')
      setErr(null)
      await loadMessages(activeId)
      await loadThreads()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '发送失败')
      setSendHint(null)
    } finally {
      setBusy(false)
    }
  }

  async function onAiDraft() {
    if (!activeId) return
    setBusy(true)
    setErr(null)
    try {
      const lastCustomer = [...messages].reverse().find((m) => m.direction === 'customer')
      const data = await createAiReplyDraft({
        thread_id: activeId,
        message: lastCustomer?.content || undefined,
        trigger_message_id: lastCustomer?.id,
      })
      setReply(data.draft_content)
      if (data.requires_approval) {
        setSendHint('草稿已生成，建议到 AI 审核台确认后再发')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '生成草稿失败')
    } finally {
      setBusy(false)
    }
  }

  async function onSyncWework() {
    setBusy(true)
    try {
      const r = await syncInboxWework({ limit: 500 })
      setErr(null)
      await loadThreads()
      alert(`已扫描 ${r.scanned} 条，同步 ${r.synced} 条`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '同步失败')
    } finally {
      setBusy(false)
    }
  }

  async function onStageChange(stage: string) {
    if (!activeId) return
    await updateInboxThread(activeId, { sales_stage: stage })
    await loadThreads()
  }

  async function onCreateTicket() {
    if (!activeId || !ticketTitle.trim()) return
    try {
      await createTicketFromInbox(activeId, {
        title: ticketTitle.trim(),
        description: ticketDesc.trim() || undefined,
        type: ticketType,
        priority: ticketType === 'complaint' || ticketType === 'refund' ? 'high' : 'normal',
      })
      setTicketOpen(false)
      setTicketTitle('')
      setTicketDesc('')
      setSendHint('已创建工单，可在服务台查看')
      await loadThreads()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建工单失败')
    }
  }

  async function onAddTask() {
    if (!activeId || !taskTitle.trim()) return
    await createInboxFollowup({
      title: taskTitle.trim(),
      thread_id: activeId,
      customer_id: active?.customer_id ?? undefined,
    })
    setTaskTitle('')
    await loadFollowups(activeId)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">统一收件箱</h1>
          <p className="text-sm text-muted-foreground">
            企微回复真实下发；出站同步至客户详情会话。设置 <code className="text-xs">INBOX_AUTO_DRAFT=1</code>{' '}
            可自动生成 AI 草稿。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/ai-review">AI 审核台</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadThreads()} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" />
            刷新
          </Button>
          {canSync ? (
            <Button variant="secondary" size="sm" onClick={() => void onSyncWework()} disabled={busy}>
              同步企微历史
            </Button>
          ) : null}
        </div>
      </div>

      {filterCustomerId ? (
        <p className="text-sm text-muted-foreground">
          已筛选客户 ID：{filterCustomerId}
          <Link to="/app/inbox" className="ml-2 text-primary underline">
            清除筛选
          </Link>
        </p>
      ) : null}

      {slaOverdue > 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          当前有 <strong>{slaOverdue}</strong> 个会话客户消息超时未回复，请优先处理。
        </p>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {sendHint && !err ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {sendHint}
        </p>
      ) : null}

      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-2 py-3">
            <CardTitle className="text-sm">会话</CardTitle>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', '全部'],
                  ['needs_reply', '待回复'],
                  ['sla_overdue', 'SLA超时'],
                  ['pending_human', '待人工'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={listFilter === value ? 'default' : 'outline'}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setListFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <select
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
              value={listSort}
              onChange={(e) => setListSort(e.target.value as 'priority' | 'recent')}
            >
              <option value="priority">排序：优先处理（待人工 / SLA / 待回复）</option>
              <option value="recent">排序：最近消息</option>
            </select>
          </CardHeader>
          <CardContent className="max-h-[480px] space-y-1 overflow-y-auto p-2 pt-0">
            {loading ? <p className="p-2 text-xs text-muted-foreground">加载中…</p> : null}
            {!loading && threads.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">暂无会话。配置企微回调后新消息会自动出现；也可点「同步企微历史」。</p>
            ) : null}
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  'w-full rounded-lg border px-2 py-2 text-left text-sm transition-colors',
                  activeId === t.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60',
                )}
                onClick={() => {
                  setActiveId(t.id)
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">{customerLabel(t)}</span>
                  <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
                    {t.sla_overdue ? (
                      <Badge variant="destructive" className="text-[10px]">
                        SLA
                      </Badge>
                    ) : null}
                    {t.needs_reply && !t.sla_overdue ? (
                      <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">待回</Badge>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabel[t.status] ?? t.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {t.channel?.name ?? '渠道'} · 线索分 {t.lead_score ?? 0}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-1 flex-col">
            <CardHeader className="border-b py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  {active ? customerLabel(active) : '选择会话'}
                  {active?.customer_id ? (
                    <Link
                      to={`/app/customers/${active.customer_id}`}
                      className="ml-2 text-xs font-normal text-primary underline"
                    >
                      客户详情
                    </Link>
                  ) : null}
                </CardTitle>
                {active ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      value={active.sales_stage}
                      onChange={(e) => void onStageChange(e.target.value)}
                    >
                      {salesStages.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {active.Customer?.stage ? (
                      <p className="text-[10px] text-muted-foreground">
                        CRM：{crmStageLabels[active.Customer.stage] || active.Customer.stage}
                        {active.Customer.stage !== 'deal' && active.sales_stage === 'after_sale'
                          ? ' · 售后视图'
                          : ''}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 p-3">
              <div className="min-h-[240px] flex-1 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
                {msgLoading ? <p className="text-xs text-muted-foreground">消息加载中…</p> : null}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      m.direction === 'customer'
                        ? 'mr-auto border bg-card'
                        : 'ml-auto bg-primary text-primary-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content || `（${m.msg_type}）`}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        m.direction === 'customer' ? 'text-muted-foreground' : 'text-primary-foreground/80',
                      )}
                    >
                      {new Date(m.created_at).toLocaleString()} · {m.direction}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="输入回复…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void onSend()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!activeId || !active?.customer_id}
                  title="转工单"
                  onClick={() => {
                    setTicketTitle('')
                    setTicketDesc('')
                    setTicketType('consultation')
                    setTicketOpen(true)
                  }}
                >
                  <Ticket className="h-4 w-4" />
                </Button>
                <Button type="button" variant="secondary" disabled={!activeId || busy} onClick={() => void onAiDraft()}>
                  <Bot className="h-4 w-4" />
                </Button>
                <Button type="button" disabled={!activeId || busy || !reply.trim()} onClick={() => void onSend()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {activeId ? (
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="flex items-center gap-1 text-sm">
                  <CheckSquare className="h-4 w-4" />
                  跟进任务
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-3">
                <div className="flex gap-2">
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="例如：明天下午电话回访"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" type="button" disabled={!taskTitle.trim()} onClick={() => void onAddTask()}>
                    添加
                  </Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {followups.length === 0 ? (
                    <li className="text-xs text-muted-foreground">暂无待办</li>
                  ) : (
                    followups.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                        <span className="truncate">{f.title}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 text-xs"
                          onClick={() => void completeInboxFollowup(f.id).then(() => loadFollowups(activeId))}
                        >
                          完成
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>转为服务工单</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} placeholder="简要描述问题" />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input px-2 text-sm"
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
              >
                <option value="consultation">咨询</option>
                <option value="complaint">投诉</option>
                <option value="refund">退款</option>
                <option value="warranty">保修</option>
                <option value="exchange">换货</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>详情</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input px-2 py-1 text-sm"
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onCreateTicket()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
