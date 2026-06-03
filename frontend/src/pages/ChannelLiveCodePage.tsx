/**
 * @file 渠道活码 Phase1：活码列表、分组管理、统计占位；员工活码创建走企微「联系我」。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  createChannelGroup,
  createEmployeeChannel,
  deleteChannel as apiDeleteChannel,
  deleteChannelGroup,
  fetchChannelGroups,
  fetchChannels,
  updateChannelGroup,
} from '@/api/channelLive'
import type { WeworkChannelGroupRow, WeworkChannelRow } from '@/api/types'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LayoutGrid, FolderTree, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'codes' | 'groups' | 'stats'

export function ChannelLiveCodePage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canManage = hasPermUser(permissions, 'channel:manage')

  const [tab, setTab] = useState<TabId>('codes')
  const [groups, setGroups] = useState<WeworkChannelGroupRow[]>([])
  const [channels, setChannels] = useState<WeworkChannelRow[]>([])
  const [loading, setLoading] = useState(false)

  const [groupOpen, setGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<WeworkChannelGroupRow | null>(null)

  const [codeOpen, setCodeOpen] = useState(false)
  const [codeName, setCodeName] = useState('')
  const [codeGroupId, setCodeGroupId] = useState<string>('')
  const [codeUsers, setCodeUsers] = useState('')
  const [codeRemark, setCodeRemark] = useState('')
  const [codeStyle, setCodeStyle] = useState(1)
  const [codeSkip, setCodeSkip] = useState(true)
  const [codeAdHit, setCodeAdHit] = useState('')
  const [codeFormError, setCodeFormError] = useState('')
  const [codeSaving, setCodeSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [g, ch] = await Promise.all([fetchChannelGroups(), fetchChannels()])
      setGroups(g)
      setChannels(ch)
    } catch {
      setGroups([])
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function openNewGroup() {
    setEditingGroup(null)
    setGroupName('')
    setGroupOpen(true)
  }

  function openEditGroup(g: WeworkChannelGroupRow) {
    setEditingGroup(g)
    setGroupName(g.name)
    setGroupOpen(true)
  }

  async function saveGroup() {
    if (!groupName.trim()) return
    if (editingGroup) {
      await updateChannelGroup(editingGroup.id, { name: groupName.trim() })
    } else {
      await createChannelGroup({ name: groupName.trim(), sort: (groups[groups.length - 1]?.sort ?? 0) + 1 })
    }
    setGroupOpen(false)
    await loadAll()
  }

  async function onDeleteGroup(g: WeworkChannelGroupRow) {
    if (!window.confirm(`删除分组「${g.name}」？活码上的分组将清空。`)) return
    await deleteChannelGroup(g.id)
    await loadAll()
  }

  function openNewCode() {
    setCodeName('')
    setCodeGroupId('')
    setCodeUsers('')
    setCodeRemark('')
    setCodeStyle(1)
    setCodeSkip(true)
    setCodeAdHit('')
    setCodeFormError('')
    setCodeOpen(true)
  }

  async function saveCode() {
    setCodeFormError('')
    const lines = codeUsers
      .split(/[\n,，]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!codeName.trim() || lines.length === 0) {
      setCodeFormError(
        '请填写「渠道名称」，并在「企微成员 userid」中输入至少一个真实 userid。灰色示例字仅为占位提示，不会作为内容提交。',
      )
      return
    }
    const adHitNum = codeAdHit.trim() ? Number(codeAdHit.trim()) : undefined
    if (codeAdHit.trim() && (!Number.isFinite(adHitNum) || (adHitNum ?? 0) < 1)) {
      setCodeFormError('广告点击 ID（ad_hit）须为正整数，可在广告 ROI 或监测落地 URL 中查看')
      return
    }
    setCodeSaving(true)
    try {
      await createEmployeeChannel({
        name: codeName.trim(),
        group_id: codeGroupId ? Number(codeGroupId) : null,
        user: lines,
        remark: codeRemark || undefined,
        skip_verify: codeSkip,
        style: codeStyle,
        ad_hit: adHitNum,
      })
      setCodeOpen(false)
      await loadAll()
    } catch (e) {
      setCodeFormError(e instanceof Error ? e.message : '创建失败，请检查网络或企微配置')
    } finally {
      setCodeSaving(false)
    }
  }

  async function onDeleteChannel(c: WeworkChannelRow) {
    if (!window.confirm(`删除活码「${c.name}」？（仅删除本系统记录，企微侧配置可能需手工清理）`)) return
    await apiDeleteChannel(c.id)
    await loadAll()
  }

  const tabBtn = (id: TabId, label: string, Icon: typeof LayoutGrid) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">渠道活码</h1>
        <p className="text-sm text-muted-foreground">
          员工活码即「联系我」二维码：同一活码对外图案不变，后台可随时<strong>换接线成员/备注</strong>（凭{' '}
          <code className="text-xs">config_id</code> 更新）；渠道归因依赖≤30字符的 <code className="text-xs">state</code>
          ，回调中原样带回。投流专用码可绑定 <code className="text-xs">ad_hit</code>，加好友后自动向广告平台回传{' '}
          <code className="text-xs">wework_add</code>。请填写<strong>成员在企业微信内的 userid</strong>。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabBtn('codes', '活码列表', LayoutGrid)}
        {tabBtn('groups', '分组管理', FolderTree)}
        {tabBtn('stats', '数据统计', BarChart3)}
      </div>

      {tab === 'codes' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
          {canManage ? (
              <Button type="button" onClick={openNewCode}>
                新建员工活码
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">仅管理员可新建活码</p>
            )}
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead>State / 投流</TableHead>
                  <TableHead>config_id</TableHead>
                  <TableHead>二维码</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>加载中…</TableCell>
                  </TableRow>
                ) : channels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无活码。配置好企业微信 Secret 后，可由管理员创建。
                    </TableCell>
                  </TableRow>
                ) : (
                  channels.map((c) => {
                    const qr = typeof c.config?.qr_code === 'string' ? c.config.qr_code : ''
                    const adHit =
                      typeof c.config?.ad_hit === 'number'
                        ? c.config.ad_hit
                        : typeof c.config?.ad_hit === 'string'
                          ? Number(c.config.ad_hit)
                          : null
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.group?.name ?? '—'}</TableCell>
                        <TableCell className="max-w-[160px] text-xs text-muted-foreground">
                          <div className="truncate">{c.state ?? '—'}</div>
                          {adHit && Number.isFinite(adHit) ? (
                            <div className="mt-0.5 text-[10px] text-primary">ad_hit={adHit}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate text-xs">{c.wework_config_id ?? '—'}</TableCell>
                        <TableCell>
                          {qr ? (
                            <a href={qr} target="_blank" rel="noreferrer" className="inline-block">
                              <img src={qr} alt="qr" className="h-14 w-14 rounded border object-contain" />
                            </a>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                    {canManage ? (
                            <Button size="sm" variant="destructive" onClick={() => void onDeleteChannel(c)}>
                              删除
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {tab === 'groups' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
      {canManage ? (
              <Button type="button" onClick={openNewGroup}>
                新建分组
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">仅管理员可管理分组</p>
            )}
          </div>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      暂无分组
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.name}</TableCell>
                      <TableCell>{g.sort}</TableCell>
                      <TableCell className="text-right space-x-2">
      {canManage ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditGroup(g)}>
                              编辑
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void onDeleteGroup(g)}>
                              删除
                            </Button>
                          </>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {tab === 'stats' ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">数据统计（预留）</p>
          <p className="mt-2">
            后续将基于「客户联系回调」与表 <code className="text-xs">wework_customer_add_records</code>{' '}
            展示各活码新增客户、转化漏斗等。当前请先在系统设置中配置回调 URL 与 Token。
          </p>
        </div>
      ) : null}

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? '编辑分组' : '新建分组'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>分组名称</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="如：线下展会" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGroupOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void saveGroup()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建员工活码</DialogTitle>
            <DialogDescription>
              填写渠道名与成员 userid 后创建；若列表/分组接口报错，请先在数据库执行 <code className="text-xs">database/008_wework_channel_live_code.sql</code>。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>渠道名称</Label>
              <Input
                value={codeName}
                onChange={(e) => {
                  setCodeName(e.target.value)
                  setCodeFormError('')
                }}
                placeholder="内部识别用"
              />
            </div>
            <div className="space-y-2">
              <Label>分组（可选）</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={codeGroupId}
                onChange={(e) => setCodeGroupId(e.target.value)}
              >
                <option value="">未分组</option>
                {groups.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>企微成员 userid（多人请换行或逗号分隔）</Label>
              <textarea
                className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={codeUsers}
                onChange={(e) => {
                  setCodeUsers(e.target.value)
                  setCodeFormError('')
                }}
                placeholder={'ZhangSan\nLiSi'}
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                须与通讯录成员 userid 完全一致；灰色示例不会自动提交，请自行输入。
              </p>
            </div>
            <div className="space-y-2">
              <Label>备注（展示在二维码名片上）</Label>
              <Input value={codeRemark} onChange={(e) => setCodeRemark(e.target.value)} placeholder="可选" />
            </div>
            <div className="space-y-2">
              <Label>绑定广告点击 ID（ad_hit，可选）</Label>
              <Input
                value={codeAdHit}
                onChange={(e) => {
                  setCodeAdHit(e.target.value.replace(/\D/g, ''))
                  setCodeFormError('')
                }}
                placeholder="监测落地 URL 中的 ad_hit，如 12345"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                填写后活码 state 为 zfah{'{id}'}，客户扫码加好友将自动回传转化；留资页与监测链须为同一 ad_hit。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>二维码样式 1–4</Label>
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={codeStyle}
                  onChange={(e) => setCodeStyle(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={codeSkip} onChange={(e) => setCodeSkip(e.target.checked)} />
                  外部客户添加时无需验证
                </label>
              </div>
            </div>
          </div>
          {codeFormError ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {codeFormError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCodeOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={codeSaving} onClick={() => void saveCode()}>
              {codeSaving ? '创建中…' : '创建并拉取二维码'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
