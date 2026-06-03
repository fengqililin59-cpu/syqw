/**
 * @file 计费页：套餐功能对比表。
 */
import { Check, Minus } from 'lucide-react'
import type { FeatureRow, PlanColumn } from '@/lib/planComparison'
import { cellFromPlan } from '@/lib/planComparison'

type PlanLite = { code: string; features: string[]; ai_calls_monthly: number }

function CellIcon({ value }: { value: boolean | 'partial' }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-green-600" aria-label="支持" />
  if (value === 'partial')
    return <span className="text-xs text-amber-700">有限</span>
  return <Minus className="mx-auto h-4 w-4 text-gray-300" aria-label="不支持" />
}

export function PlanFeatureComparisonTable({
  title,
  description,
  columns,
  rows,
  plans,
  quotaRow,
}: {
  title: string
  description?: string
  columns: PlanColumn[]
  rows: FeatureRow[]
  plans: PlanLite[]
  /** 在表尾追加 AI 配额数字行 */
  quotaRow?: boolean
}) {
  const planMap = Object.fromEntries(plans.map((p) => [p.code, p]))

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="p-3 text-left font-medium">能力</th>
            {columns.map((col) => (
              <th
                key={col.code}
                className={`p-3 text-center font-medium ${col.highlight ? 'bg-blue-50 text-blue-900' : ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="p-3 text-muted-foreground">
                <span className="text-foreground">{row.label}</span>
                {row.hint ? <span className="mt-0.5 block text-xs">{row.hint}</span> : null}
              </td>
              {columns.map((col) => {
                const plan = planMap[col.code]
                const val = plan ? cellFromPlan(row, col.code, plan.features) : false
                return (
                  <td
                    key={col.code}
                    className={`p-3 text-center ${col.highlight ? 'bg-blue-50/50' : ''}`}
                  >
                    <CellIcon value={val} />
                  </td>
                )
              })}
            </tr>
          ))}
          {quotaRow ? (
            <tr className="border-t bg-violet-50/40">
              <td className="p-3 font-medium text-violet-950">月 AI 调用次数</td>
              {columns.map((col) => {
                const plan = planMap[col.code]
                const n = plan?.ai_calls_monthly ?? 0
                return (
                  <td
                    key={col.code}
                    className={`p-3 text-center font-semibold text-violet-800 ${col.highlight ? 'bg-violet-50' : ''}`}
                  >
                    {n === -1 ? '不限' : n > 0 ? n.toLocaleString() : '—'}
                  </td>
                )
              })}
            </tr>
          ) : null}
        </tbody>
      </table>
      {description ? <p className="border-t px-3 py-2 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}
