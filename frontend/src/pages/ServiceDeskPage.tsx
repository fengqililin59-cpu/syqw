/**
 * @file 服务台：工单 + 订单。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createOrder,
  createTicket,
  fetchOrder,
  fetchOrders,
  fetchTickets,
  resolveTicket,
  updateOrder,
  updateTicket,
} from '@/api/tickets'
import type { CustomerOrderRow, Paginated, ServiceTicketRow } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CustomerPicker } from '@/components/CustomerPicker'

type Tab = 'tickets' | 'orders'

const ticketStatusLabel: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  waiting_customer: '待客户',
  resolved: '已解决',
  closed: '已关闭',
}

const typeLabel: Record<string, string> = {
  consultation: '咨询',
  refund: '退款',
  complaint: '投诉',
  warranty: '保修',
  exchange: '换货',
}

const orderStatusLabel: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}

const priorityLabel: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

function slaBadge(row: ServiceTicketRow) {
  const status = row.sla_status
  if (!status || status === 'none' || status === 'closed') return null
  if (status === 'escalated') {
    return (
      <Badge variant="destructive" className="ml-1">
        已升级
      </Badge>
    )
  }
  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className="ml-1">
        逾期{row.sla_overdue_minutes != null ? ` ${row.sla_overdue_minutes}分` : ''}
      </Badge>
    )
  }
  if (status === 'due_soon') {
    return (
      <Badge variant="secondary" className="ml-1">
        即将到期
      </Badge>
    )
  }
  if (row.due_at) {
    return (
      <Badge variant="outline" className="ml-1 text-xs font-normal">
        SLA {new Date(row.due_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </Badge>
    )
  }
  return null
}

export function ServiceDeskPage() {
  const [searchParams] = useSearchParams()
  const filterCustomerId = searchParams.get('customer_id')
  const initialSla = searchParams.get('sla') === 'overdue' ? 'overdue' : ''
  const [tab, setTab] = useState<Tab>('tickets')
  const [tickets, setTickets] = useState<Paginated<ServiceTicketRow> | null>(null)
  const [orders, setOrders] = useState<Paginated<CustomerOrderRow> | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [slaFilter, setSlaFilter] = useState(initialSla)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState('consultation')
  const [formAmount, setFormAmount] = useState('')

  const [orderEditOpen, setOrderEditOpen] = useState(false)
  const [orderEditId, setOrderEditId] = useState<number | null>(null)
  const [orderEditAmount, setOrderEditAmount] = useState('')
  const [orderEditStatus, setOrderEditStatus] = useState('paid')
  const [orderEditNo, setOrderEditNo] = useState('')
  const [orderEditRemark, setOrderEditRemark] = useState('')

  useEffect(() => {
    if (searchParams.get('sla') === 'overdue') setSlaFilter('overdue')
  }, [searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'tickets') {
        const t = await fetchTickets({
          page: 1,
          size: 50,
          status: statusFilter || undefined,
          sla: slaFilter || undefined,
          customer_id: filterCustomerId ? Number(filterCustomerId) : undefined,
        })
        setTickets(t)
      } else {
        const o = await fetchOrders({
          page: 1,
          size: 50,
          status: statusFilter || undefined,
          customer_id: filterCustomerId ? Number(filterCustomerId) : undefined,
        })
        setOrders(o)
      }
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, slaFilter, filterCustomerId])

  useEffect(() => {
    void load()
  }, [load])

  function openCreateDialog() {
    const preset = filterCustomerId ? Number(filterCustomerId) : null
    setSelectedCustomerId(Number.isFinite(preset) && preset! > 0 ? preset : null)
    setDialogOpen(true)
  }

  async function onCreate() {
    const cid = selectedCustomerId
    if (!cid || cid < 1) {
      window.alert('请选择客户')
      return
    }
    setSaving(true)
    try {
      if (tab === 'tickets') {
        if (!formTitle.trim()) {
          window.alert('请填写工单标题')
          return
        }
        await createTicket({
          customer_id: cid,
          title: formTitle.trim(),
          description: formDesc.trim() || undefined,
          type: formType,
        })
      } else {
        const amt = Number(formAmount)
        if (!Number.isFinite(amt) || amt < 0) {
          window.alert('请填写有效金额')
          return
        }
        await createOrder({
          customer_id: cid,
          amount: amt,
          status: 'paid',
        })
      }
      setDialogOpen(false)
      setSelectedCustomerId(null)
      setFormTitle('')
      setFormDesc('')
      setFormAmount('')
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function onResolve(id: number) {
    const text = window.prompt('结案说明（可选）') || '已处理'
    await resolveTicket(id, text)
    await load()
  }

  async function onStart(id: number) {
    await updateTicket(id, { status: 'in_progress' })
    await load()
  }

  async function openOrderEdit(id: number) {
    setOrderEditId(id)
    setOrderEditOpen(true)
    try {
      const row = await fetchOrder(id)
      setOrderEditAmount(String(row.amount ?? ''))
      setOrderEditStatus(row.status || 'paid')
      setOrderEditNo(row.order_no || '')
      setOrderEditRemark(row.remark || '')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '加载订单失败')
      setOrderEditOpen(false)
    }
  }

  async function onSaveOrderEdit() {
    if (!orderEditId) return
    const amt = Number(orderEditAmount)
    if (!Number.isFinite(amt) || amt < 0) {
      window.alert('请填写有效金额')
      return
    }
    setSaving(true)
    try {
      await updateOrder(orderEditId, {
        amount: amt,
        status: orderEditStatus,
        order_no: orderEditNo.trim() || null,
        remark: orderEditRemark.trim() || null,
      })
      setOrderEditOpen(false)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">服务台</h1>
          <p className="text-sm text-muted-foreground">售后工单与成交订单，可与收件箱、客户详情联动。</p>
          {filterCustomerId ? (
            <p className="text-xs text-muted-foreground">
              筛选客户 ID：{filterCustomerId}
              <Link to="/app/service-desk" className="ml-2 text-primary underline">
                清除
              </Link>
            </p>
          ) : null}
          {slaFilter === 'overdue' ? (
            <p className="text-xs text-red-600">
              当前仅显示 SLA 逾期工单
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setSlaFilter('')}
              >
                清除
              </button>
            </p>
          ) : null}
        </div>
        <Button onClick={openCreateDialog}>新建{tab === 'tickets' ? '工单' : '订单'}</Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 text-sm',
            tab === 'tickets' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
          onClick={() => {
            setTab('tickets')
            setStatusFilter('')
            setSlaFilter('')
          }}
        >
          工单
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 text-sm',
            tab === 'orders' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
          onClick={() => {
            setTab('orders')
            setStatusFilter('')
          }}
        >
          订单
        </button>
        <select
          className="ml-auto h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={slaFilter === 'overdue' ? '__sla_overdue' : statusFilter}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__sla_overdue') {
              setSlaFilter('overdue')
              setStatusFilter('')
            } else {
              setSlaFilter('')
              setStatusFilter(v)
            }
          }}
        >
          <option value="">全部状态</option>
          {tab === 'tickets' ? (
            <>
              <option value="open">待处理</option>
              <option value="in_progress">处理中</option>
              <option value="resolved">已解决</option>
              <option value="__sla_overdue">SLA 逾期</option>
            </>
          ) : (
            <>
              <option value="paid">已付款</option>
              <option value="completed">已完成</option>
              <option value="pending">待付款</option>
            </>
          )}
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {tab === 'tickets' ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>优先级</TableHead>
                <TableHead>状态 / SLA</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tickets?.list.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    暂无工单
                  </TableCell>
                </TableRow>
              ) : (
                tickets?.list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link to={`/app/service-desk/tickets/${row.id}`} className="text-primary underline">
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.Customer?.name || row.Customer?.nickname || (
                        <Link to={`/app/customers/${row.customer_id}`} className="text-primary underline">
                          #{row.customer_id}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{typeLabel[row.type] ?? row.type}</TableCell>
                    <TableCell>{priorityLabel[row.priority] ?? row.priority}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticketStatusLabel[row.status] ?? row.status}</Badge>
                      {slaBadge(row)}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {row.status !== 'resolved' && row.status !== 'closed' ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/app/service-desk/tickets/${row.id}`}>详情</Link>
                        </Button>
                      ) : null}
                      {row.status === 'open' ? (
                        <Button size="sm" variant="ghost" onClick={() => void onStart(row.id)}>
                          接手
                        </Button>
                      ) : null}
                      {row.status !== 'resolved' && row.status !== 'closed' ? (
                        <Button size="sm" variant="ghost" onClick={() => void onResolve(row.id)}>
                          结案
                        </Button>
                      ) : null}
                      {row.thread_id ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/app/inbox?customer_id=${row.customer_id}`}>会话</Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户</TableHead>
                <TableHead>订单号</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders?.list.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    暂无订单
                  </TableCell>
                </TableRow>
              ) : (
                orders?.list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.Customer?.name || (
                        <Link to={`/app/customers/${row.customer_id}`} className="text-primary underline">
                          #{row.customer_id}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{row.order_no || '—'}</TableCell>
                    <TableCell className="font-medium">¥{Number(row.amount).toFixed(2)}</TableCell>
                    <TableCell>{orderStatusLabel[row.status] ?? row.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => void openOrderEdit(row.id)}>
                        编辑
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/app/customers/${row.customer_id}`}>客户</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedCustomerId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建{tab === 'tickets' ? '工单' : '订单'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CustomerPicker
              value={selectedCustomerId}
              onChange={(id) => setSelectedCustomerId(id)}
            />
            {tab === 'tickets' ? (
              <>
                <div className="space-y-2">
                  <Label>标题</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>类型</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input px-2 text-sm"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    {Object.entries(typeLabel).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <textarea
                    className="min-h-[80px] w-full rounded-md border border-input px-2 py-1 text-sm"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>成交金额（元）</Label>
                <Input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} type="number" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void onCreate()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderEditOpen} onOpenChange={setOrderEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑订单 #{orderEditId ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>订单号</Label>
              <Input value={orderEditNo} onChange={(e) => setOrderEditNo(e.target.value)} placeholder="可选" />
            </div>
            <div className="space-y-2">
              <Label>金额（元）</Label>
              <Input
                type="number"
                value={orderEditAmount}
                onChange={(e) => setOrderEditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input px-2 text-sm"
                value={orderEditStatus}
                onChange={(e) => setOrderEditStatus(e.target.value)}
              >
                {Object.entries(orderStatusLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input px-2 py-1 text-sm"
                value={orderEditRemark}
                onChange={(e) => setOrderEditRemark(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              状态改为已付款/已完成/已发货时，客户将自动推进到「成交」并同步收件箱阶段。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderEditOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void onSaveOrderEdit()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
