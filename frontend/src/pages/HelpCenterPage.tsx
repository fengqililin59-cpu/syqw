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
  ClipboardList,
  Contact,
  LayoutGrid,
  QrCode,
  Settings,
  UserRoundCog,
  Users,
  Waypoints,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'

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
    title: '查资料、记跟进',
    detail: '在「客户管理」查看联系方式、历史跟进和聊天记录。',
    to: '/app/customers',
    icon: Contact,
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
    detail: '用渠道活码扫码加好友，或 Excel 批量导入历史客户。',
    to: '/app/channel-live',
    icon: QrCode,
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
]

const MENU_GROUPS = [
  { group: '工作台', who: '全员', items: '仪表盘、使用帮助' },
  { group: '客户与跟进', who: '销售', items: '客户管理、销售看板、待跟进、收件箱、标签' },
  { group: '自动化', who: '管理员配置', items: '自动化流程、自动跟进规则、意向预警' },
  { group: '营销获客', who: '运营', items: '渠道活码、获客指南、裂变、群发' },
  { group: '系统管理', who: '管理员', items: '用户、角色、系统设置' },
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
    a: '不会。收件箱里的 AI 只生成草稿，必须人工确认后再发送，避免误发。',
  },
]

export function HelpCenterPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
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

          <p className="text-xs text-muted-foreground">
            企微回调地址示例：<code className="rounded bg-muted px-1">https://你的域名/api/v1/wework/msg-callback</code>
            ，在「系统设置」保存后可复制完整 URL。
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
