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
  Tags,
  Settings,
  QrCode,
  Sparkles,
  Gift,
  Megaphone,
  BookOpen,
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
  MessageSquare,
  Inbox,
  BookMarked,
  LifeBuoy,
} from 'lucide-react'

export type NavItemDef = {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
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
}

function pick(items: (NavItemDef | false | null | undefined)[]): NavItemDef[] {
  return items.filter(Boolean) as NavItemDef[]
}

export function buildSidebarNavGroups(ctx: SidebarNavContext): NavGroupDef[] {
  const automation = ctx.canAutomation || ctx.canAutomationManage

  return [
    {
      id: 'workspace',
      title: '工作台',
      items: pick([
        ctx.canDash && { to: '/app', end: true, icon: LayoutDashboard, label: '仪表盘' },
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
        { to: '/app/guide-templates', icon: BookOpen, label: '获客指南' },
        ctx.canCampaign && { to: '/app/campaigns', icon: Gift, label: '裂变活动' },
        ctx.canBroadcast && { to: '/app/broadcast-tasks', icon: Megaphone, label: '客户群发' },
        ctx.canBroadcast && { to: '/app/sms', icon: MessageSquare, label: '短信营销' },
        ctx.canChannel && { to: '/app/groups', icon: Users, label: '客户群' },
      ]),
    },
    {
      id: 'ai',
      title: 'AI 助手',
      collapsible: true,
      defaultOpen: false,
      items: pick([
        ctx.canAi && { to: '/app/ai-copy', icon: Sparkles, label: 'AI 文案' },
        ctx.canAi && { to: '/app/script-library', icon: MessageSquare, label: '话术库' },
        ctx.canDash && { to: '/app/ai-ops', icon: Gauge, label: 'AI 运营看板' },
        ctx.canAiReview && { to: '/app/ai-review', icon: Bot, label: 'AI 审核台' },
        ctx.canKb && { to: '/app/knowledge-base', icon: BookMarked, label: 'AI 知识库' },
      ]),
    },
    {
      id: 'reports',
      title: '数据报告',
      collapsible: true,
      defaultOpen: false,
      items: pick([
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
        ctx.showPermissionCheck && { to: '/app/permission-check', icon: KeyRound, label: '权限自检' },
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
