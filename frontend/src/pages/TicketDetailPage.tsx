/**
 * @file 工单详情：状态流转、结案、关联客户/会话。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchTicket, resolveTicket, updateTicket } from '@/api/tickets'
import type { ServiceTicketRow } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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

const priorityLabel: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

export function TicketDetailPage() {
  const { id } = useParams()
  const ticketId = Number(id)
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<ServiceTicketRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resolution, setResolution] = useState('')

  const load = useCallback(async () => {
    if (!Number.isFinite(ticketId) || ticketId < 1) {
      setErr('无效工单 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const row = await fetchTicket(ticketId)
      setTicket(row)
      setResolution(row.resolution || '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    void load()
  }, [load])

  async function onSave(patch: Parameters<typeof updateTicket>[1]) {
    if (!ticket) return
    setSaving(true)
    try {
      const row = await updateTicket(ticket.id, patch)
      setTicket(row)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function onResolve() {
    if (!ticket) return
    setSaving(true)
    try {
      const row = await resolveTicket(ticket.id, resolution.trim() || '已处理')
      setTicket(row)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '结案失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (!ticket) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/service-desk')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回服务台
        </Button>
        <p className="text-sm text-destructive">{err || '工单不存在'}</p>
      </div>
    )
  }

  const customerName =
    ticket.Customer?.name || ticket.Customer?.nickname || ticket.Customer?.phone || `#${ticket.customer_id}`

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/service-desk">
            <ArrowLeft className="mr-1 h-4 w-4" />
            服务台
          </Link>
        </Button>
        <Badge variant="outline">{ticketStatusLabel[ticket.status] ?? ticket.status}</Badge>
        <Badge variant="secondary">{typeLabel[ticket.type] ?? ticket.type}</Badge>
        <Badge>{priorityLabel[ticket.priority] ?? ticket.priority}</Badge>
        {ticket.sla_status === 'overdue' || ticket.sla_status === 'escalated' ? (
          <Badge variant="destructive">
            {ticket.sla_status === 'escalated' ? 'SLA 已升级' : `SLA 逾期 ${ticket.sla_overdue_minutes ?? ''} 分`}
          </Badge>
        ) : ticket.due_at && ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
          <Badge variant="outline">
            截止 {new Date(ticket.due_at).toLocaleString('zh-CN', { hour12: false })}
          </Badge>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
        <p className="text-sm text-muted-foreground">
          工单 #{ticket.id} · 创建于{' '}
          {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">关联信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            客户：
            <Link to={`/app/customers/${ticket.customer_id}`} className="ml-1 text-primary underline">
              {customerName}
            </Link>
            {ticket.Customer?.stage ? (
              <span className="ml-2 text-muted-foreground">阶段 {ticket.Customer.stage}</span>
            ) : null}
          </p>
          {ticket.owner ? (
            <p>
              负责人：{ticket.owner.real_name || ticket.owner.username}
            </p>
          ) : null}
          {ticket.due_at && ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
            <p>
              SLA 截止：{new Date(ticket.due_at).toLocaleString('zh-CN', { hour12: false })}
              {ticket.sla_minutes ? (
                <span className="ml-2 text-muted-foreground">（时限 {ticket.sla_minutes} 分钟）</span>
              ) : null}
            </p>
          ) : null}
          {ticket.first_response_at ? (
            <p>首次响应：{new Date(ticket.first_response_at).toLocaleString('zh-CN', { hour12: false })}</p>
          ) : null}
          {ticket.sla_escalated_at ? (
            <p className="text-red-600">
              已升级通知管理员：{new Date(ticket.sla_escalated_at).toLocaleString('zh-CN', { hour12: false })}
            </p>
          ) : null}
          {ticket.thread_id ? (
            <p>
              来源会话：
              <Link
                to={`/app/inbox?customer_id=${ticket.customer_id}`}
                className="ml-1 text-primary underline"
              >
                打开收件箱
              </Link>
            </p>
          ) : null}
          {ticket.CustomerOrder ? (
            <p>
              关联订单：{ticket.CustomerOrder.order_no || `#${ticket.CustomerOrder.id}`} · ¥
              {Number(ticket.CustomerOrder.amount).toFixed(2)} · {ticket.CustomerOrder.status}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">问题描述</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ticket.description || '（无描述）'}</p>
        </CardContent>
      </Card>

      {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">处理</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>状态</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input px-2 text-sm"
                  value={ticket.status}
                  onChange={(e) => void onSave({ status: e.target.value })}
                  disabled={saving}
                >
                  <option value="open">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="waiting_customer">待客户</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input px-2 text-sm"
                  value={ticket.priority}
                  onChange={(e) => void onSave({ priority: e.target.value })}
                  disabled={saving}
                >
                  {Object.entries(priorityLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>结案说明</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="处理结果、退款说明等…"
                rows={4}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {ticket.status === 'open' ? (
                <Button variant="outline" disabled={saving} onClick={() => void onSave({ status: 'in_progress' })}>
                  接手处理
                </Button>
              ) : null}
              <Button disabled={saving} onClick={() => void onResolve()}>
                结案
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">结案记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{ticket.resolution || '—'}</p>
            {ticket.resolved_at ? (
              <p className="text-muted-foreground">
                结案时间：{new Date(ticket.resolved_at).toLocaleString()}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">编辑标题</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            defaultValue={ticket.title}
            id="ticket-title-edit"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== ticket.title) void onSave({ title: v })
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
