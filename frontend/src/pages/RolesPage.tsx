import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { canManageStaffUser } from '@/lib/roles'
import type { Role } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PermissionItem = {
  code: string
  name: string
  module: string
}

type RolePayload = {
  name: string
  description?: string | null
  perm_codes: string[]
}

const moduleLabel: Record<string, string> = {
  customer: '客户',
  broadcast: '群发',
  campaign: '活动',
  automation: '自动化',
  ai: 'AI',
  inbox: '收件箱',
  ticket: '工单',
  order: '订单',
  dashboard: '仪表盘',
  settings: '设置',
  channel: '渠道',
  ads: '广告',
}

export function RolesPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canManage = canManageStaffUser(permissions)
  const [roles, setRoles] = useState<Role[]>([])
  const [catalog, setCatalog] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permSet, setPermSet] = useState<Set<string>>(new Set())
  const [grantMsg, setGrantMsg] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const m = new Map<string, PermissionItem[]>()
    for (const p of catalog) {
      const k = p.module || 'other'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return [...m.entries()]
  }, [catalog])

  const load = useCallback(async () => {
    if (!canManage) return
    setLoading(true)
    try {
      const [r, c] = await Promise.all([
        getJson<Role[]>('/roles'),
        getJson<{ permissions: PermissionItem[] }>('/roles/catalog'),
      ])
      setRoles(r)
      setCatalog(c.permissions || [])
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setPermSet(new Set())
    setOpen(true)
  }

  function openEdit(r: Role) {
    setEditing(r)
    setName(r.name)
    setDescription(r.description || '')
    setPermSet(new Set((r.perm_codes || []).map(String)))
    setOpen(true)
  }

  async function onSave() {
    const payload: RolePayload = {
      name: name.trim(),
      description: description.trim() || null,
      perm_codes: [...permSet],
    }
    if (!payload.name) {
      window.alert('请填写角色名')
      return
    }
    if (payload.perm_codes.length === 0) {
      window.alert('请至少选择一个权限')
      return
    }
    if (editing) {
      await putJson(`/roles/${editing.id}`, payload)
    } else {
      await postJson('/roles', payload)
    }
    setOpen(false)
    await load()
  }

  async function onDelete(r: Role) {
    if (!window.confirm(`确定删除角色「${r.name}」？`)) return
    await deleteJson(`/roles/${r.id}`)
    await load()
  }

  async function onGrantAiEmployeePerms() {
    if (
      !window.confirm(
        '将为本租户内「管理员」类角色（系统角色 / 名称含管理员 / 含 settings:manage）合并收件箱、AI 审核、工单与订单权限。相关员工需重新登录后生效。继续？',
      )
    ) {
      return
    }
    setGrantMsg(null)
    try {
      const res = await postJson<{ updated_roles: Role[]; notice?: string }>(
        '/roles/grant-ai-employee-perms',
        {},
      )
      setGrantMsg(res.notice || `已更新 ${res.updated_roles?.length ?? 0} 个角色`)
      await load()
    } catch (e) {
      setGrantMsg(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">角色管理</h1>
          <p className="text-sm text-muted-foreground">按权限点定义角色，用户按 role_id 继承权限。</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void onGrantAiEmployeePerms()}>
              一键开通 AI 员工权限
            </Button>
            <Button onClick={openCreate}>新建角色</Button>
          </div>
        ) : null}
      </div>

      {!canManage ? <p className="text-sm text-destructive">缺少权限：user:manage 或 settings:manage</p> : null}
      {grantMsg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {grantMsg}
        </p>
      ) : null}

      <div className="rounded-md border bg-card p-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无角色</p>
        ) : (
          <ul className="space-y-2">
            {roles.map((r) => (
              <li key={r.id} className="rounded border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.description || '—'}</p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                        编辑
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(r)}>
                        删除
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(r.perm_codes || []).map((p) => (
                    <Badge key={`${r.id}-${p}`} variant="secondary" className="font-mono text-[10px]">
                      {p}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑角色' : '新建角色'}</DialogTitle>
            <DialogDescription>按模块勾选权限点。</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>角色名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              {grouped.map(([module, items]) => (
                <div key={module} className="space-y-1">
                  <p className="text-sm font-semibold">{moduleLabel[module] || module}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {items.map((p) => (
                      <label key={p.code} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={permSet.has(p.code)}
                          onChange={(e) => {
                            setPermSet((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(p.code)
                              else next.delete(p.code)
                              return next
                            })
                          }}
                        />
                        <span>{p.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onSave()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
