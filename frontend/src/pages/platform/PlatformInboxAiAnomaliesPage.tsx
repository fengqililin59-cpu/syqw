/**
 * @file 平台运营：全站收件箱 AI 自动发送异常租户。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Bot, Download, ShieldAlert } from 'lucide-react'
import { getJson, patchJson } from '@/api/client'
import { downloadCsv } from '@/lib/downloadCsv'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type AnomalyTenant = {
  tenant_id: number
  tenant_name: string
  plan_code: string | null
  plan_name: string | null
  subscription_status: string | null
  auto_send_faq: boolean
  auto_send_pricing: boolean
  qa_failed: number
  qa_pending: number
  auto_sent: number
  skip_count: number
  level: 'warn' | 'critical'
  reasons: { code: string; title: string; detail: string }[]
}

type Res = {
  list: AnomalyTenant[]
  total: number
  days: number
  scanned: number
}

export function PlatformInboxAiAnomaliesPage() {
  const [data, setData] = useState<Res | null>(null)
  const [level, setLevel] = useState<'' | 'critical' | 'warn'>('')
  const [loading, setLoading] = useState(true)
  const [disablingId, setDisablingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ limit: '100', days: '7' })
      if (level) q.set('level', level)
      const res = await getJson<Res>(`/platform/inbox-ai-anomalies?${q}`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => {
    void load()
  }, [load])

  async function disableAutoSend(tenantId: number, name: string) {
    if (!window.confirm(`确认关停「${name}」的 AI 自动发送？`)) return
    setDisablingId(tenantId)
    try {
      await patchJson(`/platform/tenants/${tenantId}/inbox-ai-controls`, {
        inbox_ai_platform_disabled: true,
      })
      await load()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '关停失败')
    } finally {
      setDisablingId(null)
    }
  }

  const criticalCount = data?.list.filter((r) => r.level === 'critical').length ?? 0

  async function exportCsv() {
    setExporting(true)
    try {
      const q = new URLSearchParams({ limit: '500', days: '7' })
      if (level) q.set('level', level)
      const res = await getJson<Res>(`/platform/inbox-ai-anomalies?${q}`)
      const header = [
        '租户ID',
        '企业名',
        '等级',
        '套餐',
        'FAQ自动发',
        '询价自动发',
        '近7日已发',
        '抽检失败',
        '待抽检',
        '护栏跳过',
        '原因',
      ]
      const rows = res.list.map((r) => [
        String(r.tenant_id),
        r.tenant_name,
        r.level === 'critical' ? '严重' : '关注',
        r.plan_name || r.plan_code || '',
        r.auto_send_faq ? '开' : '关',
        r.auto_send_pricing ? '开' : '关',
        String(r.auto_sent),
        String(r.qa_failed),
        String(r.qa_pending),
        String(r.skip_count),
        r.reasons.map((x) => x.title).join('、'),
      ])
      downloadCsv(`inbox-ai-anomalies-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/platform">
            <ArrowLeft className="mr-1 h-4 w-4" />
            运营概览
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">AI 自动发异常租户</h1>
        {data ? (
          <Badge variant="secondary">
            近 {data.days} 日 · {data.total} 家
          </Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        汇总抽检失败、抽检积压、护栏频繁跳过等信号。已平台关停的租户不在此列表。
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={level === '' ? 'default' : 'outline'} onClick={() => setLevel('')}>
          全部
        </Button>
        <Button
          size="sm"
          variant={level === 'critical' ? 'default' : 'outline'}
          className={level !== 'critical' ? 'border-red-300 text-red-900' : ''}
          onClick={() => setLevel('critical')}
        >
          严重 {criticalCount > 0 ? `(${criticalCount})` : ''}
        </Button>
        <Button size="sm" variant={level === 'warn' ? 'default' : 'outline'} onClick={() => setLevel('warn')}>
          关注
        </Button>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={exporting || loading}
          onClick={() => void exportCsv()}
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? '导出中…' : '导出 CSV'}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            异常名单
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : !data?.list.length ? (
            <p className="text-sm text-muted-foreground">近 7 日暂无异常租户。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>企业</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>自动发</TableHead>
                  <TableHead className="text-right">已发</TableHead>
                  <TableHead className="text-right">抽检失败</TableHead>
                  <TableHead className="text-right">待抽检</TableHead>
                  <TableHead className="text-right">跳过</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.list.map((row) => (
                  <TableRow key={row.tenant_id}>
                    <TableCell>
                      <Link
                        to={`/app/platform/tenants/${row.tenant_id}`}
                        className="font-medium hover:underline"
                      >
                        {row.tenant_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        #{row.tenant_id}
                        {row.plan_name ? ` · ${row.plan_name}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      {row.level === 'critical' ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          严重
                        </Badge>
                      ) : (
                        <Badge variant="secondary">关注</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      FAQ {row.auto_send_faq ? '开' : '关'}
                      <br />
                      询价 {row.auto_send_pricing ? '开' : '关'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.auto_sent}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-700">{row.qa_failed}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.qa_pending}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.skip_count}</TableCell>
                    <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                      {row.reasons.map((r) => r.title).join('、')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button asChild size="sm" variant="outline" className="h-7">
                          <Link to={`/app/platform/tenants/${row.tenant_id}`}>详情</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7"
                          disabled={disablingId === row.tenant_id}
                          onClick={() => void disableAutoSend(row.tenant_id, row.tenant_name)}
                        >
                          <ShieldAlert className="mr-1 h-3 w-3" />
                          关停
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
