/**
 * @file 用户管理页：员工列表、创建、编辑、禁用、重置密码。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import type { Paginated, Role, UserRow } from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { canManageStaffUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function UsersPage() {
  const navigate = useNavigate()
  const selfId = useAuthStore((s) => s.user?.id)
  const permissions = useAuthStore((s) => s.permissions)
  const canManage = canManageStaffUser(permissions)
  const [list, setList] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [active, setActive] = useState<UserRow | null>(null)

  const [cUsername, setCUsername] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cRealName, setCRealName] = useState('')
  const [cRoleId, setCRoleId] = useState<number | ''>('')

  const [eRealName, setERealName] = useState('')
  const [ePhone, setEPhone] = useState('')
  const [eEmail, setEEmail] = useState('')
  const [eDept, setEDept] = useState('')
  const [eWeworkUserid, setEWeworkUserid] = useState('')
  const [eRoleId, setERoleId] = useState<number | ''>('')
  const [eStatus, setEStatus] = useState<0 | 1>(1)

  const [newPwd, setNewPwd] = useState('')

  const load = useCallback(async () => {
    if (!canManage) return
    setLoading(true)
    try {
      const [u, r] = await Promise.all([
        getJson<Paginated<UserRow>>(`/users?page=${page}&size=20`),
        getJson<Role[]>('/roles'),
      ])
      setList(u.list)
      setTotal(u.total)
      setRoles(r)
    } finally {
      setLoading(false)
    }
  }, [page, canManage])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate() {
    const roleId = typeof cRoleId === 'number' ? cRoleId : Number(cRoleId)
    if (!Number.isFinite(roleId) || roleId < 1) {
      window.alert('请选择角色')
      return
    }
    const username = cUsername.trim()
    if (username.length < 2) {
      window.alert('账号至少 2 个字符')
      return
    }
    if (cPassword.length < 6) {
      window.alert('初始密码至少 6 位')
      return
    }
    try {
      await postJson('/users', {
        username,
        password: cPassword,
        real_name: cRealName.trim() || undefined,
        role_id: roleId,
      })
      setCreateOpen(false)
      setCUsername('')
      setCPassword('')
      setCRealName('')
      setCRoleId('')
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败')
    }
  }

  function openEdit(u: UserRow) {
    setActive(u)
    setERealName(u.real_name || '')
    setEPhone(u.phone || '')
    setEEmail(u.email || '')
    setEDept(u.department || '')
    setEWeworkUserid(u.wework_userid || '')
    setERoleId(u.role_id || '')
    setEStatus(u.status === 0 ? 0 : 1)
    setEditOpen(true)
  }

  async function onSaveEdit() {
    if (!active) return
    const roleId = typeof eRoleId === 'number' ? eRoleId : Number(eRoleId)
    if (!Number.isFinite(roleId) || roleId < 1) {
      window.alert('请选择角色')
      return
    }
    try {
      await putJson(`/users/${active.id}`, {
        real_name: eRealName,
        phone: ePhone,
        email: eEmail,
        department: eDept,
        wework_userid: eWeworkUserid.trim() || null,
        role_id: roleId,
        status: eStatus,
      })
      setEditOpen(false)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    }
  }

  function openPwd(u: UserRow) {
    setActive(u)
    setNewPwd('')
    setPwdOpen(true)
  }

  async function onSavePwd() {
    if (!active) return
    if (newPwd.length < 6) {
      window.alert('新密码至少 6 位')
      return
    }
    try {
      await postJson(`/users/${active.id}/reset-password`, { password: newPwd })
      setPwdOpen(false)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '重置失败')
    }
  }

  async function onDisable(u: UserRow) {
    if (!window.confirm(`确定禁用员工「${u.username}」？`)) return
    await deleteJson(`/users/${u.id}`)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 人 · 当前第 {page} 页</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/app/roles')}>
            角色管理
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={!canManage}>
            新建员工
          </Button>
        </div>
      </div>
      {!canManage ? <p className="text-sm text-destructive">缺少权限：user:manage 或 settings:manage</p> : null}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账号</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>企微 UserID</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>加载中…</TableCell>
              </TableRow>
            ) : (
              list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.real_name || '—'}</TableCell>
                  <TableCell>{u.Role?.name || '—'}</TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs" title={u.wework_userid || undefined}>
                    {u.wework_userid || '—'}
                  </TableCell>
                  <TableCell>
                    {u.status === 1 ? <Badge>在职</Badge> : <Badge variant="secondary">离职</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openPwd(u)}>
                      重置密码
                    </Button>
                    <Button size="sm" variant="destructive" disabled={u.id === selfId} onClick={() => onDisable(u)}>
                      禁用
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          上一页
        </Button>
        <Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
          下一页
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建员工</DialogTitle>
            <DialogDescription>为员工分配登录账号与角色</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>账号</Label>
              <Input value={cUsername} onChange={(e) => setCUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>初始密码</Label>
              <Input type="password" value={cPassword} onChange={(e) => setCPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={cRealName} onChange={(e) => setCRealName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={cRoleId === '' ? '' : String(cRoleId)}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setCRoleId('')
                    return
                  }
                  const n = Number(raw)
                  setCRoleId(Number.isFinite(n) && n > 0 ? n : '')
                }}
              >
                <option value="">请选择</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void onCreate()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑员工</DialogTitle>
            <DialogDescription>修改资料与角色；状态为离职即禁止登录</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={eRealName} onChange={(e) => setERealName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>手机</Label>
              <Input value={ePhone} onChange={(e) => setEPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Input value={eDept} onChange={(e) => setEDept(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>企微成员 UserID（扫码登录绑定）</Label>
              <Input
                value={eWeworkUserid}
                onChange={(e) => setEWeworkUserid(e.target.value)}
                placeholder="与通讯录成员 userid 一致，如 ZhangSan"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                管理员在企微后台「通讯录」查看成员账号；须与本人在企微的 userid 完全一致，扫码后才能登录本系统。
              </p>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={eRoleId === '' ? '' : String(eRoleId)}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setERoleId('')
                    return
                  }
                  const n = Number(raw)
                  setERoleId(Number.isFinite(n) && n > 0 ? n : '')
                }}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={String(eStatus)}
                onChange={(e) => setEStatus(Number(e.target.value) as 0 | 1)}
              >
                <option value="1">在职</option>
                <option value="0">离职</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void onSaveEdit()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>为员工「{active?.username}」设置新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>新密码</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void onSavePwd()}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
