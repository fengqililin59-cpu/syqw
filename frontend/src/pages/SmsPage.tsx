import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getJson } from '@/api/client'
import {
  cancelSmsTask,
  createSmsTask,
  createSmsTemplate,
  deleteSmsTemplate,
  getSmsTask,
  listSmsTasks,
  listSmsTemplates,
  type SmsTask,
  type SmsTemplate,
} from '@/api/sms'
import SmsTemplateParamsForm from '@/components/SmsTemplateParamsForm'

function previewSms(template: SmsTemplate | null, params: Record<string, string>) {
  if (!template) return ''
  let content = template.content_preview
  for (const [k, v] of Object.entries(params)) {
    const displayVal =
      typeof v === 'string' && v.startsWith('${customer.') ? `【${v.replace('${customer.', '').replace('}', '')}】` : v
    content = content.replace(new RegExp(`\\$\\{${k}\\}`, 'g'), displayVal)
  }
  return content
}

export function SmsPage() {
  const [tab, setTab] = useState<'tasks' | 'templates'>('tasks')
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [tasks, setTasks] = useState<SmsTask[]>([])
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createTplOpen, setCreateTplOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [templateId, setTemplateId] = useState(0)
  const [params, setParams] = useState<Record<string, string>>({})
  const [stage, setStage] = useState('')
  const [tagId, setTagId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [estimate, setEstimate] = useState(0)
  const [tplForm, setTplForm] = useState({ name: '', code: '', sign: '', preview: '', vars: '' })

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) || null, [templateId, templates])

  const loadAll = useCallback(async () => {
    const [tpls, taskRes] = await Promise.all([listSmsTemplates(), listSmsTasks({ page: 1, size: 50 })])
    setTemplates(tpls)
    setTasks(taskRes.list || [])
    if (!templateId && tpls.length > 0) setTemplateId(tpls[0].id)
  }, [templateId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    const hasSending = tasks.some((t) => t.status === 'sending')
    if (!hasSending) return
    const timer = setInterval(() => {
      void Promise.all(tasks.filter((t) => t.status === 'sending').map((t) => getSmsTask(t.id))).then((rows) => {
        setTasks((prev) => prev.map((x) => rows.find((r) => r.id === x.id) || x))
      })
    }, 3000)
    return () => clearInterval(timer)
  }, [tasks])

  useEffect(() => {
    if (!createTaskOpen) return
    const q = new URLSearchParams({ page: '1', size: '1' })
    if (stage) q.set('stage', stage)
    if (tagId) q.set('tag_id', tagId)
    void getJson<{ total: number }>(`/customers?${q.toString()}`)
      .then((res) => setEstimate(res.total || 0))
      .catch(() => setEstimate(0))
  }, [createTaskOpen, stage, tagId])

  async function onCreateTask() {
    if (!selectedTemplate) return
    await createSmsTask({
      name: taskName || '未命名短信任务',
      template_id: selectedTemplate.id,
      template_params: params,
      filter_json: { stage: stage || null, tag_ids: tagId ? [Number(tagId)] : [] },
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      run_now: !scheduledAt,
    })
    setCreateTaskOpen(false)
    setTaskName('')
    setParams({})
    setScheduledAt('')
    await loadAll()
  }

  async function onCreateTemplate() {
    await createSmsTemplate({
      name: tplForm.name,
      aliyun_template_code: tplForm.code,
      sign_name: tplForm.sign,
      content_preview: tplForm.preview,
      variables: tplForm.vars
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    })
    setCreateTplOpen(false)
    setTplForm({ name: '', code: '', sign: '', preview: '', vars: '' })
    await loadAll()
  }

  function progressColor(task: SmsTask) {
    const rate = task.total_count > 0 ? (task.success_count / task.total_count) * 100 : 0
    if (rate < 50) return 'bg-red-500'
    if (rate < 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === 'tasks' ? 'default' : 'outline'} onClick={() => setTab('tasks')}>
          短信群发
        </Button>
        <Button variant={tab === 'templates' ? 'default' : 'outline'} onClick={() => setTab('templates')}>
          短信模板
        </Button>
      </div>

      {tab === 'tasks' ? (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setCreateTaskOpen(true)}>新建短信任务</Button>
          </div>
          <div className="grid gap-3">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{task.name}</div>
                    <Badge>{task.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">模板：{task.template?.name || '-'}</p>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>
                        进度：{task.sent_count}/{task.total_count}
                      </span>
                      <span>
                        成功率：{task.total_count > 0 ? `${((task.success_count / task.total_count) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-gray-200">
                      <div
                        className={`h-2 rounded ${progressColor(task)}`}
                        style={{ width: `${task.total_count > 0 ? (task.sent_count / task.total_count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {['draft', 'scheduled'].includes(task.status) ? (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => void cancelSmsTask(task.id).then(loadAll)}>
                        取消
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setCreateTplOpen(true)}>新建模板</Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模板列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.aliyun_template_code} · {t.sign_name} · {t.variables?.join(', ') || '-'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void deleteSmsTemplate(t.id).then(loadAll)}>
                    禁用
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建短信任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>任务名称</Label>
              <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} />
            </div>
            <div>
              <Label>模板</Label>
              <select className="mt-1 h-10 w-full rounded border px-3 text-sm" value={templateId} onChange={(e) => setTemplateId(Number(e.target.value))}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} - {t.content_preview}
                  </option>
                ))}
              </select>
            </div>
            <SmsTemplateParamsForm template={selectedTemplate} params={params} onChange={setParams} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>阶段筛选</Label>
                <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="如 deal" />
              </div>
              <div>
                <Label>标签ID筛选</Label>
                <Input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="如 1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">预计发送约 {estimate} 人（有手机号）</p>
            <p className="text-xs text-muted-foreground">
              实际发送数以有手机号的客户为准，无手机号的客户将自动跳过。
            </p>
            <div>
              <Label>定时发送（留空=立即发送）</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="rounded border bg-muted/20 p-2 text-xs">{previewSms(selectedTemplate, params) || '短信内容预览'}</div>
            <div className="flex justify-end">
              <Button onClick={() => void onCreateTask()}>创建任务</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createTplOpen} onOpenChange={setCreateTplOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建短信模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="模板名称" value={tplForm.name} onChange={(e) => setTplForm((s) => ({ ...s, name: e.target.value }))} />
            <Input placeholder="阿里云模板Code（如 SMS_123）" value={tplForm.code} onChange={(e) => setTplForm((s) => ({ ...s, code: e.target.value }))} />
            <Input placeholder="签名（如 ZhiFlow）" value={tplForm.sign} onChange={(e) => setTplForm((s) => ({ ...s, sign: e.target.value }))} />
            <Input placeholder="模板内容预览" value={tplForm.preview} onChange={(e) => setTplForm((s) => ({ ...s, preview: e.target.value }))} />
            <Input placeholder="变量（逗号分隔，如 name,product）" value={tplForm.vars} onChange={(e) => setTplForm((s) => ({ ...s, vars: e.target.value }))} />
            <a href="https://dysms.console.aliyun.com" target="_blank" rel="noreferrer" className="text-xs text-blue-500">
              阿里云短信控制台
            </a>
            <div className="flex justify-end">
              <Button onClick={() => void onCreateTemplate()}>保存模板</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
