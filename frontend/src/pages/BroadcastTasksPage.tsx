/**
 * @file 企业微信群发：列表与简易创建（mock / 正式通道）。
 */
import { useCallback, useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import {
  cancelBroadcastTask,
  createBroadcastTask,
  exportBroadcastTasks,
  fetchBroadcastTasks,
  runBroadcastTask,
  type BroadcastTaskRow,
} from '@/api/broadcasts'
import type { Paginated } from '@/api/types'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const statusLabel: Record<string, string> = {
  draft: '草稿',
  scheduled: '已定时',
  sending: '发送中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'done') return 'default'
  if (s === 'failed' || s === 'cancelled') return 'destructive'
  if (s === 'sending') return 'secondary'
  return 'outline'
}

function msgTypeZh(t: BroadcastTaskRow) {
  const rawContent = (t as BroadcastTaskRow & { content_json?: unknown }).content_json ?? t.content
  let parsed: unknown = rawContent
  if (typeof rawContent === 'string') {
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      parsed = null
    }
  }
  const msgType =
    parsed && typeof parsed === 'object' && 'msgtype' in parsed
      ? (parsed as { msgtype?: unknown }).msgtype
      : parsed && typeof parsed === 'object' && 'msg_type' in parsed
        ? (parsed as { msg_type?: unknown }).msg_type
        : 'text'
  const mt = String(msgType || 'text')
  if (mt === 'image') return '图片'
  if (mt === 'link') return '链接'
  if (mt === 'miniprogram') return '小程序'
  return '文本'
}

export function BroadcastTasksPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canView = hasPermUser(permissions, 'broadcast:view')
  const canSend = hasPermUser(permissions, 'broadcast:send')
  const [data, setData] = useState<Paginated<BroadcastTaskRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'mock' | 'wecom_mass'>('mock')
  const [text, setText] = useState('')
  const [runNow, setRunNow] = useState(true)
  const [scheduledAtLocal, setScheduledAtLocal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetchBroadcastTasks({ page: 1, size: 50 })
      setData(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) {
      void load()
    } else {
      setLoading(false)
    }
  }, [canView, load])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setSubmitting(true)
    setErr(null)
    try {
      const scheduledIso =
        !runNow && scheduledAtLocal.trim()
          ? new Date(scheduledAtLocal).toISOString()
          : null
      await createBroadcastTask({
        name: name.trim() || '未命名群发',
        channel,
        content: text.trim() || ' ',
        run_now: runNow,
        scheduled_at: scheduledIso,
        filter_json: {},
      })
      setName('')
      setText('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function onCancel(id: number) {
    if (!window.confirm('确定取消该任务？')) return
    await cancelBroadcastTask(id)
    await load()
  }

  async function onRun(id: number) {
    await runBroadcastTask(id)
    await load()
  }

  async function onExport() {
    const res = await exportBroadcastTasks()
    const link = document.createElement('a')
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.file_base64}`
    link.download = res.filename
    link.click()
  }

  return (
    <div className="space-y-6">
      {!canView ? (
        <p className="text-sm text-destructive">缺少权限：broadcast:view</p>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">客户群发</h1>
          <p className="text-sm text-muted-foreground">
            基于已有客户的 external_userid；正式通道按负责人企微 userid 调用 add_msg_template。
          </p>
        </div>
        {canSend ? (
          <Button type="button" variant="outline" onClick={() => void onExport()}>
            导出任务 Excel
          </Button>
        ) : null}
      </div>

      {canSend ? (
        <>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Megaphone className="mr-2 h-4 w-4" />
            新建任务
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-w-full h-dvh md:h-auto md:max-w-2xl m-0 md:m-auto rounded-none md:rounded-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="h-4 w-4" />
                  新建任务
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  void onCreate(e).then(() => setCreateOpen(false))
                }}
                className="grid gap-4 sm:grid-cols-2"
              >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bt-name">任务名称</Label>
                <Input
                  id="bt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="春季促销通知"
                />
              </div>
              <div className="space-y-2">
                <Label>通道</Label>
                <select
                  className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'mock' | 'wecom_mass')}
                >
                  <option value="mock">模拟（开发联调）</option>
                  <option value="wecom_mass">企业微信群发</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 pb-1 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={runNow}
                    onChange={(e) => setRunNow(e.target.checked)}
                  />
                  立即发送（关闭则保存为草稿或定时任务）
                </label>
                {!runNow ? (
                  <div className="space-y-1">
                    <Label htmlFor="bt-schedule" className="text-muted-foreground">
                      定时发送（本地时间）
                    </Label>
                    <Input
                      id="bt-schedule"
                      type="datetime-local"
                      value={scheduledAtLocal}
                      onChange={(e) => setScheduledAtLocal(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      填写未来时间则任务为「已定时」，到点由服务端 cron（ENABLE_BROADCAST_CRON=1）执行；留空则为草稿，可列表里点「立即发送」。
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bt-text">文本内容（JSON 高级用法见后台文档）</Label>
                <textarea
                  id="bt-text"
                  className={cn(
                    'min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="您好，本周新品已上架……"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? '提交中…' : '创建并排队'}
                </Button>
              </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">任务列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : !data?.list?.length ? (
            <p className="text-sm text-muted-foreground">暂无任务</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {data.list.map((task) => (
                  <div key={task.id} className="rounded-lg border bg-white p-3">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium">{task.name}</p>
                      <Badge variant={statusVariant(task.status)}>{statusLabel[task.status] ?? task.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {msgTypeZh(task)} · {task.recipient_count ?? task.stats_json?.target ?? 0} 人
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {task.scheduled_at ? new Date(task.scheduled_at).toLocaleString('zh-CN') : '立即发送'}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="hidden divide-y rounded-md border md:block">
              {data.list.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant={statusVariant(t.status)}>{statusLabel[t.status] ?? t.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {t.channel === 'mock' ? '模拟' : '企微'}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      统计：
                      {JSON.stringify(t.stats_json ?? {})}
                      {t.wecom_msgid ? ` · msgid: ${t.wecom_msgid}` : ''}
                      {t.error_message ? ` · ${t.error_message}` : ''}
                    </p>
                  </div>
                  {canSend ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {['draft', 'scheduled', 'failed'].includes(t.status) ? (
                        <Button type="button" size="sm" variant="secondary" onClick={() => void onRun(t.id)}>
                          立即发送
                        </Button>
                      ) : null}
                      {['draft', 'scheduled', 'sending'].includes(t.status) ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => void onCancel(t.id)}>
                          取消
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
