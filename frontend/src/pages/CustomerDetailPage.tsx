/**
 * @file 客户详情页：360° 客户视图，含资料卡片、跟进时间轴、企微消息、意向分析。
 * 路由：/app/customers/:id
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Building2,
  User,
  Flame,
  Snowflake,
  AlertTriangle,
  Send,
  Edit2,
  Save,
  Sparkles,
} from 'lucide-react'
import { getJson, postJson, putJson } from '@/api/client'
import { fetchTags } from '@/api/tags'
import type {
  CustomerDiscoveryProfile,
  CustomerRow,
  CustomerIntentScoreResult,
  TagRow,
  UserRow,
  WeworkChatMessage,
  Paginated,
} from '@/api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { canManageStaffUser, hasPermUser } from '@/lib/roles'
import { CustomerAiReplyPanel } from '@/components/CustomerAiReplyPanel'
import { IntentAlertPlaybookDialog } from '@/components/IntentAlertPlaybookDialog'
import { SalesCoachCard } from '@/components/SalesCoachCard'
import {
  CustomerTimelineSection,
  type TimelineItem,
  type TimelineSummary,
} from '@/components/CustomerTimelineSection'
import CallButton from '@/components/CallButton'
import SmsButton from '@/components/SmsButton'

// ─── types ────────────────────────────────────────────────────────────────────
type FollowUp = { id: number; content: string; created_at: string; type?: string }

type TimelineResponse = { list: TimelineItem[]; total: number; summary?: TimelineSummary }

// ─── constants ────────────────────────────────────────────────────────────────
const stageLabels: Record<string, string> = {
  new: '新线索',
  intent_confirm: '意向确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  lost: '流失',
  contacted: '已联系',
  intent: '有意向',
}

const stageColors: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  intent_confirm: 'bg-blue-100 text-blue-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-amber-100 text-amber-700',
  deal: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-500',
  contacted: 'bg-blue-100 text-blue-600',
  intent: 'bg-blue-100 text-blue-600',
}

const stageOptions = [
  { value: 'new', label: '新线索' },
  { value: 'intent_confirm', label: '意向确认' },
  { value: 'proposal', label: '方案报价' },
  { value: 'negotiation', label: '商务谈判' },
  { value: 'deal', label: '成交' },
  { value: 'lost', label: '流失' },
]

const followTypeLabels: Record<string, string> = {
  call: '📞 电话',
  wechat: '💬 微信',
  meeting: '🤝 拜访',
  other: '📝 备注',
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDt(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('zh-CN')
}

function intentIcon(score?: number | null) {
  const s = score ?? 0
  if (s >= 70) return <Flame className="h-4 w-4 text-orange-500" />
  if (s >= 40) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  return <Snowflake className="h-4 w-4 text-blue-400" />
}

function intentBg(score?: number | null) {
  const s = score ?? 0
  if (s >= 70) return 'bg-orange-50 border-orange-200 text-orange-700'
  if (s >= 40) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
  return 'bg-blue-50 border-blue-200 text-blue-700'
}

// ─── component ────────────────────────────────────────────────────────────────
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)

  const canEdit = hasPermUser(permissions, 'customer:edit')
  const canManageUsers = canManageStaffUser(permissions)
  const canAi = hasPermUser(permissions, 'ai:use')

  // ── data ──
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [fuLoading, setFuLoading] = useState(false)

  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [timelineSummary, setTimelineSummary] = useState<TimelineSummary | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  const [chatMsgs, setChatMsgs] = useState<WeworkChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  const [scoreResult, setScoreResult] = useState<CustomerIntentScoreResult | null>(null)
  const [scoreLoading, setScoreLoading] = useState(false)

  // ── tabs ──
  const [activeTab, setActiveTab] = useState<'timeline' | 'followups' | 'messages' | 'intent' | 'products'>('timeline')

  // ── quick follow-up ──
  const [fuContent, setFuContent] = useState('')
  const [fuType, setFuType] = useState('other')
  const [fuSaving, setFuSaving] = useState(false)

  // ── AI 话术生成 ──
  const [fuScripts, setFuScripts] = useState<string[]>([])
  const [fuScriptLoading, setFuScriptLoading] = useState(false)
  const [fuScriptOpen, setFuScriptOpen] = useState(false)

  // ── AI 客户画像摘要 ──
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

  // ── edit dialog ──
  const [editOpen, setEditOpen] = useState(false)
  const [allTags, setAllTags] = useState<TagRow[]>([])
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editWechatId, setEditWechatId] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editSource, setEditSource] = useState('')
  const [editStage, setEditStage] = useState('new')
  const [editRemark, setEditRemark] = useState('')
  const [editOwnerId, setEditOwnerId] = useState('')
  const [editTagIds, setEditTagIds] = useState<number[]>([])
  const [editSaving, setEditSaving] = useState(false)

  const [discovery, setDiscovery] = useState<CustomerDiscoveryProfile>({})
  const [discoverySaving, setDiscoverySaving] = useState(false)

  const [playbookOpen, setPlaybookOpen] = useState(false)
  const [discoverySaved, setDiscoverySaved] = useState(false)

  function applyDiscoveryFromCustomer(row: CustomerRow) {
    const p = row.discovery_profile
    setDiscovery({
      budget: p?.budget ?? '',
      decision_timeline: p?.decision_timeline ?? '',
      pain_points: p?.pain_points ?? '',
      product_interest: p?.product_interest ?? '',
      decision_maker: p?.decision_maker ?? '',
      next_step: p?.next_step ?? '',
    })
  }

  // ─── load ─────────────────────────────────────────────────────────────────
  const loadCustomer = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getJson<CustomerRow>(`/customers/${id}`)
      setCustomer(data)
      applyDiscoveryFromCustomer(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  // ─── AI 客户画像摘要 ──────────────────────────────────────────────────────────
  const loadAiSummary = useCallback(async () => {
    if (!id || !canAi) return
    setAiSummaryLoading(true)
    try {
      const data = await getJson<{ summary: string; stage: string; intent_score: number }>(`/customers/${id}/summary`)
      setAiSummary(data.summary || null)
    } catch {
      setAiSummary(null)
    } finally {
      setAiSummaryLoading(false)
    }
  }, [id, canAi])

  const loadTimeline = useCallback(async () => {
    if (!id) return
    setTimelineLoading(true)
    try {
      const data = await getJson<TimelineResponse>(`/customers/${id}/timeline?limit=120`)
      setTimeline(data.list ?? [])
      setTimelineSummary(data.summary ?? null)
    } finally {
      setTimelineLoading(false)
    }
  }, [id])

  const loadFollowUps = useCallback(async () => {
    if (!id) return
    setFuLoading(true)
    try {
      const rows = await getJson<FollowUp[]>(`/customers/${id}/follow-ups`)
      setFollowUps(rows)
    } finally {
      setFuLoading(false)
    }
  }, [id])

  const loadMessages = useCallback(async () => {
    if (!id) return
    setChatLoading(true)
    try {
      const rows = await getJson<WeworkChatMessage[]>(`/customers/${id}/messages`)
      setChatMsgs(rows)
    } finally {
      setChatLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadCustomer()
    void loadTimeline()
    void loadFollowUps()
    void loadAiSummary()
  }, [loadCustomer, loadTimeline, loadFollowUps, loadAiSummary])

  useEffect(() => {
    if (activeTab === 'messages' && chatMsgs.length === 0) {
      void loadMessages()
    }
  }, [activeTab, chatMsgs.length, loadMessages])

  // ─── quick follow-up ──────────────────────────────────────────────────────
  async function handleSaveDiscovery() {
    if (!id || !canEdit) return
    setDiscoverySaving(true)
    setDiscoverySaved(false)
    try {
      const profile: CustomerDiscoveryProfile = {
        budget: discovery.budget?.trim() || null,
        decision_timeline: discovery.decision_timeline?.trim() || null,
        pain_points: discovery.pain_points?.trim() || null,
        product_interest: discovery.product_interest?.trim() || null,
        decision_maker: discovery.decision_maker?.trim() || null,
        next_step: discovery.next_step?.trim() || null,
      }
      const hasAny = Object.values(profile).some((v) => v)
      await putJson(`/customers/${id}`, { discovery_profile: hasAny ? profile : null })
      setDiscoverySaved(true)
      await loadCustomer()
    } finally {
      setDiscoverySaving(false)
    }
  }

  async function handleAddFollowUp() {
    if (!id || !fuContent.trim()) return
    setFuSaving(true)
    try {
      await postJson(`/customers/${id}/follow-ups`, { type: fuType, content: fuContent.trim() })
      setFuContent('')
      await loadFollowUps()
      await loadTimeline()
    } finally {
      setFuSaving(false)
    }
  }

  // ─── AI 生成跟进话术 ─────────────────────────────────────────────────────────
  async function handleGenerateScripts() {
    if (!id) return
    setFuScriptLoading(true)
    setFuScriptOpen(true)
    try {
      const res = await postJson<{ scripts: string[] }>(`/customers/${id}/followup-scripts`, {})
      setFuScripts(res.scripts || [])
    } catch {
      setFuScripts([])
    } finally {
      setFuScriptLoading(false)
    }
  }

  function applyScript(text: string) {
    setFuContent(text)
    setFuScriptOpen(false)
  }

  // ─── 一键快速跟进（从成交副驾卡触发）────────────────────────────────────────
  async function handleQuickFollowUp() {
    if (!id || !canEdit) return
    // 1. 生成 AI 话术
    setFuScriptLoading(true)
    try {
      const res = await postJson<{ scripts: string[] }>(`/customers/${id}/followup-scripts`, {})
      const scripts = res.scripts || []
      if (scripts.length > 0) {
        // 2. 选择第一个话术（最相关的）
        setFuContent(scripts[0])
      }
    } catch (e) {
      console.error('生成话术失败:', e)
    } finally {
      setFuScriptLoading(false)
    }
    // 3. 切换到跟进记录标签页
    setActiveTab('followups')
  }

  // ─── score intent ─────────────────────────────────────────────────────────
  async function handleScoreIntent() {
    if (!id) return
    setScoreLoading(true)
    try {
      const res = await postJson<CustomerIntentScoreResult>(`/customers/${id}/score-intent`, { force: true })
      setScoreResult(res)
      // Refresh customer to get updated score
      await loadCustomer()
    } finally {
      setScoreLoading(false)
    }
  }

  // ─── edit ─────────────────────────────────────────────────────────────────
  async function openEdit() {
    if (!customer) return
    const [tagRows, userRes] = await Promise.all([
      fetchTags(),
      getJson<Paginated<UserRow>>('/users?page=1&size=200'),
    ])
    setAllTags(tagRows)
    setAllUsers(userRes.list)
    setEditName(customer.name ?? '')
    setEditPhone(customer.phone ?? '')
    setEditWechatId(customer.wechat_id ?? '')
    setEditCompany(customer.company ?? '')
    setEditPosition((customer as CustomerRow & { position?: string }).position ?? '')
    setEditSource(customer.source ?? '')
    setEditStage(customer.stage)
    setEditRemark(customer.remark ?? '')
    setEditOwnerId(customer.owner_id ? String(customer.owner_id) : '')
    setEditTagIds((customer.tags ?? []).map((t) => t.id))
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!id) return
    setEditSaving(true)
    try {
      const saved = await putJson<CustomerRow>(`/customers/${id}`, {
        name: editName || null,
        phone: editPhone || null,
        wechat_id: editWechatId || null,
        company: editCompany || null,
        position: editPosition || null,
        source: editSource || null,
        stage: editStage,
        remark: editRemark || null,
        owner_id: editOwnerId ? Number(editOwnerId) : undefined,
      })
      await putJson(`/customers/${id}/tags`, { tag_ids: editTagIds })
      setEditOpen(false)
      await loadCustomer()
      if (saved.inbox_threads_synced && saved.inbox_threads_synced > 0) {
        window.alert(`已同步 ${saved.inbox_threads_synced} 个收件箱会话的销售阶段`)
      }
    } finally {
      setEditSaving(false)
    }
  }

  function toggleEditTag(tagId: number) {
    setEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((x) => x !== tagId) : [...prev, tagId]
    )
  }

  // ─── render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/customers')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回列表
        </Button>
        <p className="text-red-500">{error ?? '客户不存在'}</p>
      </div>
    )
  }

  const stageLabel = stageLabels[customer.stage] ?? customer.stage
  const stageColor = stageColors[customer.stage] ?? 'bg-slate-100 text-slate-600'

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {/* ── 顶部导航 ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/customers')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          客户列表
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{customer.name || customer.phone || `#${customer.id}`}</span>
      </div>

      {/* ── 主标题卡 ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* 左：姓名 + 基础信息 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {customer.name || customer.phone || `客户 #${customer.id}`}
                </h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColor}`}>
                  {stageLabel}
                </span>
                <Link
                  to={`/app/inbox?customer_id=${customer.id}`}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
                >
                  收件箱
                </Link>
                {customer.intent_score != null && (
                  <span
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${intentBg(customer.intent_score)}`}
                  >
                    {intentIcon(customer.intent_score)}
                    意向 {customer.intent_score}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {customer.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {customer.company}
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.phone}
                  </span>
                )}
                {customer.owner && (
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {customer.owner.real_name || customer.owner.username}
                  </span>
                )}
              </div>

              {/* 标签 */}
              {(customer.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {customer.tags!.map((t) => (
                    <Badge
                      key={t.id}
                      variant="secondary"
                      style={t.color ? { backgroundColor: t.color + '22', color: t.color } : {}}
                      className="text-xs"
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 右：操作按钮 */}
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => void openEdit()}>
                  <Edit2 className="mr-1 h-3.5 w-3.5" />
                  编辑资料
                </Button>
              )}
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/app/inbox?customer_id=${customer.id}`}>统一收件箱</Link>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/app/service-desk?customer_id=${customer.id}`}>服务台</Link>
              </Button>
              {customer.phone && (
                <CallButton
                  customerId={customer.id}
                  customerName={customer.name || `客户 #${customer.id}`}
                  customerPhone={customer.phone}
                />
              )}
              {customer.phone && (
                <SmsButton
                  customerId={customer.id}
                  customerName={customer.name || `客户 #${customer.id}`}
                  customerPhone={customer.phone}
                />
              )}
              {(customer.intent_score ?? 0) >= 65 ? (
                <Button size="sm" onClick={() => setPlaybookOpen(true)}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  跟进助手
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {(customer.intent_score ?? 0) >= 70 ? (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50/80 to-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-semibold text-violet-950">高意向客户 · 建议今日跟进</p>
              <p className="text-xs text-violet-900/75">
                一键匹配话术库并生成 AI 跟进文案，复制后即可在企微发送。
              </p>
            </div>
            <Button size="sm" onClick={() => setPlaybookOpen(true)}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              打开跟进助手
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── AI 客户画像摘要 ── */}
      {canAi && (
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-white shadow-sm">
          <CardContent className="py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                {aiSummaryLoading ? (
                  <p className="text-sm text-muted-foreground animate-pulse">AI 正在分析客户画像...</p>
                ) : aiSummary ? (
                  <p className="text-sm leading-relaxed text-indigo-950">{aiSummary}</p>
                ) : null}
              </div>
              {aiSummary && !aiSummaryLoading && (
                <button
                  type="button"
                  onClick={() => void loadAiSummary()}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-indigo-500 hover:bg-indigo-100 transition-colors"
                  title="重新生成"
                >
                  刷新
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 内容区：左侧信息 + 右侧活动流 ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* ── 左：信息卡片 ── */}
        <div className="space-y-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="手机" value={customer.phone} />
              <InfoRow label="微信" value={customer.wechat_id} />
              <InfoRow label="公司" value={customer.company} />
              <InfoRow label="来源" value={customer.source} />
              <InfoRow label="跟进人" value={customer.owner?.real_name || customer.owner?.username} />
              <InfoRow label="创建时间" value={fmtDate(customer.created_at)} />
              <InfoRow label="最近联系" value={fmtDate(customer.last_contact_at)} />
              {customer.remark && (
                <div>
                  <p className="mb-0.5 text-xs text-muted-foreground">备注</p>
                  <p className="whitespace-pre-wrap rounded-md bg-muted px-2 py-1.5 text-xs leading-relaxed">
                    {customer.remark}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">需求探索登记</CardTitle>
              {customer.discovery_completeness_percent != null ? (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>完整度 {customer.discovery_completeness_percent}%</span>
                    <span>
                      {customer.discovery_fields_filled ?? 0}/{customer.discovery_fields_total ?? 6} 项
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${customer.discovery_ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${customer.discovery_completeness_percent}%` }}
                    />
                  </div>
                  {!customer.discovery_ready && customer.discovery_missing_labels?.length ? (
                    <p className="text-[11px] text-muted-foreground">
                      待填：{customer.discovery_missing_labels.slice(0, 3).join('、')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">
                首次沟通时记录预算、决策周期、痛点与下一步，便于方案报价与谈判。
              </p>
              {(
                [
                  { key: 'budget' as const, label: '预算范围', placeholder: '如 5–10 万/年' },
                  { key: 'decision_timeline' as const, label: '决策周期', placeholder: '如 本月内立项' },
                  { key: 'decision_maker' as const, label: '决策人', placeholder: '姓名/职位' },
                  { key: 'product_interest' as const, label: '关注产品', placeholder: 'SKU 或套餐' },
                ] as const
              ).map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={discovery[f.key] ?? ''}
                    onChange={(e) => setDiscovery((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    disabled={!canEdit}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">痛点与诉求</Label>
                <Textarea
                  value={discovery.pain_points ?? ''}
                  onChange={(e) => setDiscovery((prev) => ({ ...prev, pain_points: e.target.value }))}
                  placeholder="客户最关心解决的问题…"
                  disabled={!canEdit}
                  className="min-h-[64px] resize-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">下一步计划</Label>
                <Textarea
                  value={discovery.next_step ?? ''}
                  onChange={(e) => setDiscovery((prev) => ({ ...prev, next_step: e.target.value }))}
                  placeholder="如约演示、发方案、报价…"
                  disabled={!canEdit}
                  className="min-h-[48px] resize-none text-xs"
                />
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={discoverySaving}
                  onClick={() => void handleSaveDiscovery()}
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {discoverySaving ? '保存中…' : '保存需求登记'}
                </Button>
              ) : null}
              {discoverySaved ? (
                <p className="text-center text-xs text-green-600">已保存</p>
              ) : null}
            </CardContent>
          </Card>

          {/* 成交副驾卡 */}
          {customer.intent_score != null && id && (
            <SalesCoachCard
              customerId={Number(id)}
              intentScore={customer.intent_score}
              intentTier={customer.intent_tier}
              intentStageLabel={customer.intent_stage_label}
              intentsScoreDetail={customer.intent_score_detail}
              churnRiskAlert={customer.churn_risk_alert}
              conversionRateEstimate={customer.conversion_rate_estimate}
              onQuickFollowUp={handleQuickFollowUp}
            />
          )}
        </div>

        {/* ── 右：选项卡区域 ── */}
        <div className="space-y-4">
          {/* Tab 导航 */}
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {(
              [
                { key: 'timeline', label: `全渠道时间线 (${timeline.length})` },
                { key: 'followups', label: `跟进记录 (${followUps.length})` },
                { key: 'messages', label: '企微消息' },
                { key: 'intent', label: '意向分析' },
                { key: 'products', label: '🏦 产品匹配' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: 全渠道时间线 ── */}
          {activeTab === 'timeline' && id ? (
            <CustomerTimelineSection
              items={timeline}
              summary={timelineSummary}
              loading={timelineLoading}
              customerId={id}
            />
          ) : null}

          {/* ── Tab: 跟进记录 ── */}
          {activeTab === 'followups' && (
            <div className="space-y-3">
              {/* 快速添加 */}
              {canEdit && (
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex gap-2">
                      {(['other', 'call', 'wechat', 'meeting'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setFuType(t)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            fuType === t
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {followTypeLabels[t]}
                        </button>
                      ))}
                      {canAi && (
                        <button
                          type="button"
                          onClick={() => void handleGenerateScripts()}
                          disabled={fuScriptLoading}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 transition-all disabled:opacity-50"
                        >
                          <Sparkles className="mr-1 inline h-3 w-3" />
                          {fuScriptLoading ? '生成中...' : 'AI话术'}
                        </button>
                      )}
                    </div>
                    {/* AI 话术气泡 */}
                    {fuScriptOpen && (
                      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                        <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> AI 生成的话术（点击使用）
                        </p>
                        {fuScriptLoading ? (
                          <p className="text-xs text-muted-foreground animate-pulse">正在生成个性化话术...</p>
                        ) : fuScripts.length === 0 ? (
                          <p className="text-xs text-muted-foreground">生成失败，请重试</p>
                        ) : (
                          fuScripts.map((s, i) => {
                            const badges = ['关怀型', '价值型', '促成型']
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => applyScript(s)}
                                className="block w-full text-left rounded-md border border-violet-100 bg-white p-2.5 text-sm leading-relaxed hover:border-violet-300 hover:shadow-sm transition-all"
                              >
                                <span className="inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 mr-1.5">
                                  {badges[i]}
                                </span>
                                {s}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                    <Textarea
                      placeholder="记录跟进内容..."
                      value={fuContent}
                      onChange={(e) => setFuContent(e.target.value)}
                      className="min-h-[72px] resize-none text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!fuContent.trim() || fuSaving}
                        onClick={() => void handleAddFollowUp()}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" />
                        {fuSaving ? '保存中...' : '添加跟进'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 时间轴 */}
              {fuLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
              ) : followUps.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">暂无跟进记录</p>
              ) : (
                <div className="relative space-y-0 pl-5">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                  {followUps.map((fu) => (
                    <div key={fu.id} className="relative pb-5">
                      <div className="absolute -left-3 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                      <div className="rounded-xl border bg-card p-3.5 shadow-sm">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {fu.type ? (followTypeLabels[fu.type] ?? fu.type) : '📝 备注'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtDt(fu.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{fu.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: 企微消息 ── */}
          {activeTab === 'messages' && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                {canAi && id ? (
                  <div id="customer-ai-panel">
                    <CustomerAiReplyPanel
                      customerId={Number(id)}
                      lastCustomerMessage={
                        [...chatMsgs].reverse().find((m) => m.direction === 'customer')?.content || null
                      }
                    />
                  </div>
                ) : null}
                {chatLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
                ) : chatMsgs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    暂无企微消息记录（需配置会话存档回调）
                  </p>
                ) : (
                  <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
                    {chatMsgs.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'staff' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm ${
                            msg.direction === 'staff'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="leading-relaxed">{msg.content || `[${msg.msg_type}]`}</p>
                          <p
                            className={`mt-1 text-right text-[10px] ${
                              msg.direction === 'staff' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}
                          >
                            {fmtDt(msg.msg_time)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Tab: 意向分析 ── */}
          {activeTab === 'intent' && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">综合意向分</p>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-4xl font-bold">
                        {scoreResult?.intent_score ?? customer.intent_score ?? '—'}
                      </span>
                      <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
                    </div>
                    {(scoreResult ?? customer).intent_stage_label && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(scoreResult ?? customer).intent_stage_label}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleScoreIntent()}
                    disabled={scoreLoading}
                  >
                    {scoreLoading ? '分析中...' : '重新评分'}
                  </Button>
                </div>

                {(scoreResult ?? customer).intent_score != null && (
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${scoreResult?.intent_score ?? customer.intent_score}%`,
                        background:
                          (scoreResult?.intent_score ?? customer.intent_score ?? 0) >= 70
                            ? '#f97316'
                            : (scoreResult?.intent_score ?? customer.intent_score ?? 0) >= 40
                            ? '#eab308'
                            : '#60a5fa',
                      }}
                    />
                  </div>
                )}

                {(scoreResult?.advice || scoreResult?.ai_reason) && (
                  <div className="rounded-xl bg-muted p-4 text-sm leading-relaxed space-y-2">
                    {scoreResult.advice && <p>{scoreResult.advice}</p>}
                    {scoreResult.ai_reason && (
                      <p className="text-muted-foreground">{scoreResult.ai_reason}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: '规则分', value: scoreResult?.intent_rule_score ?? customer.intent_rule_score },
                    { label: 'AI 分', value: scoreResult?.intent_ai_score ?? customer.intent_ai_score },
                    { label: '置信度', value: (scoreResult ?? customer).intent_confidence },
                    { label: '跟进次数', value: customer.followup_count },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-0.5 font-semibold">{item.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── 编辑对话框 ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑客户资料</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">姓名</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="客户姓名" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">手机</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="手机号码" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">微信号</Label>
                <Input value={editWechatId} onChange={(e) => setEditWechatId(e.target.value)} placeholder="微信 ID" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">公司</Label>
                <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="所属公司" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">职位</Label>
                <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} placeholder="职位" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">来源</Label>
                <Input value={editSource} onChange={(e) => setEditSource(e.target.value)} placeholder="客户来源" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">阶段</Label>
              <select
                value={editStage}
                onChange={(e) => setEditStage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {stageOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                保存后将同步关联的收件箱会话阶段（见「收件箱」）。
              </p>
            </div>
            {canManageUsers && allUsers.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">负责销售</Label>
                <select
                  value={editOwnerId}
                  onChange={(e) => setEditOwnerId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— 不指定 —</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.real_name || u.username}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">备注</Label>
              <Textarea
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                className="min-h-[72px] resize-none text-sm"
                placeholder="备注信息..."
              />
            </div>
            {allTags.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">标签</Label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleEditTag(t.id)}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors border ${
                        editTagIds.includes(t.id)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-input hover:border-primary'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              取消
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={editSaving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {editSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IntentAlertPlaybookDialog
        customerId={customer.id}
        open={playbookOpen}
        onOpenChange={setPlaybookOpen}
      />
    </div>
  )
}

// ─── 小工具组件 ───────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}
