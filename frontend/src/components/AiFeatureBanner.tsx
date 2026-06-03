/**
 * @file 仪表盘 AI 能力入口（站内，不跳转外部）。
 */
import { useNavigate } from 'react-router-dom'
import { Bot, Sparkles, BellRing, BookMarked, ArrowRight, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const TILES = [
  {
    key: 'assistant',
    title: 'AI 智能助手',
    desc: '多轮对话：销售话术、文案、跟进策略',
    icon: Bot,
    to: '/app/ai-assistant',
    accent: 'from-violet-500/15 to-fuchsia-500/10',
    featured: true,
  },
  {
    key: 'copy',
    title: 'AI 文案生成',
    desc: '朋友圈、群发、海报素材一键生成',
    icon: Sparkles,
    to: '/app/ai-copy',
    accent: 'from-sky-500/15 to-violet-500/10',
  },
  {
    key: 'intent',
    title: 'AI 意向预警',
    desc: '自动识别高意向客户，优先跟进',
    icon: BellRing,
    to: '/app/intent-alerts',
    accent: 'from-emerald-500/15 to-teal-500/10',
  },
  {
    key: 'scripts',
    title: '智能话术库',
    desc: '沉淀团队话术，随用随取',
    icon: MessageSquare,
    to: '/app/script-library',
    accent: 'from-amber-500/15 to-orange-500/10',
  },
  {
    key: 'kb',
    title: 'AI 知识库',
    desc: '上传资料，收件箱智能问答',
    icon: BookMarked,
    to: '/app/knowledge-base',
    accent: 'from-rose-500/15 to-pink-500/10',
  },
]

export function AiFeatureBanner() {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#0f2744] via-[#152d52] to-[#1a3a6e] text-white shadow-lg">
      <CardContent className="p-5 md:p-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/90">ZhiFlow · 站内 AI</p>
          <h2 className="mt-1 text-lg font-bold md:text-xl">AI 驱动私域销售，全部在本平台完成</h2>
          <p className="mt-1 max-w-2xl text-sm text-sky-100/80">
            智能助手、文案、意向预警、知识库 —— 按 AI 调用次数计费，升级 AI 助手版享 8000 次/月。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => navigate(tile.to)}
                className={`group flex flex-col rounded-xl border border-white/10 bg-gradient-to-br ${tile.accent} p-4 text-left transition hover:border-white/25 hover:bg-white/10`}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-5 w-5 text-sky-100" />
                </div>
                <p className="font-semibold text-white">
                  {tile.title}
                  {tile.featured ? (
                    <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">推荐</span>
                  ) : null}
                </p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-sky-100/75">{tile.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-200 group-hover:text-white">
                  进入
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
