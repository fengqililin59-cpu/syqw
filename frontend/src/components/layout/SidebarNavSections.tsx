/**
 * @file 分组侧栏导航（桌面 + 移动抽屉共用）。
 */
import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildSidebarNavGroups,
  type SidebarNavContext,
} from '@/components/layout/sidebarNavConfig'

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    'zf-nav-item mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors duration-150',
    isActive ? 'font-medium zf-nav-active' : '',
  )

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
    <div className={cn('flex flex-col gap-3', className)}>
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
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{group.title}</span>
              </button>
            ) : (
              <div className="mb-1 px-2">
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{group.title}</p>
                {group.hint ? <p className="text-[10px] opacity-50">{group.hint}</p> : null}
              </div>
            )}
            {open ? (
              <div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={navCls}
                    onClick={onNavigate}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
