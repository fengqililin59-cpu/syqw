/**
 * @file 平台后台：合同 / 年框开单模板。
 */
import { useEffect, useState } from 'react'
import { Copy, FileText, Paperclip, X } from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { uploadContractAttachment } from '@/api/platformBilling'
import { PlatformContractAttachmentsPanel } from '@/components/PlatformContractAttachmentsPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type ContractTemplate = {
  id: string
  name: string
  plan_code: string
  plan_name: string
  billing_cycle: 'monthly' | 'yearly'
  amount: number
  amount_label: string
  terms: string
}

type TenantOption = {
  id: number
  name: string
}

export function PlatformContractOrderCard({ onCreated }: { onCreated?: () => void }) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [tenantQ, setTenantQ] = useState('')
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [tenantId, setTenantId] = useState('')
  const [contractNo, setContractNo] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [remarkExtra, setRemarkExtra] = useState('')
  const [confirmNow, setConfirmNow] = useState(true)
  const [noticeText, setNoticeText] = useState<string | null>(null)
  const [lastOutTradeNo, setLastOutTradeNo] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const selected = templates.find((t) => t.id === templateId) ?? null

  useEffect(() => {
    void getJson<ContractTemplate[]>('/platform/contract-templates')
      .then((rows) => {
        setTemplates(rows)
        setTemplateId((prev) => prev || rows[0]?.id || '')
      })
      .catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    if (!tenantQ.trim()) {
      setTenantOptions([])
      return
    }
    const t = setTimeout(() => {
      void getJson<{ list: { id: number; name: string }[] }>(
        `/platform/tenants?q=${encodeURIComponent(tenantQ.trim())}&size=8`,
      )
        .then((r) => setTenantOptions(r.list?.map((x) => ({ id: x.id, name: x.name })) || []))
        .catch(() => setTenantOptions([]))
    }, 300)
    return () => clearTimeout(t)
  }, [tenantQ])

  async function submit() {
    const tid = Number(tenantId)
    if (!Number.isFinite(tid) || tid <= 0) {
      window.alert('请选择或填写租户 ID')
      return
    }
    if (!templateId) {
      window.alert('请选择合同模板')
      return
    }
    setBusy(true)
    try {
      const r = await postJson<{
        notice_text: string
        out_trade_no: string
        confirmed: boolean
      }>(`/platform/tenants/${tid}/contract-order`, {
        template_id: templateId,
        contract_no: contractNo.trim() || undefined,
        amount: customAmount.trim() ? Number(customAmount) : undefined,
        remark_extra: remarkExtra.trim() || undefined,
        confirm_now: confirmNow,
      })
      setNoticeText(r.notice_text)
      setLastOutTradeNo(r.out_trade_no)
      const uploadCount = pendingFiles.length
      if (uploadCount > 0) {
        for (const file of pendingFiles) {
          await uploadContractAttachment(r.out_trade_no, file)
        }
        setPendingFiles([])
      }
      onCreated?.()
      const attHint = uploadCount > 0 ? `，已上传 ${uploadCount} 个合同附件` : ''
      window.alert(
        (r.confirmed ? '已开单并开通套餐' : `已创建订单 ${r.out_trade_no}，请在待确认收款中核对`) + attHint,
      )
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '开单失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/40 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-blue-700" />
          合同 / 年框开单
        </CardTitle>
        <CardDescription>
          按模板生成线下订单与标准备注；可选「已收款」直接开通，或生成待确认订单。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>合同模板</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.amount_label}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="text-[11px] text-muted-foreground">{selected.terms}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>查找企业</Label>
            <Input
              value={tenantQ}
              onChange={(e) => setTenantQ(e.target.value)}
              placeholder="输入企业名搜索"
            />
            {tenantOptions.length > 0 ? (
              <div className="max-h-28 overflow-y-auto rounded-md border bg-white text-sm">
                {tenantOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="block w-full px-2 py-1.5 text-left hover:bg-muted"
                    onClick={() => {
                      setTenantId(String(t.id))
                      setTenantQ(t.name)
                      setTenantOptions([])
                    }}
                  >
                    {t.name} <span className="text-muted-foreground">#{t.id}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <Input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="租户 ID"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>合同号（可选）</Label>
            <Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} placeholder="自动生成" />
          </div>
          <div className="space-y-1">
            <Label>金额覆盖（可选）</Label>
            <Input
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={selected ? String(selected.amount) : '默认牌价'}
            />
          </div>
          <div className="space-y-1">
            <Label>备注补充</Label>
            <Input
              value={remarkExtra}
              onChange={(e) => setRemarkExtra(e.target.value)}
              placeholder="实施费 / 渠道"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-dashed border-blue-200 bg-white/60 p-3">
          <Label className="flex items-center gap-1 text-sm">
            <Paperclip className="h-3.5 w-3.5" />
            合同附件（PDF / 图片，单文件 ≤15MB，开单后自动关联订单）
          </Label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-blue-100 file:px-2 file:py-1 file:text-xs file:text-blue-800"
            onChange={(e) => {
              const picked = Array.from(e.target.files || [])
              if (picked.length) setPendingFiles((prev) => [...prev, ...picked].slice(0, 10))
              e.target.value = ''
            }}
          />
          {pendingFiles.length > 0 ? (
            <ul className="space-y-1">
              {pendingFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">也可在开单后于订单列表补传。</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmNow}
            onChange={(e) => setConfirmNow(e.target.checked)}
            className="rounded border-input"
          />
          已收到款项，立即确认开通
          {!confirmNow ? (
            <Badge variant="secondary" className="text-[10px]">
              仅生成待确认订单
            </Badge>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? '处理中…' : confirmNow ? '开单并开通' : '生成待确认订单'}
          </Button>
          {noticeText ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(noticeText)}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              复制客户通知文案
            </Button>
          ) : null}
        </div>

        {noticeText ? (
          <pre className="whitespace-pre-wrap rounded-lg border bg-white/80 p-3 text-xs leading-relaxed text-slate-700">
            {noticeText}
          </pre>
        ) : null}

        {lastOutTradeNo ? (
          <PlatformContractAttachmentsPanel outTradeNo={lastOutTradeNo} onChange={() => onCreated?.()} />
        ) : null}
      </CardContent>
    </Card>
  )
}
