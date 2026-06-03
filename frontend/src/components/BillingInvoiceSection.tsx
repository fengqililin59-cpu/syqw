/**
 * @file 租户侧 · 开票申请与记录。
 */
import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getJson, http, postJson, putJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download } from 'lucide-react'

type PaidPayment = {
  id: number
  amount: number
  paid_at?: string | null
  plan?: { name: string } | null
  out_trade_no: string
}

export type InvoiceRow = {
  id: number
  invoice_type: string
  invoice_type_label: string
  title: string
  tax_no: string
  amount: number
  email: string
  status: string
  status_label: string
  admin_remark?: string | null
  created_at: string
  issued_at?: string | null
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500 hover:bg-yellow-500',
  processing: 'bg-blue-600 hover:bg-blue-600',
  issued: 'bg-green-600 hover:bg-green-600',
  rejected: 'bg-red-600 hover:bg-red-600',
}

function fmt(s: string) {
  return dayjs(s).format('YYYY-MM-DD HH:mm')
}

type Props = {
  canManage: boolean
  paidPayments: PaidPayment[]
}

export function BillingInvoiceSection({ canManage, paidPayments }: Props) {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [open, setOpen] = useState(false)
  const [invoiceType, setInvoiceType] = useState<'electronic' | 'vat_normal' | 'vat_special'>('electronic')
  const [title, setTitle] = useState('')
  const [taxNo, setTaxNo] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [mailingAddress, setMailingAddress] = useState('')
  const [remark, setRemark] = useState('')
  const [paymentId, setPaymentId] = useState<string>('')
  const [autoInvoice, setAutoInvoice] = useState(false)

  const load = useCallback(async () => {
    const data = await getJson<{ list: InvoiceRow[] }>('/billing/invoice-requests?page=1&size=20')
    setRows(data.list || [])
  }, [])

  useEffect(() => {
    void load()
    void loadAutoInvoice()
  }, [load])

  async function loadAutoInvoice() {
    try {
      const data = await getJson<{ auto_invoice: boolean }>('/billing/subscription/auto-invoice')
      setAutoInvoice(data.auto_invoice || false)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (paidPayments.length && !paymentId) {
      setPaymentId(String(paidPayments[0].id))
      setAmount(String(paidPayments[0].amount))
    }
  }, [paidPayments, paymentId])

  async function submit() {
    await postJson('/billing/invoice-requests', {
      invoice_type: invoiceType,
      title: title.trim(),
      tax_no: taxNo.trim(),
      email: email.trim(),
      amount: amount ? Number(amount) : undefined,
      mailing_address: mailingAddress.trim() || undefined,
      remark: remark.trim() || undefined,
      payment_record_id: paymentId ? Number(paymentId) : undefined,
    })
    window.alert('开票申请已提交，平台将在 3–5 个工作日内处理')
    setOpen(false)
    await load()
  }

  async function downloadInvoice(invoiceId: number) {
    try {
      const res = await http.get(`/billing/invoice-requests/${invoiceId}/download`, { responseType: 'blob' })
      const blob = new Blob([res.data as BlobPart], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (!w) {
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoiceId}.html`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      window.alert('下载失败，请确认发票已开具')
    }
  }

  async function toggleAutoInvoice() {
    const next = !autoInvoice
    try {
      await putJson('/billing/subscription/auto-invoice', { auto_invoice: next })
      setAutoInvoice(next)
    } catch {
      window.alert('设置失败')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>发票申请</CardTitle>
          <CardDescription>
            已付款订单可申请增值税电子普票 / 普票 / 专票。专票需填写邮寄地址，处理结果将发送至邮箱。
          </CardDescription>
        </div>
        <Button disabled={!canManage || paidPayments.length === 0} onClick={() => setOpen(true)}>
          申请开票
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50/50 px-3 py-2">
          <span className="text-xs font-medium">支付后自动申请电子发票</span>
          <button
            type="button"
            onClick={toggleAutoInvoice}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              autoInvoice ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                autoInvoice ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {paidPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无已支付订单，完成付款后可申请发票。</p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>提交时间</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>抬头</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>备注</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmt(r.created_at)}</TableCell>
                <TableCell>{r.invoice_type_label}</TableCell>
                <TableCell className="max-w-[140px] truncate" title={r.title}>
                  {r.title}
                </TableCell>
                <TableCell>¥{r.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE[r.status] || ''}>{r.status_label}</Badge>
                </TableCell>
                <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                  {r.status === 'rejected' ? r.admin_remark || '—' : r.admin_remark || '—'}
                </TableCell>
                <TableCell>
                  {r.status === 'issued' ? (
                    <Button variant="ghost" size="sm" onClick={() => downloadInvoice(r.id)}>
                      <Download className="mr-1 h-3 w-3" />
                      下载
                    </Button>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  暂无开票记录
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>提交开票申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>关联已付订单</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={paymentId}
                onChange={(e) => {
                  setPaymentId(e.target.value)
                  const p = paidPayments.find((x) => String(x.id) === e.target.value)
                  if (p) setAmount(String(p.amount))
                }}
              >
                {paidPayments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plan?.name || '套餐'} · ¥{p.amount} · {p.out_trade_no.slice(-8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>发票类型</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as typeof invoiceType)}
              >
                <option value="electronic">电子普通发票</option>
                <option value="vat_normal">增值税普通发票（纸质）</option>
                <option value="vat_special">增值税专用发票（纸质）</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>开票抬头</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="公司全称" />
            </div>
            <div className="space-y-1">
              <Label>纳税人识别号</Label>
              <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} placeholder="15–20 位" />
            </div>
            <div className="space-y-1">
              <Label>开票金额（元）</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>接收邮箱</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {invoiceType === 'vat_special' ? (
              <div className="space-y-1">
                <Label>专票邮寄地址</Label>
                <Input value={mailingAddress} onChange={(e) => setMailingAddress(e.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>备注（选填）</Label>
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="开户行、地址电话等" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={!title.trim() || !taxNo.trim() || !email.trim()}
            >
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
