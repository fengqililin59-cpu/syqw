/**
 * @file 平台订单合同附件列表与下载。
 */
import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Paperclip, Download, Upload } from 'lucide-react'
import {
  downloadContractAttachment,
  listContractAttachments,
  uploadContractAttachment,
  type ContractAttachmentRow,
} from '@/api/platformBilling'
import { Button } from '@/components/ui/button'

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  outTradeNo: string
  compact?: boolean
  onChange?: () => void
}

export function PlatformContractAttachmentsPanel({ outTradeNo, compact, onChange }: Props) {
  const [rows, setRows] = useState<ContractAttachmentRow[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!outTradeNo) return
    try {
      const list = await listContractAttachments(outTradeNo)
      setRows(list || [])
    } catch {
      setRows([])
    }
  }, [outTradeNo])

  useEffect(() => {
    void load()
  }, [load])

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        await uploadContractAttachment(outTradeNo, file)
      }
      await load()
      onChange?.()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '上传失败')
    } finally {
      setBusy(false)
    }
  }

  if (compact && rows.length === 0) {
    return (
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-blue-700 hover:underline">
        <Upload className="h-3 w-3" />
        上传合同
        <input
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          disabled={busy}
          onChange={(e) => {
            void onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
    )
  }

  return (
    <div className={compact ? 'mt-1 space-y-1' : 'space-y-2 rounded-lg border bg-white/60 p-3'}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-sm font-medium text-slate-800">
            <Paperclip className="h-4 w-4" />
            合同附件
            <span className="text-muted-foreground">（{outTradeNo.slice(-10)}）</span>
          </p>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent">
            <Upload className="mr-1 h-3.5 w-3.5" />
            {busy ? '上传中…' : '上传'}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              multiple
              disabled={busy}
              onChange={(e) => {
                void onPickFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-blue-700">
          <Upload className="h-3 w-3" />
          补传附件
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            disabled={busy}
            onChange={(e) => {
              void onPickFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}

      {rows.length > 0 ? (
        <ul className={compact ? 'space-y-0.5' : 'space-y-1'}>
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-700"
            >
              <span className="max-w-[200px] truncate" title={r.original_name}>
                {r.original_name}
                <span className="ml-1 text-muted-foreground">
                  · {fmtSize(r.size_bytes)} · {dayjs(r.created_at).format('MM-DD HH:mm')}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1 text-blue-700"
                onClick={() => void downloadContractAttachment(outTradeNo, r.id, r.original_name)}
              >
                <Download className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : compact ? null : (
        <p className="text-xs text-muted-foreground">暂无附件，可上传盖章合同 PDF 或扫描件。</p>
      )}
    </div>
  )
}
