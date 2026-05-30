import { useMemo, useState } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { http, getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'
import { permListFromMeResponse, type MePermissionsResponse } from '@/lib/permApi'

type ProbeCase = {
  id: string
  name: string
  method: 'GET'
  path: string
  /** 与后端单权限码一致（optional 二选一） */
  requiredPerm?: string
  /** 满足任一即可（optional） */
  requiredAny?: string[]
}

type ProbeResult = {
  status: number | null
  expected: number
  ok: boolean
  message: string
}

const CASES: ProbeCase[] = [
  {
    id: 'users-list',
    name: '用户列表',
    method: 'GET',
    path: '/users?page=1&page_size=1',
    requiredAny: ['user:manage', 'settings:manage'],
  },
  { id: 'audit-logs', name: '审计日志', method: 'GET', path: '/settings/audit-logs?page=1&page_size=1', requiredPerm: 'audit:view' },
  { id: 'customers-list', name: '客户列表', method: 'GET', path: '/customers?page=1&page_size=1', requiredPerm: 'customer:view' },
  { id: 'followups-list', name: '跟进列表', method: 'GET', path: '/follow-ups?page=1&page_size=1', requiredPerm: 'customer:view' },
  { id: 'broadcast-list', name: '群发列表', method: 'GET', path: '/broadcast-tasks?page=1&page_size=1', requiredPerm: 'broadcast:view' },
  { id: 'campaign-list', name: '活动列表', method: 'GET', path: '/campaigns?page=1&page_size=1', requiredPerm: 'campaign:view' },
  { id: 'automation-rules', name: '自动化规则', method: 'GET', path: '/automation/rules', requiredPerm: 'automation:view' },
  { id: 'flows-meta', name: '流程元数据', method: 'GET', path: '/flows/meta', requiredPerm: 'automation:view' },
  { id: 'dashboard-overview', name: '仪表盘总览', method: 'GET', path: '/dashboard/overview', requiredPerm: 'dashboard:view' },
  {
    id: 'ads-roi',
    name: '广告ROI',
    method: 'GET',
    path: '/ads/roi?start_date=2026-05-01&end_date=2026-05-06',
    requiredAny: ['ads:view', 'dashboard:view'],
  },
]

function expectedHttpForProbe(perms: string[], c: ProbeCase): number {
  if (c.requiredAny?.length) {
    return c.requiredAny.some((x) => hasPermUser(perms, x)) ? 200 : 403
  }
  return hasPermUser(perms, c.requiredPerm || '') ? 200 : 403
}

function probePermLabel(c: ProbeCase): string {
  if (c.requiredAny?.length) return c.requiredAny.join(' 或 ')
  return c.requiredPerm || ''
}

export function PermissionCheckPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const setPermissions = useAuthStore((s) => s.setPermissions)
  const [running, setRunning] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [results, setResults] = useState<Record<string, ProbeResult>>({})
  const [error, setError] = useState<string>('')

  const sortedPerms = useMemo(() => [...(permissions || [])].sort(), [permissions])

  async function refreshFromServer() {
    setRefreshing(true)
    setError('')
    try {
      const data = await getJson<MePermissionsResponse>('/auth/me/permissions')
      setPermissions(permListFromMeResponse(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : '刷新权限失败')
    } finally {
      setRefreshing(false)
    }
  }

  async function runAll() {
    setRunning(true)
    setError('')
    setResults({})
    try {
      const permsNow = useAuthStore.getState().permissions
      const entries = await Promise.all(
        CASES.map(async (c) => {
          const expected = expectedHttpForProbe(permsNow, c)
          try {
            const res = await http.request({
              method: c.method,
              url: c.path,
              validateStatus: () => true,
            })
            const status = res.status
            return [
              c.id,
              {
                status,
                expected,
                ok: status === expected,
                message: status === expected ? '符合预期' : '与预期不一致',
              } satisfies ProbeResult,
            ] as const
          } catch (e) {
            const message = axios.isAxiosError(e) ? e.message : '请求失败'
            return [
              c.id,
              {
                status: null,
                expected,
                ok: false,
                message,
              } satisfies ProbeResult,
            ] as const
          }
        }),
      )
      const next: Record<string, ProbeResult> = {}
      for (const [id, r] of entries) {
        next[id] = r
      }
      setResults(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '执行失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">权限自检</h1>
        <p className="text-sm text-muted-foreground">
          用于快速核验当前账号权限集合与后端接口权限守卫是否一致。若刚改过角色权限，可先点「从服务端刷新权限」再探测。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refreshFromServer} disabled={refreshing || running}>
            {refreshing ? '刷新中…' : '从服务端刷新权限'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>当前权限集合</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedPerms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              当前账号没有权限码。请尝试「从服务端刷新权限」，或检查角色是否已分配权限。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedPerms.map((p) => (
                <Badge key={p} variant="secondary">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>接口探测</CardTitle>
          <Button onClick={runAll} disabled={running}>
            {running ? '探测中...' : '一键探测'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>接口</TableHead>
                <TableHead>所需权限</TableHead>
                <TableHead>预期</TableHead>
                <TableHead>实际</TableHead>
                <TableHead>结果</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CASES.map((c) => {
                const expected = expectedHttpForProbe(permissions, c)
                const row = results[c.id]
                const statusText = row?.status === null ? '--' : String(row?.status ?? '--')
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.method} {c.path}
                      </div>
                    </TableCell>
                    <TableCell>{probePermLabel(c)}</TableCell>
                    <TableCell>{expected}</TableCell>
                    <TableCell>{statusText}</TableCell>
                    <TableCell>
                      {row ? (
                        <Badge variant={row.ok ? 'default' : 'destructive'}>{row.ok ? 'PASS' : 'FAIL'}</Badge>
                      ) : (
                        <Badge variant="secondary">待探测</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                      {row?.message ?? '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
