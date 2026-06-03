/**
 * @file 分组侧栏导航（桌面 + 移动抽屉共用）。
 */
import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildSidebarNavGroups,
  type NavItemDef,
  type SidebarNavContext,
} from '@/components/layout/sidebarNavConfig'

function navCls({ isActive, featured }: { isActive: boolean; featured?: boolean }) {
  return cn(
    'zf-nav-item mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors duration-150',
    isActive ? 'font-medium zf-nav-active' : '',
    featured && !isActive ? 'zf-nav-featured' : '',
  )
}

const STORAGE_KEY = 'zf_sidebar_groups_v1'

function readGroupOpenState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

type SidebarNavSectionsProps = SidebarNavContext & {
  onNavigate?: () => void
  className?: string
}

function NavItemRow({ item, onNavigate }: { item: NavItemDef; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => navCls({ isActive, featured: item.featured })}
      onClick={onNavigate}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge ? <span className="zf-nav-badge">{item.badge}</span> : null}
    </NavLink>
  )
}

export function SidebarNavSections({ onNavigate, className, ...ctx }: SidebarNavSectionsProps) {
  const groups = useMemo(() => buildSidebarNavGroups(ctx), [ctx])
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => readGroupOpenState())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openMap))
  }, [openMap])

  function isGroupOpen(group: (typeof groups)[number]) {
    if (openMap[group.id] !== undefined) return openMap[group.id]
    return group.defaultOpen !== false
  }

  function toggleGroup(id: string, defaultOpen: boolean) {
    setOpenMap((prev) => {
      const current = prev[id] ?? defaultOpen
      return { ...prev, [id]: !current }
    })
  }

  return (
    <div className={cn('zf-sidebar-shell flex flex-col gap-3', className)}>
      {groups.map((group) => {
        const open = isGroupOpen(group)
        const canToggle = group.collapsible && group.items.length > 0

        return (
          <div key={group.id}>
            {canToggle ? (
              <button
                type="button"
                className="mb-1 flex w-full items-center gap-1 px-2 py-0.5 text-left"
                onClick={() => toggleGroup(group.id, group.defaultOpen !== false)}
              >
                {open ? (
                  <ChevronDown className="zf-sidebar-group-chevron h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="zf-sidebar-group-chevron h-3 w-3 shrink-0" />
                )}
                <span className="zf-sidebar-group-title text-[10px] font-bold uppercase tracking-wide">
                  {group.title}
                </span>
              </button>
            ) : (
              <div className="mb-1 px-2">
                <p className="zf-sidebar-group-title text-[10px] font-bold uppercase tracking-wide">{group.title}</p>
                {group.hint ? <p className="zf-sidebar-group-hint text-[10px]">{group.hint}</p> : null}
              </div>
            )}
            {open ? (
              <div>
                {group.items.map((item) => (
                  <NavItemRow key={`${item.to}-${item.label}`} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
