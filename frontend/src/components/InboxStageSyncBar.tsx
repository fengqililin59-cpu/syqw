/**
 * @file 收件箱 ↔ CRM 销售阶段联动说明与预览。
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { getJson } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type StageMapping = {
  inbox_stage: string
  inbox_label: string
  crm_stage: string | null
  crm_label: string
}

type SalesStageMapResponse = {
  mappings: StageMapping[]
}

export function InboxStageSyncBar({
  inboxStage,
  crmStage,
  crmStageLabel,
  onStageChange,
  busy,
}: {
  inboxStage: string
  crmStage?: string | null
  crmStageLabel?: string | null
  onStageChange: (stage: string) => void
  busy?: boolean
}) {
  const [mapData, setMapData] = useState<StageMapping[] | null>(null)
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    void getJson<SalesStageMapResponse>('/inbox/sales-stage-map')
      .then((d) => setMapData(d.mappings))
      .catch(() => setMapData(null))
  }, [])

  const preview = useMemo(() => {
    if (!mapData) return null
    return mapData.find((m) => m.inbox_stage === inboxStage) ?? null
  }, [mapData, inboxStage])

  const crmWillChange =
    preview?.crm_stage && crmStage && preview.crm_stage !== crmStage

  return (
    <div className="space-y-2 rounded-lg border border-indigo-200/80 bg-indigo-50/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-indigo-950">销售阶段（与 CRM 联动）</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setShowMap((v) => !v)}
        >
          {showMap ? '收起对照' : '阶段对照表'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-8 min-w-[7rem] rounded-md border border-input bg-white px-2 text-xs"
          value={inboxStage}
          disabled={busy}
          onChange={(e) => onStageChange(e.target.value)}
        >
          {(mapData ?? []).map((s) => (
            <option key={s.inbox_stage} value={s.inbox_stage}>
              {s.inbox_label}
            </option>
          ))}
        </select>
        {preview ? (
          <span className="flex items-center gap-1 text-[10px] text-indigo-900/90">
            <ArrowRight className="h-3 w-3" />
            CRM
            <Badge variant="secondary" className="text-[10px] font-normal">
              {preview.crm_label}
            </Badge>
          </span>
        ) : null}
      </div>

      {crmStage ? (
        <p className="text-[10px] text-muted-foreground">
          当前 CRM：{crmStageLabel || crmStage}
          {crmWillChange ? (
            <span className="text-indigo-700"> · 保存后将同步为「{preview?.crm_label}」</span>
          ) : (
            <span> · 与收件箱阶段已对齐</span>
          )}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">未关联客户，仅更新会话阶段。</p>
      )}

      {showMap && mapData ? (
        <div className="max-h-40 overflow-y-auto rounded border bg-white/80 text-[10px]">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th className="px-2 py-1">收件箱</th>
                <th className="px-2 py-1">→ CRM</th>
              </tr>
            </thead>
            <tbody>
              {mapData.map((m) => (
                <tr
                  key={m.inbox_stage}
                  className={m.inbox_stage === inboxStage ? 'bg-indigo-100/60' : ''}
                >
                  <td className="px-2 py-1">{m.inbox_label}</td>
                  <td className="px-2 py-1">{m.crm_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <RefreshCw className="h-3 w-3" />
        在客户详情改 CRM 阶段时，关联收件箱会话也会同步。
      </p>
    </div>
  )
}
