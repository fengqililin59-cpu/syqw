import { useEffect, useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listSmsTemplates, sendSingleSms, type SmsTemplate } from '@/api/sms'
import SmsTemplateParamsForm from '@/components/SmsTemplateParamsForm'
import { useAuthStore } from '@/store/authStore'

interface SmsButtonProps {
  customerId: number
  customerName: string
  customerPhone: string | null
  size?: 'sm' | 'default'
}

function previewSms(template: SmsTemplate | null, params: Record<string, string>) {
  if (!template) return ''
  let content = template.content_preview || ''
  for (const [k, v] of Object.entries(params)) {
    const displayVal =
      typeof v === 'string' && v.startsWith('${customer.')
        ? `【${v.replace('${customer.', '').replace('}', '')}】`
        : v
    content = content.replace(new RegExp(`\\$\\{${k}\\}`, 'g'), displayVal)
  }
  return content
}

export default function SmsButton({ customerId, customerName, customerPhone, size = 'default' }: SmsButtonProps) {
  const hasPerm = useAuthStore((s) => s.hasPerm)
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [templateId, setTemplateId] = useState<number>(0)
  const [params, setParams] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templateId, templates],
  )

  useEffect(() => {
    if (!open) return
    void listSmsTemplates()
      .then((rows) => {
        setTemplates(rows)
        if (rows.length > 0) setTemplateId(rows[0].id)
      })
      .catch(() => setTemplates([]))
  }, [open])

  if (!hasPerm('sms:send')) return null
  if (!customerPhone) {
    return (
      <Button variant="ghost" size={size} disabled title="客户未填写手机号">
        <MessageSquare className="h-4 w-4 text-gray-300" />
      </Button>
    )
  }

  async function onSubmit() {
    if (!selectedTemplate) return
    setSending(true)
    try {
      await sendSingleSms({
        customer_id: customerId,
        template_id: selectedTemplate.id,
        extra_params: params,
      })
      window.alert(`短信已发送给 ${customerName}`)
      setOpen(false)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)} title="发送短信">
        <MessageSquare className="mr-1 h-4 w-4 text-blue-600" />
        {size !== 'sm' && '短信'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发短信 · {customerName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">短信模板</label>
              <select
                className="mt-1 h-10 w-full rounded border px-3 text-sm"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(Number(e.target.value))
                  setParams({})
                }}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <SmsTemplateParamsForm template={selectedTemplate} params={params} onChange={setParams} />
            <div className="rounded border bg-muted/30 p-2 text-xs text-gray-600">{previewSms(selectedTemplate, params) || '短信预览'}</div>
            <div className="flex justify-end">
              <Button onClick={() => void onSubmit()} disabled={!selectedTemplate || sending}>
                {sending ? '发送中…' : '确认发送'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
