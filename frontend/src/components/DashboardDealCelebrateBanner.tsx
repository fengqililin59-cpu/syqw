/**
 * @file 仪表盘：本周新成交客户庆祝条。
 */
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardDealCelebrateBanner({
  customers,
}: {
  customers: { id: number; name: string }[]
}) {
  if (!customers.length) return null

  const names = customers.slice(0, 5).map((c) => c.name)
  const more = customers.length > 5 ? customers.length - 5 : 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-amber-50 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2">
        <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-950">
            恭喜！本周推进成交 {customers.length} 位客户
          </p>
          <p className="mt-0.5 text-xs text-emerald-900/80">
            {names.join('、')}
            {more > 0 ? ` 等 ${more} 位` : ''}
            —— 建议在客户详情补充回款备注，方便复盘。
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/app/customers/pipeline">销售看板</Link>
        </Button>
        {customers[0] ? (
          <Button size="sm" asChild>
            <Link to={`/app/customers/${customers[0].id}`}>查看客户</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
