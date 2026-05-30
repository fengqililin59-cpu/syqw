/**
 * @file 自动跟进规则：启停、参数编辑、初始化默认规则、手动扫描（需 ENABLE_AUTOMATION_CRON 定时生效）。
 */
import { useCallback, useEffect, useState } from 'react'
import { getJson, patchJson, postJson } from '@/api/client'
import { PageHelpCard } from '@/components/PageHelpCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'

type AutomationRule = {
  id: number
  name: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  enabled: number
}

const TRIGGER_LABELS: Record<string, string> = {
  customer_created: '新客户入库',
  no_reply_hours: '员工发消息后客户未回复',
  high_intent_silence: '高意向阶段沉默',
}

const TRIGGER_HINTS: Record<string, string> = {
  customer_created: '客户创建后延迟 N 分钟提醒负责人发送欢迎话术（AI 生成，人工发送）',
  no_reply_hours: '最后一条为员工消息且超过设定小时数未收到客户回复',
  high_intent_silence: '处于报价/谈判阶段且长时间无互动，默认关闭',
}

export function AutomationRulesPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await getJson<{ list: AutomationRule[] }>('/automation/rules')
      setRules(data.list ?? [])
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleEnabled(rule: AutomationRule) {
    if (!isAdmin) return
    setSavingId(rule.id)
    try {
      await patchJson(`/automation/rules/${rule.id}`, { enabled: !rule.enabled })
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '更新失败')
    } finally {
      setSavingId(null)
    }
  }

  async function saveHours(rule: AutomationRule, hours: number) {
    if (!isAdmin) return
    setSavingId(rule.id)
    try {
      await patchJson(`/automation/rules/${rule.id}`, {
        trigger_config: { ...rule.trigger_config, hours },
      })
      await load()
      setMsg('已保存触发小时数')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingId(null)
    }
  }

  async function saveCooldown(rule: AutomationRule, cooldown_hours: number) {
    if (!isAdmin) return
    setSavingId(rule.id)
    try {
      await patchJson(`/automation/rules/${rule.id}`, {
        action_config: { ...rule.action_config, cooldown_hours },
      })
      await load()
      setMsg('已保存冷却时间')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingId(null)
    }
  }

  async function bootstrap() {
    if (!isAdmin) return
    setErr(null)
    try {
      const res = await postJson<{ created: number; message: string }>('/automation/rules/bootstrap', {})
      setMsg(res.message || `已创建 ${res.created} 条规则`)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '初始化失败')
    }
  }

  async function runScan() {
    if (!isAdmin) return
    setErr(null)
    try {
      await postJson('/automation/run-scan', {})
      setMsg('扫描已执行，请查看负责人企微应用消息与跟进记录')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '扫描失败')
    }
  }

  return (
    <div className="space-y-6 p-1">
      <PageHelpCard
        title="这页是做什么的？"
        summary="系统每天自动扫描客户，发现「新客未联系」「沉默太久」等情况，用 AI 写好话术并通知销售去企微跟进（不会自动群发骚扰客户）。"
        steps={[
          { title: '管理员点「初始化默认规则」', detail: '一键创建 3 条常用模板' },
          { title: '打开需要的规则开关', detail: '可按团队习惯微调条件' },
          { title: '销售在企微里看通知', detail: '复制话术后人工发送给客户' },
        ]}
        tip="与「流程编排」的区别：自动跟进是定时扫全库；流程编排是客户刚进来时立刻执行欢迎 SOP。"
        defaultOpen={false}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">自动跟进规则</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            适合日常培育：沉默提醒、新客未联系、高意向跟进。首次使用请点右侧「初始化默认规则」。
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void bootstrap()}>
              初始化默认规则
            </Button>
            <Button type="button" variant="secondary" onClick={() => void runScan()}>
              立即扫描一次
            </Button>
          </div>
        ) : null}
      </div>

      {msg ? <p className="text-sm text-green-600 dark:text-green-500">{msg}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            暂无规则。管理员可点击「初始化默认规则」创建新客户欢迎、未回复提醒、高意向沉默三条模板。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((rule) => {
            const hours = Number(rule.trigger_config?.hours) || 24
            const cooldown = Number(rule.action_config?.cooldown_hours) || 24
            const enabled = Number(rule.enabled) === 1
            return (
              <Card key={rule.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}
                    </p>
                  </div>
                  <Badge variant={enabled ? 'default' : 'secondary'}>
                    {enabled ? '已启用' : '已关闭'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {TRIGGER_HINTS[rule.trigger_type] ?? '—'}
                  </p>
                  {rule.trigger_type === 'no_reply_hours' || rule.trigger_type === 'high_intent_silence' ? (
                    <div className="flex items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">沉默小时数</Label>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          className="h-8 w-24"
                          defaultValue={hours}
                          disabled={!isAdmin || savingId === rule.id}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            if (Number.isFinite(v) && v >= 1 && v !== hours) void saveHours(rule, v)
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">同客户冷却（小时）</Label>
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        className="h-8 w-24"
                        defaultValue={cooldown}
                        disabled={!isAdmin || savingId === rule.id}
                        onBlur={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v) && v >= 1 && v !== cooldown) void saveCooldown(rule, v)
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI 话术：{String(rule.action_config?.ai_prompt || 'gentle_followup')} · 单客户上限{' '}
                    {String(rule.action_config?.max_per_customer ?? 8)} 次
                  </p>
                  {isAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={enabled ? 'outline' : 'default'}
                      disabled={savingId === rule.id}
                      onClick={() => void toggleEnabled(rule)}
                    >
                      {enabled ? '关闭规则' : '启用规则'}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">仅管理员可编辑</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">与「流程编排」的区别</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>自动跟进规则</strong>：按沉默/新客扫描全库客户，通知负责人跟进（适合日常培育）。
          </p>
          <p>
            <strong>流程编排</strong>：客户入库时触发可视化流程（发企微、改阶段、打标签等），适合欢迎语与 SOP。
          </p>
          <p>
            <strong>意向联动</strong>：由意向分 cron 单独处理（见意向预警页），与上述两套并行。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
