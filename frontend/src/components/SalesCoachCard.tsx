/**
 * @file 成交副驾卡：展示客户意向分析、评分理由、流失风险、下一步建议
 */
import { useState } from 'react'
import {
  Flame,
  AlertTriangle,
  Snowflake,
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IntentAlertPlaybookDialog } from '@/components/IntentAlertPlaybookDialog'

type ChurnRiskAlert = {
  days_since_last_contact: number
  risk_level: 'critical' | 'high' | 'medium'
  message: string
}

type IntentScoreDetail = {
  rule_score: number
  ai_score: number
  final_score: number
  intent_stage: string
  confidence: string
  reason_snippet: string
  scored_at: string
}

type ConversionRateEstimate = {
  estimated_rate: number
  score_range: string
  samples: number
}

type SalesCoachCardProps = {
  customerId: number
  intentScore?: number | null
  intentTier?: string | null
  intentStageLabel?: string | null
  intentsScoreDetail?: IntentScoreDetail | null
  churnRiskAlert?: ChurnRiskAlert | null
  conversionRateEstimate?: ConversionRateEstimate | null
  onQuickFollowUp?: () => void
}

function intentIcon(score?: number | null) {
  const s = score ?? 0
  if (s >= 70) return <Flame className="h-5 w-5 text-orange-500" />
  if (s >= 40) return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  return <Snowflake className="h-5 w-5 text-blue-400" />
}

function intentBg(score?: number | null) {
  const s = score ?? 0
  if (s >= 70) return 'bg-orange-50 border-orange-200'
  if (s >= 40) return 'bg-yellow-50 border-yellow-200'
  return 'bg-blue-50 border-blue-200'
}

function riskLevelLabel(level?: string) {
  switch (level) {
    case 'critical':
      return { label: '⚠️ 极高风险', color: 'text-red-700 font-semibold' }
    case 'high':
      return { label: '⚠️ 高风险', color: 'text-orange-700 font-semibold' }
    case 'medium':
      return { label: '👀 需关注', color: 'text-yellow-700' }
    default:
      return { label: '✅ 低风险', color: 'text-green-700' }
  }
}

export function SalesCoachCard({
  customerId,
  intentScore,
  intentTier,
  intentStageLabel,
  intentsScoreDetail,
  churnRiskAlert,
  conversionRateEstimate,
  onQuickFollowUp,
}: SalesCoachCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [playbookOpen, setPlaybookOpen] = useState(false)

  const score = intentScore ?? 0

  return (
    <>
      <Card className={`rounded-2xl shadow-sm border-2 ${intentBg(score)}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            📊 成交副驾
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 分数区 */}
          <div className="flex items-end gap-3">
            {intentIcon(score)}
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{score}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              {intentTier && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {intentTier}
                  {intentStageLabel ? ` · ${intentStageLabel}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* 评分理由 */}
          {intentsScoreDetail && (
            <div className="space-y-1.5">
              <button
                onClick={() => setShowDetail(!showDetail)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/60 hover:bg-white transition-colors text-left"
              >
                <span className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  为什么这个分
                </span>
                {showDetail ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {showDetail && (
                <div className="space-y-2 rounded-lg bg-white/80 p-2.5 text-xs leading-relaxed">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">规则分：</span>
                    <span className="font-semibold">{intentsScoreDetail.rule_score}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">AI 分：</span>
                    <span className="font-semibold">{intentsScoreDetail.ai_score}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">置信度：</span>
                    <span className="font-semibold">{intentsScoreDetail.confidence}</span>
                  </div>
                  {intentsScoreDetail.reason_snippet && (
                    <div className="pt-1.5 border-t border-gray-200">
                      <p className="text-muted-foreground mb-1">评分理由：</p>
                      <p className="text-foreground line-clamp-3">
                        {intentsScoreDetail.reason_snippet}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 流失风险预警 */}
          {churnRiskAlert && (
            <div className="rounded-lg border-l-4 border-l-red-500 bg-red-50 px-3 py-2 text-sm">
              <p className={`font-medium ${riskLevelLabel(churnRiskAlert.risk_level).color}`}>
                {riskLevelLabel(churnRiskAlert.risk_level).label}
              </p>
              <p className="text-xs text-red-700 mt-0.5">{churnRiskAlert.message}</p>
            </div>
          )}

          {/* 成交率预测 */}
          {conversionRateEstimate && (
            <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-3 py-2">
              <p className="text-xs text-emerald-900 font-semibold">
                📈 预计成交率 <span className="text-sm text-emerald-700">{conversionRateEstimate.estimated_rate}%</span>
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                基于 {conversionRateEstimate.samples} 个同类客户（意向分 {conversionRateEstimate.score_range}） 近 90 天的数据
              </p>
            </div>
          )}

          {/* 下一步建议 */}
          <div className="rounded-lg bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 p-2.5">
            <p className="text-xs font-medium text-violet-900 mb-2 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" />
              🎯 现在该做什么
            </p>
            <p className="text-xs text-violet-800 mb-2.5 leading-relaxed">
              {score >= 75
                ? '🔥 高意向！建议立即电话确认需求，准备方案或报价。'
                : score >= 50
                  ? '⚡ 中等意向。继续价值传递，主动引导下一步。'
                  : '❄️ 意向较弱。先建立信任，提供教育内容，逐步转化。'}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={() => setPlaybookOpen(true)}
              >
                <BookOpen className="h-3 w-3 mr-1" />
                推荐话术
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                onClick={onQuickFollowUp}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                一键跟进
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Playbook 弹窗 */}
      <IntentAlertPlaybookDialog
        customerId={customerId}
        open={playbookOpen}
        onOpenChange={setPlaybookOpen}
      />
    </>
  )
}
