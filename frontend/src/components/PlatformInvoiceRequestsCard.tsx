/**
 * @file 平台方 · 开票申请处理。
 */
import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getJson, patchJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type InvoiceRow = {
  id: number
  tenant?: { name: string } | null
  tenant_id: number
  invoice_type_label: string
  title: string
  tax_no: string
  amount: number
  email: string
  mailing_address?: string | null
  remark?: string | null
  status: string
  status_label: string
  admin_remark?: string | null
  created_at: string
  payment?: { out_trade_no: string; plan_name?: string } | null
}

function fmt(s: string) {
  return dayjs(s).format('MM-DD HH:mm')
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500 hover:bg-yellow-500',
  processing: 'bg-blue-600 hover:bg-blue-600',
  issued: 'bg-green-600 hover:bg-green-600',
  rejected: 'bg-red-600 hover:bg-red-600',
}

export function PlatformInvoiceRequestsCard() {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing'>('pending')
  const [adminRemarks, setAdminRemarks] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    const q =
      filter === 'all' ? '' : `&status=${filter}`
    const data = await getJson<{ list: InvoiceRow[] }>(
      `/platform/invoice-requests?page=1&size=50${q}`,
    )
    setRows(data.list || [])
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(id: number, status: 'processing' | 'issued' | 'rejected') {
    const admin_remark = adminRemarks[id]?.trim() || undefined
    if (status === 'rejected' && !admin_remark) {
      window.alert('驳回时请填写处理备注（将通知租户）')
      return
    }
    await patchJson(`/platform/invoice-requests/${id}`, { status, admin_remark })
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>开票申请</CardTitle>
        <CardDescription>
          租户在计费页提交；标记「已开票」或「驳回」后，若已配置 SMTP 将向租户邮箱发送通知。
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          {(['pending', 'processing', 'all'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'pending' ? '待处理' : f === 'processing' ? '处理中' : '全部'}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>租户</TableHead>
              <TableHead>类型 / 金额</TableHead>
              <TableHead>抬头 / 税号</TableHead>
              <TableHead>联系</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{fmt(r.created_at)}</TableCell>
                <TableCell>{r.tenant?.name || r.tenant_id}</TableCell>
                <TableCell className="text-xs">
                  <div>{r.invoice_type_label}</div>
                  <div>¥{r.amount.toFixed(2)}</div>
                  {r.payment?.out_trade_no ? (
                    <div className="text-muted-foreground">单号 …{r.payment.out_trade_no.slice(-8)}</div>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[140px] text-xs">
                  <div className="truncate font-medium" title={r.title}>
                    {r.title}
                  </div>
                  <div className="text-muted-foreground">{r.tax_no}</div>
                  {r.remark ? <div className="text-muted-foreground">{r.remark}</div> : null}
                </TableCell>
                <TableCell className="text-xs">
                  <div>{r.email}</div>
                  {r.mailing_address ? <div className="text-muted-foreground">{r.mailing_address}</div> : null}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE[r.status] || ''}>{r.status_label}</Badge>
                </TableCell>
                <TableCell className="min-w-[200px] space-y-1">
                  {r.status === 'pending' || r.status === 'processing' ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">处理备注</Label>
                        <Input
                          className="h-8 text-xs"
                          placeholder="驳回原因 / 开票说明"
                          value={adminRemarks[r.id] ?? r.admin_remark ?? ''}
                          onChange={(e) =>
                            setAdminRemarks((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.status === 'pending' ? (
                          <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, 'processing')}>
                            处理中
                          </Button>
                        ) : null}
                        <Button size="sm" onClick={() => void setStatus(r.id, 'issued')}>
                          已开票
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void setStatus(r.id, 'rejected')}>
                          驳回
                        </Button>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{r.admin_remark || '—'}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  暂无记录
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
