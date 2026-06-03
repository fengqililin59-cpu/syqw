/**
 * @file 平台方 · 支付对账 CSV 导出。
 */
import { useState } from 'react'
import dayjs from 'dayjs'
import { Download, Mail } from 'lucide-react'
import { downloadPaymentsReconcile, postMonthlyReconcileEmail } from '@/api/platformBilling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PlatformPaymentReconcileCard() {
  const [from, setFrom] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'))
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'))
  const [status, setStatus] = useState('')
  const [payChannel, setPayChannel] = useState('')
  const [dateField, setDateField] = useState<'created_at' | 'paid_at'>('created_at')
  const [busy, setBusy] = useState(false)
  const [emailMonth, setEmailMonth] = useState(dayjs().subtract(1, 'month').format('YYYY-MM'))

  async function runExport(format: 'csv' | 'xlsx') {
    setBusy(true)
    try {
      await downloadPaymentsReconcile({
        from,
        to,
        status: status || undefined,
        pay_channel: payChannel || undefined,
        date_field: dateField,
        format,
      })
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4" />
          支付对账导出
        </CardTitle>
        <CardDescription>
          导出全站订单为 CSV 或 Excel；可手动将指定自然月对账表邮件发给运营邮箱（与每月 1 日 09:00
          自动任务相同）。单次最多 5000 条。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">开始日期</Label>
          <Input type="date" className="h-9 w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">结束日期</Label>
          <Input type="date" className="h-9 w-36" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">日期依据</Label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={dateField}
            onChange={(e) => setDateField(e.target.value as 'created_at' | 'paid_at')}
          >
            <option value="created_at">创建时间</option>
            <option value="paid_at">支付时间</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">状态</Label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部</option>
            <option value="paid">已支付</option>
            <option value="pending">待确认</option>
            <option value="failed">失败</option>
            <option value="refunded">已退款</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">渠道</Label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={payChannel}
            onChange={(e) => setPayChannel(e.target.value)}
          >
            <option value="">全部</option>
            <option value="wechat">微信</option>
            <option value="alipay">支付宝</option>
            <option value="manual">线下</option>
          </select>
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void runExport('csv')}>
          {busy ? '导出中…' : 'CSV'}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void runExport('xlsx')}>
          Excel
        </Button>
        <div className="ml-auto flex flex-wrap items-end gap-2 border-l pl-3">
          <div className="space-y-1">
            <Label className="text-xs">邮件对账月份</Label>
            <Input
              type="month"
              className="h-9 w-36"
              value={emailMonth}
              onChange={(e) => setEmailMonth(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`确定将 ${emailMonth} 对账 Excel 发送到平台运营邮箱？`)) return
              setBusy(true)
              void postMonthlyReconcileEmail(emailMonth)
                .then((r) => {
                  if (r.skipped) window.alert(`未发送：${r.skipped}`)
                  else window.alert(`已发送 ${r.sent} 封邮件`)
                })
                .catch((e: unknown) => window.alert(e instanceof Error ? e.message : '发送失败'))
                .finally(() => setBusy(false))
            }}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            邮件发送
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
