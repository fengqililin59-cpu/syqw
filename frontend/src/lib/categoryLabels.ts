/** 知识库 / 话术库等业务分类：接口存英文码，界面展示中文 */
export const KB_CATEGORY_OPTIONS = [
  { value: 'product', label: '产品介绍' },
  { value: 'pricing', label: '价格套餐' },
  { value: 'after_sale', label: '售后服务' },
  { value: 'faq', label: '常见问题' },
  { value: 'policy', label: '政策说明' },
  { value: 'general', label: '通用' },
] as const

export const SCRIPT_CATEGORY_OPTIONS = [
  { value: 'general', label: '通用' },
  { value: 'opening', label: '开场破冰' },
  { value: 'quote', label: '报价说明' },
  { value: 'follow', label: '跟进催单' },
  { value: 'close', label: '成交促单' },
  { value: 'after_sale', label: '售后服务' },
] as const

const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  industry_edu: '教培话术',
  industry_beauty: '美业话术',
  industry_b2b: 'B2B话术',
}

export function categoryLabel(code: string | null | undefined): string {
  if (!code) return '—'
  const fromKb = KB_CATEGORY_OPTIONS.find((x) => x.value === code)
  if (fromKb) return fromKb.label
  const fromScript = SCRIPT_CATEGORY_OPTIONS.find((x) => x.value === code)
  if (fromScript) return fromScript.label
  return EXTRA_CATEGORY_LABELS[code] || code
}
