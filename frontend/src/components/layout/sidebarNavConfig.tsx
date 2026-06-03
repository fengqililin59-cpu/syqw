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
  Tags,
  Settings,
  QrCode,
  Sparkles,
  Gift,
  Megaphone,
  BookOpen,
  Rocket,
  Waypoints,
  BarChart3,
  ChartNoAxesCombined,
  Gauge,
  ShieldCheck,
  KeyRound,
  BellRing,
  ArrowRightLeft,
  PhoneCall,
  WalletCards,
  LayoutGrid,
  Bot,
  Brain,
  MessageSquare,
  Inbox,
  BookMarked,
  LifeBuoy,
  CircleHelp,
  Shield,
  AlertTriangle,
  CalendarClock,
  Bell,
  ClipboardCheck,
  FileCheck,
  FileText,
  Package,
  Receipt,
  HeartHandshake,
  Headphones,
  Activity,
  Send,
  FileEdit,
  TrendingUp,
  BellDot,
  Globe,
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
  const automation = ctx.canAutomation || ctx.canAutomationManage
  const showAi = ctx.canAi || ctx.canDash || ctx.canCustomers

  return [
    {
      id: 'workspace',
      title: '工作台',
      items: pick([
        ctx.canDash && { to: '/app', end: true, icon: LayoutDashboard, label: '仪表盘' },
        ctx.canDash && { to: '/app/notifications', icon: Bell, label: '通知中心', badge: 'NEW' },
        ctx.canDash && { to: '/app/notification-rules', icon: BellDot, label: '智能通知规则', badge: 'NEW' },
        ctx.canDash && { to: '/app/approvals', icon: ClipboardCheck, label: '审批中心', badge: 'NEW' },
        ctx.canDash && { to: '/app/approval-templates', icon: FileCheck, label: '审批模板', badge: 'NEW' },
        ctx.canDash && { to: '/app/employee-activity', icon: Activity, label: '员工活动', badge: 'NEW' },
        ctx.canDash && { to: '/app/tasks', icon: CheckSquare, label: '任务管理', badge: 'NEW' },
        { to: '/app/help', icon: CircleHelp, label: '使用帮助' },
      ]),
    },
    {
      id: 'ai-smart',
      title: 'AI 智能',
      hint: '站内对话 · 按次计费',
      defaultOpen: true,
      items: pick([
        showAi && { to: '/app/ai-employee-playbook', icon: Bot, label: 'AI 员工启动', featured: true, badge: '向导' },
        showAi && { to: '/app/ai-coach', icon: Brain, label: 'AI 教练建议', badge: 'NEW' },
        showAi && { to: '/app/ai-assistant', icon: Bot, label: 'AI 智能助手', featured: true, badge: 'NEW' },
        showAi && { to: '/app/ai-copy', icon: Sparkles, label: 'AI 文案生成' },
        (ctx.canAi || ctx.canCustomers) && { to: '/app/script-library', icon: MessageSquare, label: '智能话术库' },
        ctx.canDash && { to: '/app/intent-alerts', icon: BellRing, label: 'AI 意向预警' },
        (ctx.canKb || ctx.canAi) && { to: '/app/knowledge-base', icon: BookMarked, label: 'AI 知识库' },
        ctx.canDash && { to: '/app/ai-ops', icon: Gauge, label: 'AI 运营看板' },
        ctx.canAiReview && { to: '/app/ai-review', icon: ShieldCheck, label: 'AI 审核台' },
        ctx.canDash && { to: '/app/ai-cs', icon: Headphones, label: 'AI 客服监控', badge: 'NEW' },
      ]),
    },
    {
      id: 'customers',
      title: '客户与跟进',
      hint: '销售日常最常用',
      defaultOpen: true,
      items: pick([
        ctx.canCustomers && { to: '/app/customers', icon: Contact, label: '客户管理' },
        ctx.canCustomers && { to: '/app/customers/pipeline', icon: LayoutGrid, label: '销售看板' },
        ctx.canFollowups && { to: '/app/follow-ups', icon: ClipboardList, label: '待跟进' },
        ctx.canInbox && { to: '/app/inbox', icon: Inbox, label: '统一收件箱' },
        ctx.canTicket && { to: '/app/service-desk', icon: LifeBuoy, label: '服务台' },
        ctx.canCustomers && { to: '/app/call-records', icon: PhoneCall, label: '通话记录' },
        ctx.canCustomers && { to: '/app/tags', icon: Tags, label: '客户标签' },
        ctx.canCustomers && { to: '/app/products', icon: Package, label: '产品目录', badge: 'NEW' },
        ctx.canCustomers && { to: '/app/orders', icon: Receipt, label: '成交订单', badge: 'NEW' },
        ctx.canCustomers && { to: '/app/contracts', icon: FileText, label: '合同管理', badge: 'NEW' },
        ctx.canCustomers && { to: '/app/customer-segments', icon: Sparkles, label: '客户分群', badge: 'NEW' },
        ctx.canTicket && { to: '/app/kb-articles', icon: BookMarked, label: '知识库管理', badge: 'NEW' },
      ]),
    },
    {
      id: 'automation',
      title: '自动化',
      hint: '新客欢迎 / 沉默提醒',
      defaultOpen: true,
      items: pick([
        automation && { to: '/app/flows', icon: Waypoints, label: '自动化流程' },
        automation && { to: '/app/automation-rules', icon: Bot, label: '自动跟进规则' },
        ctx.canDash && { to: '/app/intent-alerts', icon: BellRing, label: '意向预警' },
      ]),
    },
    {
      id: 'marketing',
      title: '营销获客',
      items: pick([
        ctx.canChannel && { to: '/app/channel-live', icon: QrCode, label: '渠道活码' },
        { to: '/app/acquisition-wizard', icon: Rocket, label: '获客向导' },
        { to: '/app/guide-templates', icon: BookOpen, label: '获客指南' },
        ctx.canCampaign && { to: '/app/campaigns', icon: Gift, label: '裂变活动' },
        ctx.canCampaign && { to: '/app/referrals', icon: HeartHandshake, label: '转介绍管理', badge: 'NEW' },
        ctx.canBroadcast && { to: '/app/broadcast-tasks', icon: Megaphone, label: '客户群发' },
        ctx.canBroadcast && { to: '/app/sms', icon: MessageSquare, label: '短信营销' },
        ctx.canBroadcast && { to: '/app/marketing-campaigns', icon: Send, label: '营销活动', badge: 'NEW' },
        ctx.canBroadcast && { to: '/app/message-templates', icon: FileEdit, label: '消息模板', badge: 'NEW' },
        ctx.canDash && { to: '/app/marketing-dashboard', icon: TrendingUp, label: '营销看板', badge: 'NEW' },
        ctx.canChannel && { to: '/app/landing-pages', icon: Globe, label: '落地页', badge: 'NEW' },
        ctx.canChannel && { to: '/app/groups', icon: Users, label: '客户群' },
      ]),
    },
    {
      id: 'reports',
      title: '数据报告',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        { to: '/app/analytics', icon: BarChart3, label: '销售分析', badge: 'NEW' },
        (ctx.canChannel || ctx.canDash) && { to: '/app/channel-report', icon: BarChart3, label: '渠道分析' },
        ctx.canAdsRoi && { to: '/app/ads-roi', icon: ChartNoAxesCombined, label: '广告 ROI' },
      ]),
    },
    {
      id: 'advanced',
      title: '高级功能',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        ctx.canTransfer && { to: '/app/transfers', icon: ArrowRightLeft, label: '客户转移' },
        ctx.canCampaign && { to: '/app/migration', icon: ArrowRightLeft, label: '客户迁移' },
        ctx.canAudit && { to: '/app/audit-logs', icon: ShieldCheck, label: '审计日志' },
        ctx.canSettings && { to: '/app/custom-fields', icon: Settings, label: '自定义字段', badge: 'NEW' },
        ctx.canSettings && { to: '/app/pipeline-settings', icon: LayoutGrid, label: '管道配置', badge: 'NEW' },
        ctx.canSettings && { to: '/app/dashboard-layout', icon: LayoutDashboard, label: '仪表盘布局', badge: 'NEW' },
        ctx.showPermissionCheck && { to: '/app/permission-check', icon: KeyRound, label: '权限自检' },
      ]),
    },
    {
      id: 'platform',
      title: '平台运营',
      hint: '仅平台方',
      defaultOpen: true,
      items: pick([
        ctx.isPlatformAdmin && { to: '/app/platform', end: true, icon: Shield, label: '运营概览' },
        ctx.isPlatformAdmin && { to: '/app/platform/tenants', icon: Users, label: '租户管理' },
        ctx.isPlatformAdmin && { to: '/app/platform/inbox-ai-anomalies', icon: Bot, label: 'AI 自动发异常' },
        ctx.isPlatformAdmin && { to: '/app/platform/churn-risks', icon: AlertTriangle, label: '流失风险' },
        ctx.isPlatformAdmin && {
          to: '/app/platform/subscriptions/expiring',
          icon: CalendarClock,
          label: '即将到期',
        },
        ctx.isPlatformAdmin && { to: '/app/platform/billing', icon: WalletCards, label: '订单与兑换码' },
      ]),
    },
    {
      id: 'admin',
      title: '系统管理',
      hint: '管理员配置',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        ctx.canUsers && { to: '/app/users', icon: Users, label: '用户管理' },
        ctx.canUsers && { to: '/app/roles', icon: UserRoundCog, label: '角色管理' },
        ctx.canSettings && { to: '/app/settings', icon: Settings, label: '系统设置' },
        ctx.canSettings && { to: '/app/billing', icon: WalletCards, label: '套餐计费' },
      ]),
    },
  ].filter((g) => g.items.length > 0)
}
