/**
 * @file 平台方 · 批量导出租户订阅账单 PDF（ZIP）。
 */
import { useState } from 'react'
import dayjs from 'dayjs'
import { FileArchive } from 'lucide-react'
import { downloadTenantStatementsZip } from '@/api/platformBilling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PlatformTenantStatementsExportCard() {
  const [month, setMonth] = useState(dayjs().subtract(1, 'month').format('YYYY-MM'))
  const [scope, setScope] = useState<'paid_in_month' | 'active_paid'>('paid_in_month')
  const [limit, setLimit] = useState('50')
  const [busy, setBusy] = useState(false)

  async function runExport() {
    if (!month) {
      window.alert('请选择账单月份')
      return
    }
    setBusy(true)
    try {
      const meta = await downloadTenantStatementsZip({
        month,
        scope,
        limit: Number(limit) || 50,
      })
      const extra = [
        meta.successCount != null ? `成功 ${meta.successCount} 份` : null,
        meta.failedCount ? `失败 ${meta.failedCount} 份（见 ZIP 内 manifest.csv）` : null,
        meta.truncated ? '部分租户已截断，请分批导出' : null,
      ]
        .filter(Boolean)
        .join('；')
      if (extra) window.alert(`导出完成：${extra}`)
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-violet-200/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileArchive className="h-4 w-4" />
          租户账单批量导出
        </CardTitle>
        <CardDescription>
          按自然月打包各租户订阅账单 PDF（ZIP），含 manifest.csv。需服务端已配置 PDF 中文字体；单次最多
          100 家。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">账单月份</Label>
          <Input
            type="month"
            className="h-9 w-40"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">租户范围</Label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'paid_in_month' | 'active_paid')}
          >
            <option value="paid_in_month">当月有已支付订单</option>
            <option value="active_paid">当前付费订阅中</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">最多导出</Label>
          <Input
            type="number"
            min={1}
            max={100}
            className="h-9 w-20"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <Button type="button" disabled={busy} onClick={() => void runExport()}>
          {busy ? '生成中…' : '下载 ZIP'}
        </Button>
      </CardContent>
    </Card>
  )
}
