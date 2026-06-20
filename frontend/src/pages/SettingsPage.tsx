/**
 * @file 企业设置：企微扫码与回调参数（租户库）、测试发消息，仅管理员。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getJson, postJson, putJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser, isAdminUser } from '@/lib/roles'
import { getMyCallSetting, getTcccConfig, saveTcccConfig, updateMyCallSetting, type UserCallSetting } from '@/api/calls'
import { getSmsConfig, listSmsTemplates, saveSmsConfig, sendSingleSms } from '@/api/sms'
import {
  getLeadAssignmentSettings,
  saveLeadAssignmentSettings,
  getPublicWebhookSettings,
  savePublicWebhookSettings,
  previewPublicWebhookSignatures,
  getHealthMonitorStatus,
  runHealthMonitorCheck,
  type LeadAssignmentSettings,
  type PublicWebhookSettings,
  type HealthMonitorStatus,
} from '@/api/settings'

type WeworkSettings = {
  wework_corp_id: string | null
  wework_agent_id: string | null
  wework_secret_set: boolean
  wework_token: string | null
  wework_encoding_aes_key_set: boolean
  allow_auto_send: boolean
  inbox_ai_auto_send: boolean
  inbox_ai_auto_send_pricing: boolean
  inbox_ai_notify_assignee_on_auto_send?: boolean
  inbox_ai_auto_send_platform_enabled: boolean
  inbox_ai_auto_send_notify_platform_enabled?: boolean
  inbox_ai_platform_disabled?: boolean
}

type TcccConfig = {
  sdkAppId: string
  secretId: string
  secretKey: string
  serverNumber: string
  configured: boolean
}

type SmsConfig = {
  configured: boolean
  accessKeyId: string
  defaultSign: string
}

type SettingsTabKey = 'profile' | 'wework' | 'cloud' | 'ops'

export function SettingsPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const user = useAuthStore((s) => s.user)
  const tenantId = useAuthStore((s) => s.tenantId)
  const isDemo = useAuthStore((s) => s.isDemo)
  const setIsDemo = useAuthStore((s) => s.setIsDemo)
  const theme = useAuthStore((s) => s.theme)
  const setTheme = useAuthStore((s) => s.setTheme)
  const canManage = hasPermUser(permissions, 'settings:manage')

  const receiveMsgCallbackUrl = useMemo(() => {
    const envRoot = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
    const origin =
      typeof window !== 'undefined' && !envRoot ? window.location.origin : envRoot || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!tenantId || !origin) return ''
    return `${origin}/api/v1/wework/msg-callback?tenant_id=${tenantId}`
  }, [tenantId])

  const [loading, setLoading] = useState(false)
  const [corpId, setCorpId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [secret, setSecret] = useState('')
  const [secretWasSet, setSecretWasSet] = useState(false)
  const [token, setToken] = useState('')
  const [encodingAesKey, setEncodingAesKey] = useState('')
  const [aesWasSet, setAesWasSet] = useState(false)
  const [allowAutoSend, setAllowAutoSend] = useState(false)
  const [inboxAiAutoSend, setInboxAiAutoSend] = useState(false)
  const [inboxAiAutoSendPricing, setInboxAiAutoSendPricing] = useState(false)
  const [inboxAiNotifyAssignee, setInboxAiNotifyAssignee] = useState(true)
  const [inboxAiAutoSendPlatform, setInboxAiAutoSendPlatform] = useState(true)
  const [inboxAiNotifyPlatform, setInboxAiNotifyPlatform] = useState(true)
  const [inboxAiPlatformDisabled, setInboxAiPlatformDisabled] = useState(false)

  const [testUserid, setTestUserid] = useState('')
  const [testContent, setTestContent] = useState('')
  const [testLoading, setTestLoading] = useState(false)

  const [webhookChannel, setWebhookChannel] = useState('douyin')
  const [webhookTestLoading, setWebhookTestLoading] = useState(false)
  const [webhookTestSummary, setWebhookTestSummary] = useState<string | null>(null)

  const [syncLoading, setSyncLoading] = useState(false)
  const [syncSummary, setSyncSummary] = useState<string | null>(null)

  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [callSetting, setCallSetting] = useState<UserCallSetting>({
    dial_mode: 'phone',
    phone_number: null,
    is_available: true,
  })
  const [callSaving, setCallSaving] = useState(false)
  const [tcccConfig, setTcccConfig] = useState<TcccConfig>({
    sdkAppId: '',
    secretId: '',
    secretKey: '',
    serverNumber: '',
    configured: false,
  })
  const [tcccSaving, setTcccSaving] = useState(false)
  const [smsConfig, setSmsConfig] = useState<SmsConfig>({
    configured: false,
    accessKeyId: '',
    defaultSign: '',
  })
  const [smsSecret, setSmsSecret] = useState('')
  const [smsSaving, setSmsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('profile')

  const [leadAssign, setLeadAssign] = useState<LeadAssignmentSettings | null>(null)
  const [leadAssignMode, setLeadAssignMode] = useState<'first_user' | 'round_robin' | 'channel_map'>('round_robin')
  const [leadDefaultOwnerId, setLeadDefaultOwnerId] = useState<number | ''>('')
  const [leadNotifyWework, setLeadNotifyWework] = useState(true)
  const [leadChannelRows, setLeadChannelRows] = useState<Array<{ key: string; userId: number | '' }>>([])
  const [leadAssignLoading, setLeadAssignLoading] = useState(false)
  const [leadAssignSaving, setLeadAssignSaving] = useState(false)
  const [leadAssignSaved, setLeadAssignSaved] = useState(false)

  const [pubWebhook, setPubWebhook] = useState<PublicWebhookSettings | null>(null)
  const [douyinClientKey, setDouyinClientKey] = useState('')
  const [douyinClientSecret, setDouyinClientSecret] = useState('')
  const [douyinVerifyMode, setDouyinVerifyMode] =
    useState<PublicWebhookSettings['douyin_verify_mode']>('legacy_or_platform')
  const [xhsWebhookToken, setXhsWebhookToken] = useState('')
  const [xhsVerifyMode, setXhsVerifyMode] =
    useState<PublicWebhookSettings['xhs_verify_mode']>('legacy_or_platform')
  const [pubWebhookLoading, setPubWebhookLoading] = useState(false)
  const [pubWebhookSaving, setPubWebhookSaving] = useState(false)
  const [pubWebhookSaved, setPubWebhookSaved] = useState(false)
  const [signPreview, setSignPreview] = useState<string | null>(null)

  const [healthMon, setHealthMon] = useState<HealthMonitorStatus | null>(null)
  const [healthMonLoading, setHealthMonLoading] = useState(false)

  useEffect(() => {
    if (!canManage && activeTab !== 'profile') {
      setActiveTab('profile')
    }
  }, [activeTab, canManage])

  const load = useCallback(async () => {
    if (!canManage) return
    setLoading(true)
    setErr(null)
    try {
      const data = await getJson<WeworkSettings>('/settings/wework')
      setCorpId(data.wework_corp_id || '')
      setAgentId(data.wework_agent_id || '')
      setSecretWasSet(data.wework_secret_set)
      setSecret('')
      setToken(data.wework_token || '')
      setAesWasSet(data.wework_encoding_aes_key_set)
      setEncodingAesKey('')
      setAllowAutoSend(Boolean(data.allow_auto_send))
      setInboxAiAutoSend(Boolean(data.inbox_ai_auto_send))
      setInboxAiAutoSendPricing(Boolean(data.inbox_ai_auto_send_pricing))
      setInboxAiNotifyAssignee(data.inbox_ai_notify_assignee_on_auto_send !== false)
      setInboxAiAutoSendPlatform(data.inbox_ai_auto_send_platform_enabled !== false)
      setInboxAiNotifyPlatform(data.inbox_ai_auto_send_notify_platform_enabled !== false)
      setInboxAiPlatformDisabled(data.inbox_ai_platform_disabled === true)
      if (data.wework_corp_id && data.wework_secret_set) {
        await postJson('/auth/exit-demo', {}).catch(() => undefined)
        setIsDemo(false)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void getMyCallSetting()
      .then((s) => setCallSetting(s))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!canManage) return
    void getTcccConfig()
      .then((cfg) => setTcccConfig(cfg))
      .catch(() => undefined)
  }, [canManage])

  useEffect(() => {
    if (!canManage) return
    void getSmsConfig()
      .then((cfg) => setSmsConfig(cfg))
      .catch(() => undefined)
  }, [canManage])

  const loadLeadAssignment = useCallback(async () => {
    if (!canManage) return
    setLeadAssignLoading(true)
    setLeadAssignSaved(false)
    try {
      const data = await getLeadAssignmentSettings()
      setLeadAssign(data)
      setLeadAssignMode(data.assign_mode)
      setLeadDefaultOwnerId(data.default_owner_id ?? '')
      setLeadNotifyWework(Boolean(data.notify_wework))
      const rows = Object.entries(data.channel_owner_map || {}).map(([key, userId]) => ({
        key,
        userId: Number(userId),
      }))
      setLeadChannelRows(rows.length ? rows : [{ key: '', userId: '' }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载线索分配失败')
    } finally {
      setLeadAssignLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    if (!canManage || activeTab !== 'ops') return
    void loadLeadAssignment()
  }, [canManage, activeTab, loadLeadAssignment])

  const loadPublicWebhooks = useCallback(async () => {
    if (!canManage) return
    setPubWebhookLoading(true)
    setPubWebhookSaved(false)
    try {
      const data = await getPublicWebhookSettings()
      setPubWebhook(data)
      setDouyinClientKey(data.douyin_client_key || '')
      setDouyinVerifyMode(data.douyin_verify_mode)
      setXhsVerifyMode(data.xhs_verify_mode)
      setDouyinClientSecret('')
      setXhsWebhookToken('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载公域 Webhook 配置失败')
    } finally {
      setPubWebhookLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    if (!canManage || activeTab !== 'ops') return
    void loadPublicWebhooks()
  }, [canManage, activeTab, loadPublicWebhooks])

  const loadHealthMonitor = useCallback(async () => {
    if (!canManage) return
    setHealthMonLoading(true)
    try {
      const data = await getHealthMonitorStatus()
      setHealthMon(data)
    } catch {
      setHealthMon(null)
    } finally {
      setHealthMonLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    if (!canManage || activeTab !== 'ops') return
    void loadHealthMonitor()
  }, [canManage, activeTab, loadHealthMonitor])

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaved(false)
    setLoading(true)
    try {
      await putJson<WeworkSettings>('/settings/wework', {
        wework_corp_id: corpId,
        wework_agent_id: agentId,
        allow_auto_send: allowAutoSend,
        inbox_ai_auto_send: inboxAiAutoSend,
        inbox_ai_auto_send_pricing: inboxAiAutoSend && inboxAiAutoSendPricing,
        inbox_ai_notify_assignee_on_auto_send: inboxAiNotifyAssignee,
        ...(secret.trim() ? { wework_secret: secret.trim() } : {}),
        ...(token.trim() !== '' ? { wework_token: token.trim() } : { wework_token: null }),
        ...(encodingAesKey.trim() ? { wework_encoding_aes_key: encodingAesKey.trim() } : {}),
      })
      setSecret('')
      setEncodingAesKey('')
      await postJson('/auth/exit-demo', {}).catch(console.error)
      setIsDemo(false)
      setSaved(true)
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  type SyncResult = {
    created: number
    updated: number
    skipped_fetch: number
    skipped_follow_users_not_in_system: number
    list_errors: number
    follow_users_count: number
  }

  async function onSyncCustomers() {
    setSyncSummary(null)
    setErr(null)
    setSyncLoading(true)
    try {
      const data = await postJson<SyncResult>('/sync/customers', {}, { timeout: 120_000 })
      setSyncSummary(
        `新增 ${data.created}，更新 ${data.updated}；企微跟进成员 ${data.follow_users_count} 人；未绑定系统的跟进成员 ${data.skipped_follow_users_not_in_system}；拉取详情失败 ${data.skipped_fetch}；列表接口失败 ${data.list_errors}`,
      )
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '同步失败')
    } finally {
      setSyncLoading(false)
    }
  }

  async function onTestSend() {
    const uid = testUserid.trim()
    if (!uid) {
      window.alert('请填写接收成员的企微 UserID')
      return
    }
    setTestLoading(true)
    setErr(null)
    try {
      await postJson<{ errcode: number; errmsg: string }>('/wework/test-send', {
        userid: uid,
        ...(testContent.trim() ? { content: testContent.trim() } : {}),
      })
      window.alert('发送成功，请到企业微信客户端查看。')
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : '发送失败'
      setErr(msg)
      window.alert(msg)
    } finally {
      setTestLoading(false)
    }
  }

  async function onWebhookTest() {
    setWebhookTestSummary(null)
    setErr(null)
    setWebhookTestLoading(true)
    try {
      const data = await postJson<{
        deduplicated?: boolean
        thread?: { id: number }
        message?: { id: number }
      }>('/inbox/webhook-test', { channel: webhookChannel })
      const threadId = data.thread?.id
      setWebhookTestSummary(
        data.deduplicated
          ? '重复消息已忽略（channel_message_id 去重生效）'
          : `测试入站成功${threadId ? `，会话 ID ${threadId}，请到「统一收件箱」查看` : ''}`,
      )
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Webhook 测试失败')
    } finally {
      setWebhookTestLoading(false)
    }
  }

  const isAdmin = isAdminUser(user)

  async function onSaveMyCallSetting() {
    setCallSaving(true)
    try {
      const data = await updateMyCallSetting({
        dial_mode: callSetting.dial_mode,
        phone_number: callSetting.phone_number || null,
        is_available: callSetting.is_available,
      })
      setCallSetting({
        dial_mode: data.dial_mode,
        phone_number: data.phone_number,
        is_available: Boolean(data.is_available),
      })
      window.alert('外呼设置已保存')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setCallSaving(false)
    }
  }

  async function onSaveTcccConfig() {
    setTcccSaving(true)
    try {
      const data = await saveTcccConfig({
        sdkAppId: tcccConfig.sdkAppId,
        secretId: tcccConfig.secretId,
        secretKey: tcccConfig.secretKey,
        serverNumber: tcccConfig.serverNumber,
      })
      setTcccConfig(data)
      window.alert('TCCC 配置已保存')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setTcccSaving(false)
    }
  }

  async function onTestCall() {
    window.alert('请到客户列表点击电话按钮进行测试拨打（Mock 模式不会真实外呼）')
  }

  async function onSaveSmsConfig() {
    setSmsSaving(true)
    try {
      const data = await saveSmsConfig({
        accessKeyId: smsConfig.accessKeyId,
        accessKeySecret: smsSecret,
        defaultSign: smsConfig.defaultSign,
      })
      setSmsConfig(data)
      setSmsSecret('')
      window.alert('短信配置已保存')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSmsSaving(false)
    }
  }

  async function onTestSms() {
    const phone = window.prompt('请输入测试手机号')
    if (!phone) return
    try {
      const templates = await listSmsTemplates()
      const first = templates[0]
      if (!first) {
        window.alert('请先在短信营销页创建一个模板')
        return
      }
      await sendSingleSms({
        customer_id: null,
        template_id: first.id,
        extra_params: { phone },
      })
      window.alert('测试短信已提交')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '发送失败')
    }
  }

  async function onSaveLeadAssignment() {
    setLeadAssignSaving(true)
    setLeadAssignSaved(false)
    setErr(null)
    try {
      const channel_owner_map: Record<string, number> = {}
      for (const row of leadChannelRows) {
        const key = row.key.trim().toLowerCase()
        if (!key || row.userId === '') continue
        channel_owner_map[key] = Number(row.userId)
      }
      const data = await saveLeadAssignmentSettings({
        assign_mode: leadAssignMode,
        default_owner_id: leadDefaultOwnerId === '' ? null : Number(leadDefaultOwnerId),
        notify_wework: leadNotifyWework,
        channel_owner_map,
      })
      setLeadAssign(data)
      setLeadAssignSaved(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存线索分配失败')
    } finally {
      setLeadAssignSaving(false)
    }
  }

  function userLabel(u: { id: number; username: string; real_name: string | null }) {
    return u.real_name ? `${u.real_name}（${u.username}）` : u.username
  }

  async function onSavePublicWebhooks() {
    setPubWebhookSaving(true)
    setPubWebhookSaved(false)
    setErr(null)
    try {
      const data = await savePublicWebhookSettings({
        douyin_client_key: douyinClientKey.trim() || null,
        douyin_verify_mode: douyinVerifyMode,
        xhs_verify_mode: xhsVerifyMode,
        ...(douyinClientSecret.trim() ? { douyin_client_secret: douyinClientSecret.trim() } : {}),
        ...(xhsWebhookToken.trim() ? { xhs_webhook_token: xhsWebhookToken.trim() } : {}),
      })
      setPubWebhook(data)
      setDouyinClientSecret('')
      setXhsWebhookToken('')
      setPubWebhookSaved(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存公域 Webhook 配置失败')
    } finally {
      setPubWebhookSaving(false)
    }
  }

  async function onRunHealthMonitor() {
    setHealthMonLoading(true)
    try {
      const data = await runHealthMonitorCheck()
      setHealthMon(data)
      window.alert(`巡检完成：${data.run?.status ?? 'ok'}`)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '巡检失败')
    } finally {
      setHealthMonLoading(false)
    }
  }

  async function onPreviewSignatures() {
    setSignPreview(null)
    try {
      const data = await previewPublicWebhookSignatures('{"open_id":"demo","text":"你好"}')
      const lines = [`sample: ${data.sample_body}`]
      if (data.douyin_signature) lines.push(`X-Douyin-Signature: ${data.douyin_signature}`)
      if (data.xhs_signature) lines.push(`X-Red-Signature: ${data.xhs_signature}`)
      setSignPreview(lines.join('\n'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '生成签名失败（请先保存 secret/token）')
    }
  }

  const appUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || window.location.origin
  const tabs: Array<{ key: SettingsTabKey; title: string; hint: string }> = canManage
    ? [
        { key: 'profile', title: '个人设置', hint: '界面主题与外呼方式' },
        { key: 'wework', title: '企微配置', hint: 'CorpID、回调与消息解密' },
        { key: 'cloud', title: '云服务配置', hint: 'TCCC 与短信服务' },
        { key: 'ops', title: '运维工具', hint: '客户同步与连通测试' },
      ]
    : [{ key: 'profile', title: '个人设置', hint: '界面主题与外呼方式' }]

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-sm text-muted-foreground">按功能分组展示，点击上方按钮在不同设置页之间切换。</p>
      </div>

      <div className="space-y-2 rounded-md border bg-card p-2">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <p className="text-sm font-medium">{tab.title}</p>
                <p className="mt-0.5 text-xs">{tab.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 界面主题 ── */}
      {activeTab === 'profile' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">界面主题</h2>
        <p className="text-xs text-muted-foreground">选择你喜欢的侧边栏风格，切换后立即生效。</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            { id: 'blue',   name: '深海蓝', desc: '专业感，适合科技行业',   sidebarColor: '#0a1628', dotColor: '#7eb3f0', border: undefined },
            { id: 'green',  name: '企微绿', desc: '亲切感，贴近企微生态',   sidebarColor: '#1a7f4e', dotColor: '#34d399', border: undefined },
            { id: 'dark',   name: '暗夜黑', desc: '深色模式，减少视觉疲劳', sidebarColor: '#111827', dotColor: '#a78bfa', border: undefined },
            { id: 'orange', name: '暖橙棕', desc: '温暖感，适合传统行业',   sidebarColor: '#431407', dotColor: '#fb923c', border: undefined },
            { id: 'wecom',  name: '企微白', desc: '贴近企微管理后台，最熟悉', sidebarColor: '#ffffff', dotColor: '#1677ff', border: '1px solid #e8e8e8' },
          ] as Array<{ id: string; name: string; desc: string; sidebarColor: string; dotColor: string; border?: string }>).map((t) => (
            <div
              key={t.id}
              onClick={() => setTheme(t.id as import('@/store/authStore').ThemeId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                border: theme === t.id ? '2px solid #5b8dd9' : '0.5px solid #e2e8f0',
                cursor: 'pointer',
                background: theme === t.id ? '#f0f7ff' : '#fff',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: t.sidebarColor,
                  border: t.border ?? 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.dotColor }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f1e2e' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.desc}</div>
              </div>
              {theme === t.id && (
                <span style={{ color: '#5b8dd9', fontSize: 16 }}>✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {activeTab === 'profile' ? (
      <div className="space-y-4 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">我的外呼设置</h2>
        <div>
          <Label>拨打方式</Label>
          <div className="mt-2 flex flex-col gap-2 md:flex-row">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2">
              <input
                type="radio"
                value="phone"
                checked={callSetting.dial_mode === 'phone'}
                onChange={() => setCallSetting((s) => ({ ...s, dial_mode: 'phone' }))}
              />
              <div>
                <p className="text-sm font-medium">手机接听</p>
                <p className="text-xs text-gray-500">系统先拨您的手机，接听后再拨客户。</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2">
              <input
                type="radio"
                value="webrtc"
                checked={callSetting.dial_mode === 'webrtc'}
                onChange={() => setCallSetting((s) => ({ ...s, dial_mode: 'webrtc' }))}
              />
              <div>
                <p className="text-sm font-medium">网页软电话</p>
                <p className="text-xs text-gray-500">浏览器内接听，需麦克风权限。</p>
              </div>
            </label>
          </div>
        </div>
        {callSetting.dial_mode === 'phone' ? (
          <div className="space-y-2">
            <Label>我的手机号</Label>
            <Input
              className="max-w-[220px]"
              placeholder="13800138000"
              value={callSetting.phone_number ?? ''}
              onChange={(e) => setCallSetting((s) => ({ ...s, phone_number: e.target.value }))}
            />
            <p className="text-xs text-gray-500">发起外呼时系统会先拨打此号码。</p>
          </div>
        ) : null}
        <Button type="button" onClick={() => void onSaveMyCallSetting()} disabled={callSaving}>
          {callSaving ? '保存中…' : '保存设置'}
        </Button>
      </div>
      ) : null}

      {canManage ? (
        <>
          {activeTab === 'cloud' ? (
          <div className="space-y-4 rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">腾讯云 TCCC 配置</h2>
            {isDemo ? (
              <div
                style={{
                  background: '#eef4ff',
                  border: '0.5px solid #b5d4f4',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: '#185fa5' }}>
                  当前处于演示模式，配置企微后系统将自动切换显示您的真实客户数据
                </span>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              需要先在腾讯云开通 TCCC。当前状态：{tcccConfig.configured ? '已配置' : '未配置'}。
              <a href="https://cloud.tencent.com/product/tccc" target="_blank" rel="noreferrer" className="ml-1 text-blue-500">
                前往开通 →
              </a>
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>SDK App ID</Label>
                <Input value={tcccConfig.sdkAppId} onChange={(e) => setTcccConfig((s) => ({ ...s, sdkAppId: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Secret ID</Label>
                <Input value={tcccConfig.secretId} onChange={(e) => setTcccConfig((s) => ({ ...s, secretId: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={tcccConfig.secretKey}
                  onChange={(e) => setTcccConfig((s) => ({ ...s, secretKey: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>客服号码</Label>
                <Input
                  value={tcccConfig.serverNumber}
                  onChange={(e) => setTcccConfig((s) => ({ ...s, serverNumber: e.target.value }))}
                  placeholder="075512345678"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void onSaveTcccConfig()} disabled={tcccSaving}>
                {tcccSaving ? '保存中…' : '保存'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onTestCall()}>
                测试拨打
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              回调地址：
              <code className="ml-1 rounded bg-gray-100 px-1">{appUrl}/api/v1/callback/tccc</code>
            </p>
          </div>
          ) : null}

          {activeTab === 'cloud' ? (
          <div className="space-y-3 rounded-md border bg-card p-4">
            <h3 className="font-medium">阿里云短信配置</h3>
            <p className="text-sm text-gray-500">
              需要在阿里云开通「短信服务 SMS」。
              <a href="https://dysms.console.aliyun.com" target="_blank" rel="noreferrer" className="ml-1 text-blue-500">
                前往配置 →
              </a>
            </p>
            <p className="text-xs text-muted-foreground">状态：{smsConfig.configured ? '已配置' : '未配置'}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm">Access Key ID</label>
                <Input
                  value={smsConfig.accessKeyId}
                  onChange={(e) => setSmsConfig((s) => ({ ...s, accessKeyId: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm">Access Key Secret</label>
                <Input type="password" value={smsSecret} onChange={(e) => setSmsSecret(e.target.value)} placeholder="留空表示不修改" />
              </div>
              <div>
                <label className="text-sm">默认签名</label>
                <Input
                  placeholder="ZhiFlow"
                  value={smsConfig.defaultSign}
                  onChange={(e) => setSmsConfig((s) => ({ ...s, defaultSign: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void onSaveSmsConfig()} disabled={smsSaving}>
                {smsSaving ? '保存中…' : '保存'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onTestSms()}>
                发测试短信
              </Button>
            </div>
          </div>
          ) : null}

          {activeTab === 'wework' ? (
          <div>
        <p className="text-sm text-muted-foreground">
          配置保存在当前租户（数据库），多租户下勿仅用服务器 .env。扫码登录需 CorpID、AgentID、应用 Secret。
        </p>
        <div className="mt-4 rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium text-foreground">扫码登录闭环检查（管理员）</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              服务器环境变量：<code className="rounded bg-muted px-1">FRONTEND_URL</code> 为浏览器访问的前端根（如{' '}
              <code className="rounded bg-muted px-1">https://你的域名</code>
              ）；<code className="rounded bg-muted px-1">WEWORK_CALLBACK_URL</code> 为企微能访问到的 API 根。OAuth 实际回调为{' '}
              <code className="break-all rounded bg-muted px-1 text-xs">
                {'{WEWORK_CALLBACK_URL}'}/api/v1/wework/callback
              </code>
              ，须与企微后台「应用 → 授权回调」一致。
            </li>
            <li>
              企微管理后台 → 应用 → 网页授权及 JS-SDK：配置<strong>可信域名</strong>（与对外站点一致），按提示下载校验文件放到前端静态根目录并可访问。
            </li>
            <li>
              在本页保存 CorpID、AgentID、Secret 后，到<strong>用户管理</strong>为员工填写<strong>企微成员 UserID</strong>（与通讯录 userid 一致），否则扫码会提示「尚未绑定」。
            </li>
            <li>
              登录页填写<strong>企业 ID（租户 ID）</strong>后点「企微扫码登录」，成功后应进入仪表盘。
            </li>
          </ol>
        </div>
        <div className="mt-4 rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium text-foreground">会话消息回调（客户联系）</p>
          <p className="mt-2 text-muted-foreground">
            在企微后台「客户联系 → 客户 → API」或自建应用「接收消息」中，将服务器 URL 设为下方地址；Token、EncodingAESKey 与本页「回调 Token」「EncodingAESKey」字段<strong>完全一致</strong>。保存后点击验证；消息解密后会写入数据库并在「客户管理 → 编辑客户」中展示（需客户已存在且{' '}
            <code className="rounded bg-muted px-1">external_userid</code> 与消息一致，通常来自客户同步）。
          </p>
          {receiveMsgCallbackUrl ? (
            <p className="mt-2 break-all rounded bg-muted/80 p-2 font-mono text-xs">{receiveMsgCallbackUrl}</p>
          ) : (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">无法生成地址：请重新登录以加载租户 ID，或在前端 .env 配置 VITE_API_URL 指向对外 API 根。</p>
          )}
        </div>
      </div>
          ) : null}

      {activeTab === 'wework' ? (
      <form onSubmit={onSave} className="space-y-4 rounded-md border bg-card p-4">
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        {saved ? <p className="text-sm text-green-600 dark:text-green-500">已保存</p> : null}

        <div className="space-y-2">
          <Label htmlFor="corp">企业 ID（CorpID）</Label>
          <Input
            id="corp"
            value={corpId}
            onChange={(e) => setCorpId(e.target.value)}
            placeholder="wwxxxxxxxx"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent">应用 AgentID</Label>
          <Input
            id="agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="数字"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret">应用 Secret（用于 access_token）</Label>
          <Input
            id="secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={secretWasSet ? '已配置，留空不变；填写则覆盖' : '必填'}
            autoComplete="off"
          />
          {secretWasSet ? (
            <p className="text-xs text-muted-foreground">当前已保存 Secret。</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="token">回调 Token（可选，接收事件 URL 验证）</Label>
          <Input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="与企微后台一致时可填"
            autoComplete="off"
          />
        </div>
        {inboxAiPlatformDisabled ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            平台已关闭本企业 AI 自动发送，如需开启请联系 ZhiFlow 运营。
          </p>
        ) : null}
        <div className="flex items-center gap-2 rounded-md border border-dashed p-3">
          <input
            id="inboxAiAutoSend"
            type="checkbox"
            checked={inboxAiAutoSend}
            disabled={!inboxAiAutoSendPlatform || inboxAiPlatformDisabled}
            onChange={(e) => setInboxAiAutoSend(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="inboxAiAutoSend" className="cursor-pointer font-normal leading-snug">
            收件箱 FAQ 自动发送：资料/介绍类（p0，置信≥75%）自动回复；投诉类仍待人工。
            {!inboxAiAutoSendPlatform ? (
              <span className="mt-1 block text-xs text-amber-700">平台已禁用（INBOX_AI_AUTO_SEND=0）</span>
            ) : null}
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-dashed p-3">
          <input
            id="inboxAiAutoSendPricing"
            type="checkbox"
            checked={inboxAiAutoSendPricing}
            disabled={!inboxAiAutoSendPlatform || !inboxAiAutoSend || inboxAiPlatformDisabled}
            onChange={(e) => setInboxAiAutoSendPricing(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="inboxAiAutoSendPricing" className="cursor-pointer font-normal leading-snug">
            简单询价自动发送：客户问价格/多少钱（p1，置信≥85%）可自动回；出现合同、底价、返点等词一律转人工。
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-dashed border-violet-200 bg-violet-50/40 p-3">
          <input
            id="inboxAiNotifyAssignee"
            type="checkbox"
            checked={inboxAiNotifyAssignee}
            disabled={!inboxAiNotifyPlatform}
            onChange={(e) => setInboxAiNotifyAssignee(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="inboxAiNotifyAssignee" className="cursor-pointer font-normal leading-snug">
            AI 自动回复后，企微提醒会话负责人/客户归属销售抽查（推荐开启）。
            {!inboxAiNotifyPlatform ? (
              <span className="mt-1 block text-xs text-amber-700">平台已禁用（INBOX_AI_AUTO_SEND_NOTIFY=0）</span>
            ) : null}
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-dashed p-3">
          <input
            id="allowAutoSend"
            type="checkbox"
            checked={allowAutoSend}
            onChange={(e) => setAllowAutoSend(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="allowAutoSend" className="cursor-pointer font-normal leading-snug">
            允许流程引擎向客户直发企微消息（需客户有 external_userid、负责人已绑定企微 UserID；仍受频控与客户退订限制）
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aes">EncodingAESKey（可选，消息解密）</Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            本系统不生成此密钥。请在
            <strong className="text-foreground/80"> 企微管理后台 </strong>
            进入「应用管理 → 自建应用 → 接收消息」或「客户联系 → 客户 → API」中配置上方回调地址后，在
            同一处页面查看并复制
            <code className="mx-0.5 rounded bg-muted px-1">EncodingAESKey</code>
            （一般为 43 位），粘贴到此处，须与企微后台
            <strong className="text-foreground/80"> 一字不差 </strong>
            。不启用消息回调/不解密推送时可先留空。
          </p>
          <Input
            id="aes"
            type="password"
            value={encodingAesKey}
            onChange={(e) => setEncodingAesKey(e.target.value)}
            placeholder={aesWasSet ? '已配置，留空不修改；要清空请删光本框后点保存' : '43 位密钥'}
            autoComplete="off"
          />
          {aesWasSet ? (
            <p className="text-xs text-muted-foreground">已保存过密钥；需修改时输入新值保存；不修改则留空。</p>
          ) : null}
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? '保存中…' : '保存'}
        </Button>
      </form>
      ) : null}

      {activeTab === 'ops' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">线索分配</h2>
        <p className="text-xs text-muted-foreground">
          落地页留资、活码加好友新建客户时，按以下规则指定负责人。企微加好友时若跟进成员已在系统中绑定 UserID，则优先分配给该成员。
        </p>
        {leadAssignLoading ? (
          <p className="text-xs text-muted-foreground">加载中…</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="lead-mode">分配模式</Label>
              <select
                id="lead-mode"
                value={leadAssignMode}
                onChange={(e) => setLeadAssignMode(e.target.value as typeof leadAssignMode)}
                className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {(leadAssign?.mode_options ?? [
                  { value: 'round_robin', label: '轮询分配（推荐）' },
                  { value: 'channel_map', label: '按渠道映射' },
                  { value: 'first_user', label: '固定首位员工' },
                ]).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-default-owner">默认负责人（轮询/映射未命中时）</Label>
              <select
                id="lead-default-owner"
                value={leadDefaultOwnerId === '' ? '' : String(leadDefaultOwnerId)}
                onChange={(e) => setLeadDefaultOwnerId(e.target.value ? Number(e.target.value) : '')}
                className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">不指定（回退到首位员工）</option>
                {(leadAssign?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                    {!u.wework_bound ? ' · 未绑企微' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>渠道 → 负责人映射</Label>
              <p className="text-xs text-muted-foreground">
                键名与落地页 <code className="rounded bg-muted px-1">utm_source</code>、活码 state 等一致（不区分大小写）。可用{' '}
                <code className="rounded bg-muted px-1">*</code> 作为兜底。
              </p>
              {leadChannelRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="max-w-[140px]"
                    placeholder="utm_source"
                    value={row.key}
                    onChange={(e) =>
                      setLeadChannelRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)),
                      )
                    }
                  />
                  <select
                    value={row.userId === '' ? '' : String(row.userId)}
                    onChange={(e) =>
                      setLeadChannelRows((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, userId: e.target.value ? Number(e.target.value) : '' } : r,
                        ),
                      )
                    }
                    className="flex h-9 min-w-[160px] flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">选择员工</option>
                    {(leadAssign?.users ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {userLabel(u)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeadChannelRows((rows) => rows.filter((_, i) => i !== idx))}
                    disabled={leadChannelRows.length <= 1}
                  >
                    删除
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLeadChannelRows((rows) => [...rows, { key: '', userId: '' }])}
              >
                添加映射
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={leadNotifyWework}
                onChange={(e) => setLeadNotifyWework(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">新线索通过企微应用消息提醒负责人（需已配置 CorpID/Secret 且负责人已绑 UserID）</span>
            </label>
            {leadAssignSaved ? <p className="text-xs text-green-600 dark:text-green-500">线索分配已保存</p> : null}
            <Button type="button" disabled={leadAssignSaving} onClick={() => void onSaveLeadAssignment()}>
              {leadAssignSaving ? '保存中…' : '保存线索分配'}
            </Button>
          </div>
        )}
      </div>
      ) : null}

      {activeTab === 'ops' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">公域 Webhook 验签（抖音 / 小红书）</h2>
        <p className="text-xs text-muted-foreground">
          配置开放平台密钥后，系统会校验官方签名 Header。仍可与 Legacy 方式{' '}
          <code className="rounded bg-muted px-1">X-Inbox-Webhook-Token</code> 并存（见「获客指南」回调 URL）。
          抖音 URL 验证时会自动响应 <code className="rounded bg-muted px-1">verify_webhook</code> challenge。
        </p>
        {pubWebhookLoading ? (
          <p className="text-xs text-muted-foreground">加载中…</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              <p>{pubWebhook?.docs.douyin_algo}</p>
              <p className="mt-1">{pubWebhook?.docs.xhs_algo}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">抖音</p>
              <div className="space-y-1">
                <Label htmlFor="dy-key">Client Key（可选）</Label>
                <Input id="dy-key" value={douyinClientKey} onChange={(e) => setDouyinClientKey(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dy-secret">Client Secret</Label>
                <Input
                  id="dy-secret"
                  type="password"
                  value={douyinClientSecret}
                  onChange={(e) => setDouyinClientSecret(e.target.value)}
                  placeholder={pubWebhook?.douyin_client_secret_set ? '已配置，留空不变' : '开放平台应用 Secret'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dy-mode">验签模式</Label>
                <select
                  id="dy-mode"
                  value={douyinVerifyMode}
                  onChange={(e) =>
                    setDouyinVerifyMode(e.target.value as PublicWebhookSettings['douyin_verify_mode'])
                  }
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {(pubWebhook?.verify_mode_options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">小红书</p>
              <div className="space-y-1">
                <Label htmlFor="xhs-token">Webhook Token</Label>
                <Input
                  id="xhs-token"
                  type="password"
                  value={xhsWebhookToken}
                  onChange={(e) => setXhsWebhookToken(e.target.value)}
                  placeholder={pubWebhook?.xhs_webhook_token_set ? '已配置，留空不变' : '落地页/开放平台 Token'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="xhs-mode">验签模式</Label>
                <select
                  id="xhs-mode"
                  value={xhsVerifyMode}
                  onChange={(e) => setXhsVerifyMode(e.target.value as PublicWebhookSettings['xhs_verify_mode'])}
                  className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {(pubWebhook?.verify_mode_options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* 巨量引擎表单广告 Webhook 地址 */}
            {tenantId ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">巨量引擎表单广告 Webhook 地址</p>
                <p className="text-xs text-muted-foreground">
                  在巨量引擎广告主后台 → 工具 → 线索管理 → 配置推送地址，粘贴下方链接即可自动接收表单线索。
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-muted/60 px-2 py-1 text-xs">
                    {appUrl}/api/v1/public/ocean-lead/{tenantId}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${appUrl}/api/v1/public/ocean-lead/${tenantId}`,
                      )
                    }}
                  >
                    复制
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  验签：上方配置抖音 Client Secret 后系统自动验证签名；未配置则所有推送放行（调试期可接受）。
                </p>
              </div>
            ) : null}
            {pubWebhookSaved ? <p className="text-xs text-green-600 dark:text-green-500">公域验签已保存</p> : null}
            {signPreview ? (
              <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">{signPreview}</pre>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pubWebhookSaving} onClick={() => void onSavePublicWebhooks()}>
                {pubWebhookSaving ? '保存中…' : '保存验签配置'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onPreviewSignatures()}>
                生成签名示例
              </Button>
            </div>
          </div>
        )}
      </div>
      ) : null}

      {activeTab === 'ops' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">API 健康巡检</h2>
        <p className="text-xs text-muted-foreground">
          在服务器 <code className="rounded bg-muted px-1">backend/.env</code> 开启{' '}
          <code className="rounded bg-muted px-1">ENABLE_HEALTH_MONITOR_CRON=1</code>，并配置{' '}
          <code className="rounded bg-muted px-1">HEALTH_MONITOR_TENANT_ID</code>、
          <code className="rounded bg-muted px-1">HEALTH_MONITOR_TOUSER</code>（企微 UserID，多个用 | 分隔）。
          连续失败将通过企微应用消息告警。
        </p>
        {healthMonLoading && !healthMon ? (
          <p className="text-xs text-muted-foreground">加载中…</p>
        ) : healthMon ? (
          <div className="space-y-2 text-sm">
            <p>
              Cron：{healthMon.enabled ? '已启用' : '未启用'}
              {healthMon.last_probe ? (
                <span className="ml-2 text-muted-foreground">
                  最近探测 {healthMon.last_probe.ok ? '正常' : '异常'} · {healthMon.last_probe.latency_ms}ms
                </span>
              ) : null}
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">{healthMon.url}</p>
            {healthMon.last_error ? (
              <p className="text-xs text-red-600">最近错误：{healthMon.last_error}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              连续失败 {healthMon.consecutive_fails}/{healthMon.fail_threshold}
              {healthMon.alerting ? ' · 告警中' : ''}
            </p>
            <Button type="button" variant="outline" size="sm" disabled={healthMonLoading} onClick={() => void onRunHealthMonitor()}>
              立即巡检
            </Button>
          </div>
        ) : null}
      </div>
      ) : null}

      {activeTab === 'ops' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">企微加好友自动入库</h2>
        <p className="text-xs text-muted-foreground">
          客户通过活码/联系我加好友时，系统收到 <code className="rounded bg-muted px-1">add_external_contact</code>{' '}
          回调后会自动写入客户库并触发「流程编排」中状态为 active 且触发器为「新客户入库」的流程（欢迎语、打标签等）。
          默认开启；在服务器 <code className="rounded bg-muted px-1">backend/.env</code> 设{' '}
          <code className="rounded bg-muted px-1">AUTO_CREATE_CUSTOMER_ON_WEWORK_ADD=0</code> 可关闭。
          延迟节点需 <code className="rounded bg-muted px-1">ENABLE_FLOW_ENGINE_CRON=1</code>。
          流程模板见「流程编排」页「一键创建欢迎流程」。
        </p>
      </div>
      ) : null}

      {activeTab === 'ops' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">客户同步（外部联系人）</h2>
        <p className="text-xs text-muted-foreground">
          调用企微「客户联系」接口，把配置了客户联系且已在<strong>用户管理</strong>中绑定企微 UserID 的成员所添加的外部联系人写入客户库；同一外部联系人以 `(租户, external_userid)` 去重并更新归属与资料。首次同步或大量客户时可能需等待数十秒。
        </p>
        {syncSummary ? <p className="text-xs text-green-600 dark:text-green-500">{syncSummary}</p> : null}
        <Button type="button" variant="secondary" disabled={syncLoading} onClick={() => void onSyncCustomers()}>
          {syncLoading ? '同步中…' : '立即同步客户'}
        </Button>
      </div>
      ) : null}

      {activeTab === 'ops' ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">连通性测试</h2>
        <p className="text-xs text-muted-foreground">
          使用当前租户已保存的 CorpID / Secret / AgentID，通过应用接口给成员发文本消息（需在应用可见范围内）。
        </p>
        <div className="space-y-2">
          <Label htmlFor="tuid">成员 UserID</Label>
          <Input
            id="tuid"
            value={testUserid}
            onChange={(e) => setTestUserid(e.target.value)}
            placeholder="如 ZhangSan"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tcontent">自定义文案（可选）</Label>
          <Input
            id="tcontent"
            value={testContent}
            onChange={(e) => setTestContent(e.target.value)}
            placeholder="默认发送固定测试文案"
            autoComplete="off"
          />
        </div>
        <Button type="button" variant="outline" disabled={testLoading} onClick={() => void onTestSend()}>
          {testLoading ? '发送中…' : '测试发送'}
        </Button>
      </div>
      ) : null}

      {activeTab === 'ops' && isAdmin ? (
      <div className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">公域 Webhook 测试（统一收件箱）</h2>
        <p className="text-xs text-muted-foreground">
          模拟抖音/小红书等平台私信入站，无需外网回调。需在服务器配置{' '}
          <code className="rounded bg-muted px-1">PUBLIC_INBOX_WEBHOOK_SECRET</code>；完整 URL 与 JSON 示例见「获客指南」。
          {tenantId ? ` 租户 ID：${tenantId}` : ''}
        </p>
        <div className="space-y-2">
          <Label htmlFor="webhook-channel">渠道</Label>
          <select
            id="webhook-channel"
            value={webhookChannel}
            onChange={(e) => setWebhookChannel(e.target.value)}
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="douyin">抖音 douyin</option>
            <option value="xiaohongshu">小红书 xiaohongshu</option>
            <option value="wechat_mp">微信公众号 wechat_mp</option>
          </select>
        </div>
        {webhookTestSummary ? (
          <p className="text-xs text-green-600 dark:text-green-500">{webhookTestSummary}</p>
        ) : null}
        <Button type="button" variant="secondary" disabled={webhookTestLoading} onClick={() => void onWebhookTest()}>
          {webhookTestLoading ? '测试中…' : '发送测试 Webhook'}
        </Button>
      </div>
      ) : null}
      </>
      ) : (
        <p className="text-sm text-muted-foreground">你没有 settings:manage 权限，以上为个人外呼设置。</p>
      )}
    </div>
  )
}
