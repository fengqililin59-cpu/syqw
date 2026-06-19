/**
 * @file 侧栏分组导航配置。
 */
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  UserRoundCog,
  Contact,
  ClipboardList,
  CheckSquare,
  Settings,
  QrCode,
  Sparkles,
  Megaphone,
  BarChart3,
  Gauge,
  ShieldCheck,
  BellRing,
  PhoneCall,
  WalletCards,
  LayoutGrid,
  Bot,
  Brain,
  MessageSquare,
  Inbox,
  BookMarked,
  CircleHelp,
  Shield,
  AlertTriangle,
  CalendarClock,
  Bell,
  FileText,
  Receipt,
} from 'lucide-react'

export type NavItemDef = {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
  badge?: string
  featured?: boolean
}

export type NavGroupDef = {
  id: string
  title: string
  hint?: string
  collapsible?: boolean
  defaultOpen?: boolean
  items: NavItemDef[]
}

export type SidebarNavContext = {
  canDash: boolean
  canUsers: boolean
  canSettings: boolean
  canCustomers: boolean
  canFollowups: boolean
  canAi: boolean
  canCampaign: boolean
  canBroadcast: boolean
  canAutomation: boolean
  canAutomationManage: boolean
  canAdsRoi: boolean
  canAudit: boolean
  canChannel: boolean
  canInbox: boolean
  canAiReview: boolean
  canKb: boolean
  canTicket: boolean
  canTransfer: boolean
  showPermissionCheck: boolean
  isPlatformAdmin?: boolean
}

function pick(items: (NavItemDef | false | null | undefined)[]): NavItemDef[] {
  return items.filter(Boolean) as NavItemDef[]
}

export function buildSidebarNavGroups(ctx: SidebarNavContext): NavGroupDef[] {
  const showAi = ctx.canAi || ctx.canDash || ctx.canCustomers

  return [
    // ── 核心演示流程（6 个必看页面，始终展开） ──
    {
      id: 'core',
      title: '核心销售流程',
      hint: '演示从这里开始',
      defaultOpen: true,
      items: pick([
        (ctx.canFollowups || ctx.canCustomers) && {
          to: '/app/follow-ups?overdue=1', icon: ClipboardList, label: '今日待跟进客户', featured: true,
        },
        ctx.canDash && {
          to: '/app/intent-alerts', icon: BellRing, label: '高意向客户列表', featured: true,
        },
        showAi && {
          to: '/app/ai-assistant', icon: Sparkles, label: 'AI 生成跟进话术', featured: true,
        },
        ctx.canCustomers && {
          to: '/app/customers/pipeline', icon: LayoutGrid, label: '客户成交阶段', featured: true,
        },
        { to: '/app/analytics', icon: BarChart3, label: '销售团队数据', featured: true },
        ctx.canDash && {
          to: '/app', end: true, icon: LayoutDashboard, label: '老板经营看板', featured: true,
        },
      ]),
    },

    // ── 更多功能（全部折叠，按需展开） ──
    {
      id: 'more',
      title: '更多功能',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        ctx.canCustomers && { to: '/app/customers', icon: Contact, label: '客户管理' },
        (ctx.canAi || ctx.canCustomers) && { to: '/app/script-library', icon: MessageSquare, label: '智能话术库' },
        showAi && { to: '/app/ai-copy', icon: Sparkles, label: 'AI 文案生成' },
        showAi && { to: '/app/ai-coach', icon: Brain, label: 'AI 教练建议' },
        ctx.canDash && { to: '/app/ai-ops', icon: Gauge, label: 'AI 运营看板' },
        (ctx.canKb || ctx.canAi) && { to: '/app/knowledge-base', icon: BookMarked, label: 'AI 知识库' },
        ctx.canInbox && { to: '/app/inbox', icon: Inbox, label: '统一收件箱' },
        ctx.canCustomers && { to: '/app/call-records', icon: PhoneCall, label: '通话记录' },
        ctx.canCustomers && { to: '/app/orders', icon: Receipt, label: '成交订单' },
        ctx.canCustomers && { to: '/app/contracts', icon: FileText, label: '合同管理' },
        ctx.canBroadcast && { to: '/app/broadcast-tasks', icon: Megaphone, label: '客户群发' },
        ctx.canChannel && { to: '/app/channel-live', icon: QrCode, label: '渠道活码' },
        ctx.canDash && { to: '/app/notifications', icon: Bell, label: '通知中心' },
        ctx.canDash && { to: '/app/tasks', icon: CheckSquare, label: '任务管理' },
        { to: '/app/help', icon: CircleHelp, label: '使用帮助' },
      ]),
    },

    // ── 系统管理 ──
    {
      id: 'admin',
      title: '系统管理',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        ctx.canUsers && { to: '/app/users', icon: Users, label: '用户管理' },
        ctx.canUsers && { to: '/app/roles', icon: UserRoundCog, label: '角色管理' },
        ctx.canSettings && { to: '/app/settings', icon: Settings, label: '系统设置' },
        ctx.canSettings && { to: '/app/billing', icon: WalletCards, label: '套餐计费' },
        ctx.canAudit && { to: '/app/audit-logs', icon: ShieldCheck, label: '审计日志' },
      ]),
    },

    // ── 平台运营（仅平台方，折叠） ──
    {
      id: 'platform',
      title: '平台运营',
      hint: '仅平台方',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        ctx.isPlatformAdmin && { to: '/app/platform', end: true, icon: Shield, label: '运营概览' },
        ctx.isPlatformAdmin && { to: '/app/platform/tenants', icon: Users, label: '租户管理' },
        ctx.isPlatformAdmin && { to: '/app/platform/inbox-ai-anomalies', icon: Bot, label: 'AI 自动发异常' },
        ctx.isPlatformAdmin && { to: '/app/platform/churn-risks', icon: AlertTriangle, label: '流失风险' },
        ctx.isPlatformAdmin && { to: '/app/platform/subscriptions/expiring', icon: CalendarClock, label: '即将到期' },
        ctx.isPlatformAdmin && { to: '/app/platform/billing', icon: WalletCards, label: '订单与兑换码' },
      ]),
    },
  ].filter((g) => g.items.length > 0)
}
