import { useEffect, useMemo, useRef, useState } from 'react'
import { getJson, postFormData, postJson } from '@/api/client'
import type { Paginated, UserRow } from '@/api/types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ImportJob {
  id: number
  status: 'parsing' | 'previewing' | 'importing' | 'done' | 'failed'
  file_name: string
  total_count: number
  imported_count: number
  updated_count: number
  skipped_count: number
  failed_count: number
  error_msg?: string
  preview_json?: {
    columns: Array<{ raw: string; mapped: string | null; ignored: boolean }>
    rows: Array<{ raw: Record<string, unknown>; mapped: Record<string, unknown>; issues: string[] }>
    total: number
    has_phone: boolean
  }
}

interface ImportDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const stageOptions = ['new', 'following', 'negotiating', 'won', 'lost']

function extractPhone(mapped: Record<string, unknown>) {
  return String(mapped.phone ?? '').trim()
}

export function ImportDrawer({ open, onOpenChange, onSuccess }: ImportDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [dupStrategy, setDupStrategy] = useState<'skip' | 'update'>('skip')
  const [defaultOwnerId, setDefaultOwnerId] = useState<number | null>(null)
  const [defaultStage, setDefaultStage] = useState('new')
  const [users, setUsers] = useState<UserRow[]>([])
  const [confirming, setConfirming] = useState(false)
  const [downloadingFailed, setDownloadingFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    void getJson<Paginated<UserRow>>('/users?page=1&size=200')
      .then((res) => setUsers(res.list))
      .catch(() => setUsers([]))
  }, [open])

  useEffect(() => {
    if (!open) {
      setStep(1)
      setUploading(false)
      setJob(null)
      setDupStrategy('skip')
      setDefaultOwnerId(null)
      setDefaultStage('new')
      setConfirming(false)
    }
  }, [open])

  useEffect(() => {
    if (step !== 3 || !job?.id) return
    if (job.status === 'done' || job.status === 'failed') return
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<ImportJob>(`/customers/import/${job.id}/status`)
        setJob((prev) => (prev ? { ...prev, ...data } : data))
      } catch {
        // ignore polling errors
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [step, job?.id, job?.status, job?.imported_count])

  const processed = useMemo(() => {
    if (!job) return 0
    return job.imported_count + job.updated_count + job.skipped_count + job.failed_count
  }, [job])

  async function handleFile(file?: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await postFormData<ImportJob>('/customers/import/upload', fd)
      setJob(data)
      setStep(2)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    void handleFile(file)
  }

  function downloadTemplate() {
    void import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['姓名', '手机', '公司', '职位', '微信号', '阶段', '来源', '备注', '标签'],
        ['张三', '13800138000', '示例公司', '销售总监', 'zhangsan', '新客户', '朋友介绍', '', '高意向,重点客户'],
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '客户导入模板')
      XLSX.writeFile(wb, '客户导入模板.xlsx')
    })
  }

  async function onConfirmImport() {
    if (!job?.id || !defaultOwnerId) {
      window.alert('请选择默认负责人')
      return
    }
    setConfirming(true)
    try {
      const data = await postJson<ImportJob>(`/customers/import/${job.id}/confirm`, {
        duplicate_strategy: dupStrategy,
        default_owner_id: defaultOwnerId,
        default_stage: defaultStage,
      })
      setJob(data)
      setStep(3)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '确认导入失败')
    } finally {
      setConfirming(false)
    }
  }

  async function downloadFailedCsv() {
    if (!job?.id || job.failed_count <= 0) return
    setDownloadingFailed(true)
    try {
      const data = await getJson<{ result_json: Array<{ row: number; data: Record<string, unknown>; error: string }> }>(
        `/customers/import/${job.id}/result`,
      )
      const rows = (data.result_json || []).map((x) => ({
        行号: x.row,
        姓名: String(x.data?.姓名 ?? x.data?.name ?? ''),
        手机: String(x.data?.手机 ?? x.data?.phone ?? ''),
        失败原因: x.error || '',
      }))
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 行号: '', 姓名: '', 手机: '', 失败原因: '' }])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '失败明细')
      XLSX.writeFile(wb, `客户导入失败明细_${job.id}.csv`, { bookType: 'csv' })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '下载失败明细失败')
    } finally {
      setDownloadingFailed(false)
    }
  }

  function finish() {
    onOpenChange(false)
    onSuccess()
  }

  const preview = job?.preview_json

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>客户批量导入</SheetTitle>
          <SheetDescription>Step {step}/3 · 上传文件 → 预览确认 → 导入进度</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {step === 1 ? (
            <div className="space-y-3">
              <div
                className="cursor-pointer rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                拖拽或点击上传
                <br />
                支持 .xlsx .xls .csv，建议 5MB 以内
                <br />
                <span className="text-xs">Mac Numbers 用户：请先导出为 Excel 或 CSV</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".xlsx,.xls,.csv,.numbers"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => downloadTemplate()}>
                下载导入模板
              </Button>
              {uploading ? <p className="text-sm text-muted-foreground">解析中…</p> : null}
            </div>
          ) : null}

          {step === 2 && preview ? (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>原始列名</TableHead>
                      <TableHead>映射结果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.columns.map((col, idx) => (
                      <TableRow key={`${col.raw}-${idx}`}>
                        <TableCell>{col.raw || '（空）'}</TableCell>
                        <TableCell>
                          {col.ignored ? (
                            <Badge variant="secondary">忽略</Badge>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">{col.mapped}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>手机</TableHead>
                      <TableHead>公司</TableHead>
                      <TableHead>阶段</TableHead>
                      <TableHead>问题</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((r, idx) => {
                      const phone = extractPhone(r.mapped)
                      const badPhone = phone !== '' && !/^\+?\d{6,20}$/.test(phone)
                      return (
                        <TableRow key={idx}>
                          <TableCell>{String(r.mapped.name ?? '—')}</TableCell>
                          <TableCell className={badPhone ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}>{phone || '—'}</TableCell>
                          <TableCell>{String(r.mapped.company ?? '—')}</TableCell>
                          <TableCell>{String(r.mapped.stage ?? '—')}</TableCell>
                          <TableCell>{r.issues?.join('；') || '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label>重复数据处理</Label>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={dupStrategy === 'skip'} onChange={() => setDupStrategy('skip')} />
                      跳过
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={dupStrategy === 'update'} onChange={() => setDupStrategy('update')} />
                      更新已有客户信息
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>默认负责人</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={defaultOwnerId ?? ''}
                    onChange={(e) => setDefaultOwnerId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">请选择负责人</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.real_name || u.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>默认阶段</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={defaultStage}
                    onChange={(e) => setDefaultStage(e.target.value)}
                  >
                    {stageOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-muted-foreground">
                  共 {preview.total} 条，将新增约 {preview.total} 条（实际以导入结果为准）
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    返回重新上传
                  </Button>
                  <Button onClick={() => void onConfirmImport()} disabled={confirming || !defaultOwnerId}>
                    {confirming ? '提交中…' : '确认导入'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 && job ? (
            <div className="space-y-3">
              <div className="space-y-2 rounded-md border p-3">
                <progress className="h-2 w-full" value={processed} max={Math.max(1, job.total_count)} />
                <p className="text-sm text-muted-foreground">
                  已处理 {processed} / {job.total_count} 条
                </p>
              </div>

              {job.status === 'done' ? (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <p>✅ 新增 {job.imported_count} 条</p>
                  <p>🔄 更新 {job.updated_count} 条</p>
                  <p>⏭ 跳过 {job.skipped_count} 条</p>
                  <p>❌ 失败 {job.failed_count} 条</p>
                  {job.failed_count > 0 ? (
                    <Button variant="outline" onClick={() => void downloadFailedCsv()} disabled={downloadingFailed}>
                      下载失败明细
                    </Button>
                  ) : null}
                  <div className="pt-2">
                    <Button onClick={finish}>完成</Button>
                  </div>
                </div>
              ) : null}

              {job.status === 'failed' ? (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive">导入失败：{job.error_msg || '未知错误'}</p>
                  <Button onClick={finish}>关闭</Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
