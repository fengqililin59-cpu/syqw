import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  createSopTask,
  deleteSopTask,
  getGroupDetail,
  listGroups,
  listSopTasks,
  sendToGroup,
  syncGroups,
  updateGroupWebhook,
  updateSopStatus,
  type CustomerGroup,
  type GroupMemberRow,
  type GroupSopTask,
} from '@/api/groups'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const RECURRING_OPTIONS = [
  { value: 'daily_9', label: '每天 9:00' },
  { value: 'daily_12', label: '每天 12:00' },
  { value: 'daily_18', label: '每天 18:00' },
  { value: 'weekly_mon_9', label: '每周一 9:00' },
  { value: 'weekly_fri_18', label: '每周五 18:00' },
]

const sopStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  active: { label: '进行中', variant: 'default' },
  paused: { label: '已暂停', variant: 'outline' },
  done: { label: '已完成', variant: 'default' },
}

export function GroupsPage() {
  const [tab, setTab] = useState<'groups' | 'sop'>('groups')
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [syncing, setSyncing] = useState(false)
  const [searchName, setSearchName] = useState('')
  const [detailGroup, setDetailGroup] = useState<CustomerGroup | null>(null)
  const [detailMembers, setDetailMembers] = useState<GroupMemberRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [webhookDialogId, setWebhookDialogId] = useState<number | null>(null)
  const [webhookInput, setWebhookInput] = useState('')
  const [sendDialogId, setSendDialogId] = useState<number | null>(null)
  const [msgType, setMsgType] = useState<'text' | 'markdown'>('text')
  const [msgContent, setMsgContent] = useState('')

  const [sopTasks, setSopTasks] = useState<GroupSopTask[]>([])
  const [sopStatusFilter, setSopStatusFilter] = useState('')
  const [sopDialogOpen, setSopDialogOpen] = useState(false)
  const [sopName, setSopName] = useState('')
  const [sopMsgType, setSopMsgType] = useState<'text' | 'markdown'>('text')
  const [sopContent, setSopContent] = useState('')
  const [triggerType, setTriggerType] = useState<'scheduled' | 'recurring'>('scheduled')
  const [scheduledAt, setScheduledAt] = useState('')
  const [recurringCron, setRecurringCron] = useState('daily_9')
  const [groupIds, setGroupIds] = useState<number[]>([])

  const loadGroups = useCallback(async () => {
    try {
      const data = await listGroups({ page: 1, size: 200, name: searchName || undefined })
      setGroups(data.list || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载群列表失败')
    }
  }, [searchName])

  const loadSopTasks = useCallback(async () => {
    try {
      const data = await listSopTasks({ page: 1, size: 100, status: sopStatusFilter || undefined })
      setSopTasks(data.list || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载 SOP 列表失败')
    }
  }, [sopStatusFilter])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    if (tab === 'sop') void loadSopTasks()
  }, [tab, loadSopTasks])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      await syncGroups()
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  async function openDetail(group: CustomerGroup) {
    setDetailGroup(group)
    setDetailLoading(true)
    try {
      const d = await getGroupDetail(group.id, { page: 1, size: 100 })
      setDetailMembers(d.members || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载群详情失败')
      setDetailMembers([])
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleSaveWebhook() {
    if (!webhookDialogId) return
    try {
      await updateGroupWebhook(webhookDialogId, webhookInput.trim())
      setWebhookDialogId(null)
      setWebhookInput('')
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存 webhook 失败')
    }
  }

  async function handleSend() {
    if (!sendDialogId || !msgContent.trim()) return
    try {
      await sendToGroup(sendDialogId, { msg_type: msgType, text: msgContent.trim() })
      setSendDialogId(null)
      setMsgContent('')
      setMsgType('text')
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败')
    }
  }

  function toggleGroupSelection(id: number, checked: boolean) {
    setGroupIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))
  }

  async function handleCreateSop(status: 'draft' | 'active') {
    if (!sopName.trim() || !sopContent.trim() || groupIds.length === 0) {
      setError('请填写任务名称、消息内容并至少选择一个目标群')
      return
    }
    if (triggerType === 'scheduled' && !scheduledAt) {
      setError('请选择一次性发送时间')
      return
    }
    try {
      await createSopTask({
        name: sopName.trim(),
        msg_type: sopMsgType,
        content_json: { msg_type: sopMsgType, text: sopContent.trim() },
        trigger_type: triggerType,
        scheduled_at: triggerType === 'scheduled' ? dayjs(scheduledAt).toISOString() : null,
        recurring_cron: triggerType === 'recurring' ? recurringCron : null,
        recurring_desc:
          triggerType === 'recurring'
            ? RECURRING_OPTIONS.find((x) => x.value === recurringCron)?.label || recurringCron
            : null,
        group_ids: groupIds,
        status,
      })
      setSopDialogOpen(false)
      setSopName('')
      setSopMsgType('text')
      setSopContent('')
      setTriggerType('scheduled')
      setScheduledAt('')
      setRecurringCron('daily_9')
      setGroupIds([])
      await loadSopTasks()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建 SOP 失败')
    }
  }

  async function handleStatusChange(id: number, status: 'active' | 'paused') {
    try {
      await updateSopStatus(id, status)
      await loadSopTasks()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新状态失败')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSopTask(id)
      await loadSopTasks()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">客户群管理</h1>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'groups' ? 'default' : 'outline'} onClick={() => setTab('groups')}>
          客户群
        </Button>
        <Button variant={tab === 'sop' ? 'default' : 'outline'} onClick={() => setTab('sop')}>
          群 SOP
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {tab === 'groups' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>客户群列表</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="按群名称搜索"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-52"
              />
              <Button variant="outline" onClick={() => void loadGroups()}>
                搜索
              </Button>
              <Button onClick={() => void handleSync()} disabled={syncing}>
                {syncing ? '同步中...' : '同步群列表'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((g) => (
                <div key={g.id} className="rounded-lg border p-4">
                  <div className="flex justify-between">
                    <h3 className="font-medium">{g.name}</h3>
                    <Badge variant={g.status === 1 ? 'default' : 'secondary'}>{g.status === 1 ? '正常' : '已解散'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">群主：{g.owner?.real_name || g.owner?.username || '未知'}</p>
                  <p className="text-sm text-gray-500">成员：{g.member_count} 人</p>
                  <p className="text-xs text-gray-400">
                    {g.last_synced_at ? `同步于 ${dayjs(g.last_synced_at).format('YYYY-MM-DD HH:mm')}` : '尚未同步'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{g.webhook_url ? '✅ webhook 已配置' : '⚠️ 未配置 webhook'}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void openDetail(g)}>
                      查看详情
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setWebhookDialogId(g.id)
                        setWebhookInput('')
                      }}
                    >
                      配置 webhook
                    </Button>
                  </div>
                </div>
              ))}
              {groups.length === 0 ? <p className="text-sm text-muted-foreground">暂无客户群数据</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>群 SOP 任务</CardTitle>
            <div className="flex gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={sopStatusFilter}
                onChange={(e) => setSopStatusFilter(e.target.value)}
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="active">进行中</option>
                <option value="paused">已暂停</option>
                <option value="done">已完成</option>
              </select>
              <Button variant="outline" onClick={() => void loadSopTasks()}>
                刷新
              </Button>
              <Button
                onClick={() => {
                  setSopDialogOpen(true)
                }}
              >
                新建 SOP
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sopTasks.map((task) => (
              <div key={task.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{task.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {task.trigger_type === 'scheduled'
                        ? `一次性：${task.scheduled_at ? dayjs(task.scheduled_at).format('YYYY-MM-DD HH:mm') : '未设置'}`
                        : `周期：${task.recurring_desc || task.recurring_cron || '-'}`}
                    </p>
                    <p className="text-xs text-muted-foreground">目标群：{task.target_count ?? 0} 个</p>
                  </div>
                  <Badge variant={sopStatusConfig[task.status]?.variant || 'secondary'}>
                    {sopStatusConfig[task.status]?.label || task.status}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  {(task.status === 'draft' || task.status === 'paused') && (
                    <Button size="sm" onClick={() => void handleStatusChange(task.id, 'active')}>
                      激活
                    </Button>
                  )}
                  {task.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => void handleStatusChange(task.id, 'paused')}>
                      暂停
                    </Button>
                  )}
                  {task.status !== 'done' && (
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void handleDelete(task.id)}>
                      删除
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {sopTasks.length === 0 ? <p className="text-sm text-muted-foreground">暂无 SOP 任务</p> : null}
          </CardContent>
        </Card>
      )}

      <Dialog open={webhookDialogId !== null} onOpenChange={(open) => !open && setWebhookDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配置 webhook</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
          />
          <p className="text-xs text-gray-400">在企微群里添加机器人可获取 webhook 地址；支持清空</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWebhookDialogId(null)}>
              取消
            </Button>
            <Button onClick={() => void handleSaveWebhook()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialogId !== null} onOpenChange={(open) => !open && setSendDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>立即发送消息</DialogTitle>
          </DialogHeader>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={msgType}
            onChange={(e) => setMsgType(e.target.value as 'text' | 'markdown')}
          >
            <option value="text">普通文本</option>
            <option value="markdown">Markdown</option>
          </select>
          <textarea
            className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={msgType === 'markdown' ? '支持企微 Markdown，如 **加粗** > 引用' : '输入消息内容'}
            value={msgContent}
            onChange={(e) => setMsgContent(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={() => void handleSend()}>立即发送</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={detailGroup !== null} onOpenChange={(open) => !open && setDetailGroup(null)}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detailGroup?.name || '群详情'}</SheetTitle>
            <SheetDescription>
              群主：{detailGroup?.owner?.real_name || detailGroup?.owner?.username || '未知'}，成员数：
              {detailGroup?.member_count ?? 0}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <p className="text-xs text-muted-foreground">
                最后同步：{detailGroup?.last_synced_at ? dayjs(detailGroup.last_synced_at).format('YYYY-MM-DD HH:mm:ss') : '—'}
              </p>
              {detailGroup ? (
                <Button size="sm" onClick={() => setSendDialogId(detailGroup.id)}>
                  立即发送消息
                </Button>
              ) : null}
            </div>
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客户姓名</TableHead>
                    <TableHead>意向分</TableHead>
                    <TableHead>阶段</TableHead>
                    <TableHead>external_userid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.customer?.name || '未匹配客户'}</TableCell>
                      <TableCell>{m.customer?.intent_score ?? '-'}</TableCell>
                      <TableCell>{m.customer?.stage ?? '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{m.external_userid || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {detailMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        暂无成员数据
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={sopDialogOpen} onOpenChange={setSopDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建 SOP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>任务名称</Label>
              <Input value={sopName} onChange={(e) => setSopName(e.target.value)} />
            </div>
            <div>
              <Label>消息类型</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={sopMsgType}
                onChange={(e) => setSopMsgType(e.target.value as 'text' | 'markdown')}
              >
                <option value="text">文本</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
            <div>
              <Label>消息内容</Label>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sopContent}
                onChange={(e) => setSopContent(e.target.value)}
              />
            </div>
            <div>
              <Label>发送时机</Label>
              <div className="mt-2 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={triggerType === 'scheduled'}
                    onChange={() => setTriggerType('scheduled')}
                  />
                  一次性定时
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={triggerType === 'recurring'}
                    onChange={() => setTriggerType('recurring')}
                  />
                  周期性
                </label>
              </div>
            </div>
            {triggerType === 'scheduled' ? (
              <div>
                <Label>发送时间</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label>周期预设</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={recurringCron}
                  onChange={(e) => setRecurringCron(e.target.value)}
                >
                  {RECURRING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label>目标群（多选）</Label>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border p-2">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={(e) => toggleGroupSelection(g.id, e.target.checked)}
                    />
                    {groupMap.get(g.id)?.name || g.name}
                  </label>
                ))}
                {groups.length === 0 ? <p className="text-xs text-muted-foreground">请先同步群列表</p> : null}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => void handleCreateSop('draft')}>
              保存草稿
            </Button>
            <Button onClick={() => void handleCreateSop('active')}>立即激活</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

