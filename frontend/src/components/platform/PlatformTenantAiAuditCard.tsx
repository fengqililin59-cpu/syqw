/**
 * @file 平台租户详情 · 收件箱 AI 审计记录（近 N 日）。
 */
import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  fetchTenantInboxAiAuditLogs,
  INBOX_AI_AUDIT_ACTION_LABELS,
} from '@/api/platformAdmin'
import type { AuditLogItem } from '@/api/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function renderDetail(detail: Record<string, unknown> | null) {
  if (!detail) return '—'
  try {
    const s = JSON.stringify(detail)
    return s.length > 80 ? `${s.slice(0, 77)}…` : s
  } catch {
    return '—'
  }
}

function actorLabel(row: AuditLogItem) {
  if (!row.actor_user_id) return '系统'
  return row.actor?.real_name || row.actor?.username || `#${row.actor_user_id}`
}

export function PlatformTenantAiAuditCard({ tenantId }: { tenantId: number }) {
  const [rows, setRows] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchTenantInboxAiAuditLogs(tenantId, { page: 1, size: 25, days: 14 })
      setRows(res.list)
      setTotal(res.total)
      setDays(res.days)
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          AI 自动发审计
          {total > 0 ? (
            <Badge variant="secondary">
              近 {days} 日 {total} 条
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>自动发送、护栏跳过、抽检与平台关停/恢复留痕。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            刷新
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">近 {days} 日暂无 AI 相关审计记录。</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {INBOX_AI_AUDIT_ACTION_LABELS[row.action] || row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{actorLabel(row)}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                      {renderDetail(row.detail_json)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {total > rows.length ? (
          <p className="text-xs text-muted-foreground">仅展示最近 {rows.length} 条，共 {total} 条。</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
