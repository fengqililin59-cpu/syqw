/**
 * @file 使用帮助中心：销售/管理员上手与常见问题。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Bot,
  CircleHelp,
  Sparkles,
  ClipboardList,
  LayoutGrid,
  QrCode,
  Settings,
  UserRoundCog,
  Users,
  Waypoints,
  CreditCard,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'

type TabId = 'sales' | 'admin' | 'menu' | 'faq'

const TABS: { id: TabId; label: string }[] = [
  { id: 'sales', label: '销售 3 步' },
  { id: 'admin', label: '管理员上线' },
  { id: 'menu', label: '菜单说明' },
  { id: 'faq', label: '常见问题' },
]

const SALES_STEPS = [
  {
    step: '1',
    title: '看今天要跟进的客户',
    detail: '打开「待跟进」，优先处理逾期和系统提醒的客户。',
    to: '/app/follow-ups?overdue=1',
    icon: ClipboardList,
  },
  {
    step: '2',
    title: '用 AI 写话术再联系',
    detail: '打开「AI 智能助手」，粘贴客户原话，复制推荐回复后发企微。',
    to: '/app/ai-assistant',
    icon: Sparkles,
  },
  {
    step: '3',
    title: '更新销售阶段',
    detail: '在「销售看板」把客户拖到对应列，团队都能看到进度。',
    to: '/app/customers/pipeline',
    icon: LayoutGrid,
  },
]

const ADMIN_STEPS = [
  {
    title: '配置企业微信',
    detail: '填入 CorpID、AgentID、Secret，测试连接成功后再继续。',
    to: '/app/settings',
    icon: Settings,
  },
  {
    title: '让客户进系统',
    detail: '打开「获客向导」按渠道配置；或用渠道活码扫码加好友。',
    to: '/app/acquisition-wizard',
    icon: QrCode,
  },
  {
    title: '启动 AI 员工（收件箱 + 草稿 + 跟进）',
    detail: '按向导检查企微、公域 Webhook、知识库与自动跟进。首发建议仅开 AI 草稿；FAQ/询价自动发在系统设置中按需开启。',
    to: '/app/ai-employee-playbook',
    icon: Bot,
  },
  {
    title: '配自动化流程',
    detail: '点「一键起步包」：新客欢迎 + 打标签 + 通知销售。',
    to: '/app/flows',
    icon: Waypoints,
  },
  {
    title: '配自动跟进规则',
    detail: '初始化默认规则并打开开关，日常沉默提醒靠它。',
    to: '/app/automation-rules',
    icon: Bot,
  },
  {
    title: '开销售账号',
    detail: '新建用户并分配角色，对方需重新登录才看到菜单。',
    to: '/app/users',
    icon: Users,
  },
  {
    title: '套餐与试用',
    detail: '新注册 14 天专业版试用；到期前可微信支付、兑换码或线下转账升级。',
    to: '/app/billing',
    icon: CreditCard,
  },
]

const MENU_GROUPS = [
  { group: '工作台', who: '全员', items: '仪表盘、使用帮助' },
  { group: 'AI 智能', who: '销售/运营', items: 'AI 智能助手、AI 文案、话术库、意向预警、知识库' },
  { group: '客户与跟进', who: '销售', items: '客户管理、销售看板、待跟进、收件箱、标签' },
  { group: '自动化', who: '管理员配置', items: '自动化流程、自动跟进规则、意向预警' },
  { group: '营销获客', who: '运营', items: '渠道活码、获客指南、裂变、群发' },
  { group: '系统管理', who: '管理员', items: '用户、角色、系统设置、套餐计费' },
]

const FAQ = [
  {
    q: '流程配了但没触发？',
    a: '流程需处于「已激活」状态。新客欢迎类流程要在客户通过活码或回调入库时才会触发。',
  },
  {
    q: '自动跟进和流程编排有什么区别？',
    a: '流程编排：客户刚入库或阶段变化时立刻执行（欢迎语、打标签）。自动跟进：每天定时扫描全库，发现沉默/未联系再通知销售。',
  },
  {
    q: '没收到企微自动跟进通知？',
    a: '请管理员在「自动跟进规则」页点「立即扫描一次」试跑；若仍无通知，联系运维确认服务器定时任务已开启。',
  },
  {
    q: '销售看不到某个菜单？',
    a: '管理员在「角色管理」勾选对应权限，销售重新登录后生效。',
  },
  {
    q: 'AI 会自动给客户发消息吗？',
    a: '默认不会直接发出：统一收件箱里 AI 先生成草稿，销售确认后再发。若管理员在「系统设置」开启 FAQ/询价自动发送，且平台已允许，则仅企微会话内、符合护栏的资料/简单询价可自动回复；抖音/小红书等公域仍须人工。含合同、底价、投诉等一律转人工。',
  },
  {
    q: 'AI 调用次数用完了怎么办？',
    a: '在「套餐计费 → 本月用量」查看剩余次数。可升级专业版/企业版，或选购「AI 助手版 / AI 旗舰版」获得更高 AI 配额。',
  },
  {
    q: 'AI 智能助手和 AI 文案有什么区别？',
    a: '智能助手是多轮对话，适合问跟进策略、异议处理；AI 文案专注生成朋友圈/群发/海报素材。两者都计 AI 调用次数。',
  },
  {
    q: '如何在线支付升级？',
    a: '管理员进入「套餐计费」，选择套餐后点「微信支付」扫码；支付成功后套餐自动开通。也可使用兑换码或线下转账（需平台确认）。',
  },
  {
    q: '专业版试用到期会怎样？',
    a: '到期后自动降为体验版（客户数、AI 次数、自动化等受限）。到期前 7 天会在后台顶部与计费页提醒续费。',
  },
  {
    q: '行业话术包怎么用？',
    a: '进入「话术库」顶部选择教培 / 美业 / B2B 包，一键导入后可编辑占位符（如 {机构}），在客户跟进或 AI 助手中复制使用。',
  },
  {
    q: '仪表盘「活跃提醒」是什么？',
    a: '系统根据登录、AI 用量、跟进频率等判断流失风险，管理员可在仪表盘查看；生产环境可开启每日企微推送（ENABLE_CHURN_ALERT_CRON=1）。',
  },
]

export function HelpCenterPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
  const { isPlatformAdmin } = usePlatformAdmin()
  const defaultTab = useMemo<TabId>(() => (isAdmin ? 'admin' : 'sales'), [isAdmin])
  const [tab, setTab] = useState<TabId>(defaultTab)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <CircleHelp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">使用帮助</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            3 分钟搞懂怎么用。各功能页顶部也有「这页做什么」说明；这里是一份完整速查。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? 'default' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'sales' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">销售每天 3 步（约 3 分钟）</CardTitle>
              <p className="text-sm text-muted-foreground">不用记全部菜单，按顺序点下面按钮即可。</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {SALES_STEPS.map((s) => (
                <div
                  key={s.step}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                      {s.step}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>
                    </div>
                  </div>
                  <Button type="button" size="sm" className="shrink-0 gap-1" onClick={() => navigate(s.to)}>
                    <s.icon className="h-4 w-4" />
                    去操作
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-amber-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-950">额外提醒</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-sm text-amber-900/80">
              <p>
                <Sparkles className="mr-1 inline h-4 w-4" />
                AI 智能助手：不会写话术时，先问 AI 再复制发给客户。
              </p>
              <p>
                <BellRing className="mr-1 inline h-4 w-4" />
                意向预警：客户意向突然升高时优先联系。
              </p>
              <p>收到「自动跟进」企微通知时：复制推荐话术，人工发送给客户。</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'admin' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">管理员首次上线（约 15 分钟）</CardTitle>
              <p className="text-sm text-muted-foreground">
                仪表盘也有「上线检查清单」；这里按推荐顺序列出关键步骤。
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {ADMIN_STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => navigate(s.to)}>
                    <s.icon className="h-4 w-4" />
                    去配置
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">两个「自动化」别搞混</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto pt-0">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">功能</th>
                    <th className="pb-2 pr-3 font-medium">什么时候跑</th>
                    <th className="pb-2 font-medium">典型用途</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b">
                    <td className="py-2.5 pr-3 font-medium">自动化流程</td>
                    <td className="py-2.5 pr-3">客户刚入库 / 阶段变化</td>
                    <td className="py-2.5">欢迎语、打标签、通知销售</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-medium">自动跟进规则</td>
                    <td className="py-2.5 pr-3">每天定时扫描</td>
                    <td className="py-2.5">沉默提醒、新客未联系</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {isPlatformAdmin ? (
            <Card className="border-violet-200 bg-violet-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-violet-950">
                  <Shield className="h-4 w-4" />
                  平台运营 · 收件箱 AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-sm text-violet-900/90">
                <p>首发建议全站仅开 AI 草稿；试点客户再开 FAQ/询价半自动。实施清单见仓库 docs/deploy/go-live-ai-inbox.md。</p>
                <ul className="list-inside list-disc space-y-1 text-xs">
                  <li>每日查看「AI 自动发异常」与抽检队列</li>
                  <li>风险租户在详情页一键关停并留运营备注</li>
                  <li>迁移 072～076 未跑齐时异常/抽检不可用</li>
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate('/app/platform/inbox-ai-anomalies')}>
                    AI 异常名单
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate('/app/platform')}>
                    运营概览
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate('/app/ai-review?tab=qa')}>
                    抽检队列
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-xs text-muted-foreground">
            企微回调地址示例：<code className="rounded bg-muted px-1">https://你的域名/api/v1/wework/msg-callback</code>
            ，在「系统设置」保存后可复制完整 URL。
          </p>
          <p className="text-xs text-muted-foreground">
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              服务条款
            </a>
            {' · '}
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              隐私政策
            </a>
          </p>
        </div>
      ) : null}

      {tab === 'menu' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">侧栏分组速查</CardTitle>
            <p className="text-sm text-muted-foreground">菜单按角色分组；看不到某项通常是权限未开。</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {MENU_GROUPS.map((row) => (
              <div key={row.group} className="rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900">{row.group}</span>
                  <span className="text-xs text-muted-foreground">{row.who}常用</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{row.items}</p>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => navigate('/app/roles')}>
              <UserRoundCog className="h-4 w-4" />
              去角色管理调整权限
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'faq' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">常见问题</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion defaultValue="faq-0">
              {FAQ.map((item, i) => (
                <AccordionItem key={item.q} value={`faq-${i}`}>
                  <AccordionTrigger value={`faq-${i}`} className="text-left text-sm font-medium">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent value={`faq-${i}`} className="text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
