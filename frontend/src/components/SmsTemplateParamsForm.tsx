import { Input } from '@/components/ui/input'
import type { SmsTemplate } from '@/api/sms'

interface SmsTemplateParamsFormProps {
  template: SmsTemplate | null
  params: Record<string, string>
  onChange: (params: Record<string, string>) => void
}

export default function SmsTemplateParamsForm({ template, params, onChange }: SmsTemplateParamsFormProps) {
  if (!template || !template.variables?.length) return null
  return (
    <div className="space-y-3">
      {template.variables.map((varName) => (
        <div key={varName}>
          <label className="text-sm font-medium">{varName}</label>
          <div className="mt-1 flex gap-2">
            <Input
              value={params[varName] ?? ''}
              onChange={(e) => onChange({ ...params, [varName]: e.target.value })}
              placeholder={`填写 ${varName}`}
              className="flex-1"
            />
            <select
              className="rounded border px-2 text-sm"
              value={params[varName] ?? ''}
              onChange={(e) => onChange({ ...params, [varName]: e.target.value })}
            >
              <option value="">客户字段</option>
              <option value="${customer.name}">客户姓名</option>
              <option value="${customer.company}">公司名称</option>
              <option value="${customer.phone}">手机号</option>
              <option value="${customer.position}">职位</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  )
}
