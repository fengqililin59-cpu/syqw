/**
 * @file 页面顶部「这页做什么」说明卡片，帮助非技术用户理解功能。
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = {
  title: string
  detail?: string
}

type PageHelpCardProps = {
  title: string
  summary: string
  steps?: Step[]
  tip?: string
  defaultOpen?: boolean
  className?: string
}

export function PageHelpCard({
  title,
  summary,
  steps,
  tip,
  defaultOpen = true,
  className,
}: PageHelpCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white px-4 py-3 shadow-sm',
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sky-950">{title}</p>
          <p className="mt-0.5 text-sm text-sky-900/75">{summary}</p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-sky-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-sky-600" />
        )}
      </button>
      {open && steps && steps.length > 0 ? (
        <ol className="mt-3 space-y-2 border-t border-sky-100 pt-3 pl-6 text-sm text-slate-700">
          {steps.map((step, i) => (
            <li key={step.title} className="list-decimal">
              <span className="font-medium text-slate-800">
                {i + 1}. {step.title}
              </span>
              {step.detail ? <span className="text-slate-600"> — {step.detail}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {open && tip ? <p className="mt-3 border-t border-sky-100 pt-3 text-xs text-amber-800">{tip}</p> : null}
    </div>
  )
}
