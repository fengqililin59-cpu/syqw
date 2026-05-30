/**
 * @file 客户转移：离职继承 / 重新分配，异步企微转接 + 本地负责人更新。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2, Users } from 'lucide-react'
import {
  createTransfer,
  getTransfer,
  getUserCustomerCount,
  listTransfers,
  type TransferDetailItem,
  type TransferRow,
} from '@/api/transfers'
import { getJson } from '@/api/client'
import type { Paginated } from '@/api/types'
import type { UserRow } from '@/api/types'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const reasonLabel: Record<string, string> = {
  resigned: '离职继承',
  reassign: '重新分配',
}

const statusLabel: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  done: '已完成',
  partial: '部分成功',
  failed: '失败',
}

function statusBadgeClass(status: string) {
  if (status === 'done') return 'bg-emerald-600 hover:bg-emerald-600'
  if (status === 'partial') return 'bg-amber-500 hover:bg-amber-500'
  if (status === 'failed') return 'bg-destructive hover:bg-destructive'
  if (status === 'processing') return 'bg-blue-600 hover:bg-blue-600'
  return 'bg-muted text-muted-foreground hover:bg-muted'
}

function userLabel(u: TransferRow['from_user']) {
  if (!u) return '—'
  return u.real_name?.trim() || u.username
}

export function TransferPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canManage = hasPermUser(permissions, 'user:manage')

  const [data, setData] = useState<Paginated<TransferRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState<'resigned' | 'reassign'>('resigned')
  const [fromId, setFromId] = useState<string>('')
  const [toId, setToId] = useState<string>('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<TransferRow | null>(null)
  const [failuresOnly, setFailuresOnly] = useState<TransferDetailItem[]>([])

  const dataRef = useRef(data)
  dataRef.current = data

  const loadTransfers = useCallback(async () => {
    if (!canManage) return
    setErr(null)
    try {
      const res = await listTransfers({ page: 1, size: 50 })
      setData(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void loadTransfers()
  }, [loadTransfers])

  useEffect(() => {
    if (!canManage) return
    const id = window.setInterval(() => {
      const list = dataRef.current?.list ?? []
      if (!list.some((t) => t.status === 'pending' || t.status === 'processing')) return
      void listTransfers({ page: 1, size: 50 })
        .then(setData)
        .catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [canManage])

  const loadUsers = useCallback(async () => {
    if (!canManage) return
    try {
      const res = await getJson<Paginated<UserRow>>('/users?page=1&size=200')
      setUsers(res.list)
    } catch {
      setUsers([])
    }
  }, [canManage])

  useEffect(() => {
    if (dialogOpen) void loadUsers()
  }, [dialogOpen, loadUsers])

  useEffect(() => {
    if (!fromId) {
      setExpectedTotal(null)
      return
    }
    const id = Number(fromId)
    if (!Number.isFinite(id)) {
      setExpectedTotal(null)
      return
    }
    let cancelled = false
    void getUserCustomerCount(id)
      .then((r) => {
        if (!cancelled) setExpectedTotal(r.customer_count)
      })
      .catch(() => {
        if (!cancelled) setExpectedTotal(null)
      })
    return () => {
      cancelled = true
    }
  }, [fromId])

  async function onSubmitTransfer() {
    const f = Number(fromId)
    const t = Number(toId)
    if (!f || !t) {
      window.alert('请选择转出与接收销售')
      return
    }
    if (f === t) {
      window.alert('转出与接收不能为同一人')
      return
    }
    setSubmitting(true)
    try {
      await createTransfer({ from_user_id: f, to_user_id: t, reason })
      setDialogOpen(false)
      setFromId('')
      setToId('')
      setReason('resigned')
      setExpectedTotal(null)
      await loadTransfers()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function openDetail(row: TransferRow) {
    try {
      const fresh = await getTransfer(row.id)
      setDetailRow(fresh)
      const details = Array.isArray(fresh.detail_json) ? fresh.detail_json : []
      setFailuresOnly(details.filter((d) => d.status !== 'ok'))
      setDetailOpen(true)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '加载详情失败')
    }
  }

  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户转移</h1>
          <p className="text-sm text-muted-foreground">
            将转出销售名下已绑定企微的客户批量转给接收销售，并同步调用企业微信客户继承接口。
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            发起客户转移
          </Button>
        ) : null}
      </div>

      {!canManage ? <p className="text-sm text-destructive">缺少权限：user:manage</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>转移记录</CardTitle>
          <CardDescription>进行中任务每 3 秒自动刷新状态</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
          {!loading && rows.length === 0 ? <p className="text-sm text-muted-foreground">暂无记录</p> : null}
          {rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发起时间</TableHead>
                  <TableHead>转出 → 接收</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>客户数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {userLabel(r.from_user)}
                        <ArrowRight className="mx-1 inline h-3 w-3 align-middle" />
                        {userLabel(r.to_user)}
                      </span>
                    </TableCell>
                    <TableCell>{reasonLabel[r.reason] || r.reason}</TableCell>
                    <TableCell className="text-sm">
                      总 {r.total_count} / 成 {r.success_count} / 败 {r.failed_count}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn('gap-1', statusBadgeClass(r.status))}
                        variant={r.status === 'pending' ? 'secondary' : 'default'}
                      >
                        {(r.status === 'pending' || r.status === 'processing') && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {statusLabel[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => void openDetail(r)}>
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发起客户转移</DialogTitle>
            <DialogDescription>仅转移有 external_userid 的客户；无企微 ID 的客户不会进入批次。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">转移原因</Label>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="treason" checked={reason === 'resigned'} onChange={() => setReason('resigned')} />
                  离职继承（resigned/transfer_customer）
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="treason" checked={reason === 'reassign'} onChange={() => setReason('reassign')} />
                  重新分配（transfer_customer）
                </label>
              </div>
            </div>
            <div>
              <Label>转出销售</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
              >
                <option value="">请选择</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.real_name || u.username} (#{u.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>接收销售</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                <option value="">请选择</option>
                {users
                  .filter((u) => String(u.id) !== fromId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.real_name || u.username} (#{u.id})
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-sm text-muted-foreground">
              预计转移客户数（名下全部客户，含无企微 ID）：
              <span className="font-medium text-foreground"> {expectedTotal != null ? expectedTotal : '—'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              实际执行以有企微 external_userid 的客户为准，与上表数字可能不一致。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onSubmitTransfer()} disabled={submitting}>
              {submitting ? '提交中…' : '确认转移'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>转移详情 #{detailRow?.id}</DialogTitle>
            <DialogDescription>
              {detailRow ? (
                <>
                  成功 {detailRow.success_count} 人，失败 {detailRow.failed_count} 人。以下仅列出失败条目。
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {failuresOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground">无失败记录</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {failuresOnly.map((d, i) => (
                <li key={i} className="rounded border p-2 font-mono text-xs">
                  <div>external_userid: {d.external_userid || '—'}</div>
                  <div className="text-destructive">{d.errmsg || d.status}</div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
