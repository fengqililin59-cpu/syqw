/**
 * @file 仪表盘：AI 员工启动进度条（管理员）。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { isAdminUser } from '@/lib/roles'
import { Button } from '@/components/ui/button'

type PlaybookProgress = {
  progress: { required_percent: number; done_required: number; required_total: number }
}

export function DashboardAiEmployeeBanner() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
  const [hide, setHide] = useState(false)
  const [data, setData] = useState<PlaybookProgress | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    void getJson<PlaybookProgress>('/dashboard/ai-employee-playbook')
      .then(setData)
      .catch(() => setData(null))
  }, [isAdmin])

  if (!isAdmin || hide || !data) return null
  if (data.progress.required_percent >= 100) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/90 to-white px-4 py-3">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
        <div>
          <p className="text-sm font-medium text-violet-950">
            AI 员工启动 {data.progress.done_required}/{data.progress.required_total}（{data.progress.required_percent}%）
          </p>
          <p className="text-xs text-muted-foreground">
            接企微与收件箱 → 知识库 → 自动跟进；按向导逐步配置即可跑通闭环。
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setHide(true)}>
          稍后
        </Button>
        <Button size="sm" asChild>
          <Link to="/app/ai-employee-playbook">继续配置</Link>
        </Button>
      </div>
    </div>
  )
}
