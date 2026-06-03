/**
 * @file 平台计费：合同附件。
 */
import { getJson, http, postFormData, postJson } from '@/api/client'

export type ContractAttachmentRow = {
  id: number
  original_name: string
  mime_type: string
  size_bytes: number
  created_at: string
  download_path: string
}

export function listContractAttachments(outTradeNo: string) {
  return getJson<ContractAttachmentRow[]>(
    `/platform/payments/${encodeURIComponent(outTradeNo)}/attachments`,
  )
}

export function uploadContractAttachment(outTradeNo: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return postFormData<ContractAttachmentRow>(
    `/platform/payments/${encodeURIComponent(outTradeNo)}/attachments`,
    fd,
  )
}

export function postMonthlyReconcileEmail(month?: string) {
  return postJson<{
    sent: number
    skipped?: string
    month?: string
    summary?: { total: number; paid_count: number; paid_amount: number }
  }>('/platform/payments/reconcile-email', month ? { month } : {})
}

export async function downloadPaymentsReconcile(params: {
  from?: string
  to?: string
  status?: string
  pay_channel?: string
  date_field?: 'created_at' | 'paid_at'
  format?: 'csv' | 'xlsx'
}) {
  const res = await http.get('/platform/payments/export', {
    params,
    responseType: 'blob',
  })
  const blob = res.data as Blob
  const cd = res.headers['content-disposition'] as string | undefined
  let filename = `zhiflow-payments_${params.from || ''}-${params.to || ''}.csv`
  const m = cd?.match(/filename\*=UTF-8''([^;]+)/i)
  if (m?.[1]) filename = decodeURIComponent(m[1])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadPlatformTenantStatement(
  tenantId: number,
  params: { month?: string; months?: number; format?: 'pdf' | 'html' },
) {
  const res = await http.get(`/platform/tenants/${tenantId}/statement/export`, {
    params,
    responseType: 'blob',
    timeout: 60_000,
  })
  const isPdf = (params.format || 'pdf') === 'pdf'
  const blob = new Blob([res.data as BlobPart], {
    type: isPdf ? 'application/pdf' : 'text/html;charset=utf-8',
  })
  const cd = res.headers['content-disposition'] as string | undefined
  let filename = isPdf ? `ZhiFlow-账单-${tenantId}.pdf` : `ZhiFlow-账单-${tenantId}.html`
  const m = cd?.match(/filename\*=UTF-8''([^;]+)/i)
  if (m?.[1]) filename = decodeURIComponent(m[1])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function sendPlatformTenantReminder(
  tenantId: number,
  kind: 'expiring' | 'churn',
  body?: { skip_if_emailed?: boolean; force?: boolean },
) {
  return postJson<{
    sent: number
    skipped?: boolean
    no_email?: boolean
    email?: string
    reason?: string
  }>(`/platform/tenants/${tenantId}/send-reminder`, { kind, ...body })
}

export async function downloadTenantStatementsZip(params: {
  month: string
  scope?: 'paid_in_month' | 'active_paid'
  limit?: number
  tenant_ids?: string
}) {
  const res = await http.get('/platform/statements/export', {
    params,
    responseType: 'blob',
    timeout: 120_000,
  })
  const blob = res.data as Blob
  const cd = res.headers['content-disposition'] as string | undefined
  let filename = `ZhiFlow-租户账单-${params.month}.zip`
  const m = cd?.match(/filename\*=UTF-8''([^;]+)/i)
  if (m?.[1]) filename = decodeURIComponent(m[1])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  const successCount = res.headers['x-export-success-count']
  const failedCount = res.headers['x-export-failed-count']
  const truncated = res.headers['x-export-truncated'] === '1'
  return {
    successCount: successCount != null ? Number(successCount) : undefined,
    failedCount: failedCount != null ? Number(failedCount) : undefined,
    truncated,
  }
}

export async function downloadContractAttachment(
  outTradeNo: string,
  attachmentId: number,
  filename: string,
) {
  const res = await http.get(
    `/platform/payments/${encodeURIComponent(outTradeNo)}/attachments/${attachmentId}/download`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
