/**
 * @file 后台主布局：侧栏导航 + 顶栏（租户信息、退出登录）。
 */
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  Settings,
  Megaphone,
  Users,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { canManageStaffUser } from '@/lib/roles'
import ZhiFlowLogo from '@/components/ZhiFlowLogo'
import DemoBanner from '@/components/DemoBanner'
import { SidebarNavSections } from '@/components/layout/SidebarNavSections'

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tenantName, user, clear, permissions, hasPerm } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const canUsers = canManageStaffUser(permissions)
  const canSettings = hasPerm('settings:manage')
  const canCustomers = hasPerm('customer:view')
  const canFollowups = hasPerm('customer:view')
  const canAi = hasPerm('ai:use')
  const canCampaign = hasPerm('campaign:view')
  const canBroadcast = hasPerm('broadcast:view')
  const canAutomation = hasPerm('automation:view')
  const canAutomationManage = hasPerm('automation:manage')
  const canDash = hasPerm('dashboard:view')
  const canAdsRoi = hasPerm('ads:view') || hasPerm('dashboard:view')
  const canAudit = hasPerm('audit:view')
  const canChannel = hasPerm('channel:view')
  const canInbox = hasPerm('inbox:view') || hasPerm('customer:view')
  const canAiReview = hasPerm('ai:approve') || hasPerm('ai:use')
  const canKb = hasPerm('inbox:manage') || hasPerm('ai:use')
  const canTicket = hasPerm('ticket:view') || hasPerm('customer:view')
  const canTransfer = hasPerm('user:manage')

  const sidebarCtx = useMemo(
    () => ({
      canDash,
      canUsers,
      canSettings,
      canCustomers,
      canFollowups,
      canAi,
      canCampaign,
      canBroadcast,
      canAutomation,
      canAutomationManage,
      canAdsRoi,
      canAudit,
      canChannel,
      canInbox,
      canAiReview,
      canKb,
      canTicket,
      canTransfer,
      showPermissionCheck: Boolean(user),
    }),
    [
      canDash,
      canUsers,
      canSettings,
      canCustomers,
      canFollowups,
      canAi,
      canCampaign,
      canBroadcast,
      canAutomation,
      canAutomationManage,
      canAdsRoi,
      canAudit,
      canChannel,
      canInbox,
      canAiReview,
      canKb,
      canTicket,
      canTransfer,
      user,
    ],
  )

  function onLogout() {
    clear()
    navigate('/login', { replace: true })
  }

  const PAGE_TITLES: Record<string, string> = useMemo(
    () => ({
      '/app': '数据概览',
      '/app/customers': '客户管理',
      '/app/customers/pipeline': '销售看板',
      '/app/automation-rules': '自动跟进',
      '/app/call-records': '通话记录',
      '/app/follow-ups': '待跟进',
      '/app/broadcast-tasks': '群发工具',
      '/app/sms': '短信营销',
      '/app/script-library': '话术库',
      '/app/campaigns': '裂变活动',
      '/app/flows': '自动化流程',
      '/app/flow-builder': '流程编辑',
      '/app/channel-live': '渠道活码',
      '/app/groups': '客户群',
      '/app/settings': '系统设置',
      '/app/billing': '套餐计费',
      '/app/audit-logs': '审计日志',
      '/app/intent-alerts': '意向预警',
      '/app/inbox': '统一收件箱',
      '/app/ai-review': 'AI 审核台',
      '/app/knowledge-base': 'AI 知识库',
      '/app/ai-ops': 'AI 运营看板',
      '/app/service-desk': '服务台',
      '/app/guide-templates': '获客指南',
      '/app/help': '使用帮助',
    }),
    [],
  )

  const getPageTitle = () => PAGE_TITLES[location.pathname] ?? '私域管理'
  const displayName = (() => {
    const realName = (user?.real_name || '').trim()
    if (realName) return realName
    const username = (user?.username || '').trim()
    if (username) return username
    return '我的账号'
  })()
  const displayTenantName = (tenantName || '').trim() || '未命名企业'

  function onMobileNavClick() {
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[var(--zf-content-bg)]">
      <aside className="fixed top-0 left-0 z-30 hidden h-full w-56 flex-col border-r border-[var(--zf-sidebar-border)] bg-[var(--zf-sidebar-bg)] md:flex">
        <div className="border-b border-[var(--zf-sidebar-footer-border)] px-4 py-[18px]">
          <ZhiFlowLogo size="sm" showText />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <SidebarNavSections {...sidebarCtx} onNavigate={onMobileNavClick} />
        </nav>
        <div className="border-t border-[var(--zf-sidebar-footer-border)] p-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-[var(--zf-sidebar-active-border)] bg-[var(--zf-sidebar-active-bg)] text-xs font-bold"
              style={{ color: 'var(--zf-sidebar-icon-active)' }}
            >
              {(user?.real_name || user?.username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium" style={{ color: 'var(--zf-sidebar-text)' }}>
                {user?.real_name || user?.username || '未登录'}
              </p>
              <p className="truncate text-[10px] font-bold" style={{ color: 'var(--zf-sidebar-label)' }}>
                {tenantName || '未命名企业'}
              </p>
            </div>
            <button type="button" style={{ color: 'var(--zf-sidebar-text)' }} onClick={onLogout} title="退出登录">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="fixed top-0 right-0 left-0 z-20 flex h-14 items-center justify-between border-b border-[#dde8f5] bg-white px-4 md:hidden">
        <button type="button" onClick={() => setMobileMenuOpen(true)}>
          <Menu className="h-5 w-5 text-[#0f1e2e]" />
        </button>
        <span className="text-sm font-medium text-[#0f1e2e]">{getPageTitle()}</span>
        <div className="w-5" />
      </header>

      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 md:hidden ${
          mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        <div
          style={{ background: 'var(--zf-sidebar-bg)' }}
          className={`absolute top-0 left-0 flex h-full w-64 flex-col shadow-xl transition-transform duration-200 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--zf-sidebar-footer-border)] p-4">
            <span className="font-semibold" style={{ color: 'var(--zf-sidebar-text-active)' }}>
              菜单
            </span>
            <button type="button" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" style={{ color: 'var(--zf-sidebar-icon-active)' }} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            <SidebarNavSections {...sidebarCtx} onNavigate={onMobileNavClick} />
          </nav>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-14 items-center justify-between border-b border-[var(--zf-topbar-border)] bg-[var(--zf-topbar-bg)] px-4 md:ml-56 md:flex">
          <div className="truncate text-sm text-[#9ab0c8]">
            <span className="font-semibold text-[#0f1e2e]">{displayTenantName}</span>
            <span className="mx-2">·</span>
            <span>{displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="gap-1 border border-[#d8e8f5] bg-[#eef3fa] text-[#7a9ab8] hover:bg-[#e6eef8]"
          >
            <LogOut className="h-4 w-4 text-[#7a9ab8]" />
            退出
          </Button>
        </header>
        <main className="min-h-screen bg-[var(--zf-content-bg)] pb-16 pt-14 md:ml-56 md:pb-0 md:pt-0">
          <DemoBanner />
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-center justify-around border-t border-[#dde8f5] bg-white px-2 md:hidden">
        <NavLink
          to="/app"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors ${
              isActive ? 'text-[#5b8dd9]' : 'text-gray-400'
            }`
          }
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>概览</span>
        </NavLink>
        <NavLink
          to="/app/customers"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors ${
              isActive ? 'text-[#5b8dd9]' : 'text-gray-400'
            }`
          }
        >
          <Users className="h-5 w-5" />
          <span>客户</span>
        </NavLink>
        <NavLink
          to="/app/follow-ups"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors ${
              isActive ? 'text-[#5b8dd9]' : 'text-gray-400'
            }`
          }
        >
          <ClipboardList className="h-5 w-5" />
          <span>跟进</span>
        </NavLink>
        <NavLink
          to="/app/broadcast-tasks"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors ${
              isActive ? 'text-[#5b8dd9]' : 'text-gray-400'
            }`
          }
        >
          <Megaphone className="h-5 w-5" />
          <span>群发</span>
        </NavLink>
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors ${
              isActive ? 'text-[#5b8dd9]' : 'text-gray-400'
            }`
          }
        >
          <Settings className="h-5 w-5" />
          <span>设置</span>
        </NavLink>
      </nav>
    </div>
  )
}
