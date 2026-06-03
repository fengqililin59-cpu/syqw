/** 站点备案与公司主体（可通过 VITE_ 环境变量覆盖） */
export const SITE_LEGAL_COMPANY =
  (import.meta.env.VITE_LEGAL_COMPANY_NAME as string | undefined)?.trim() ||
  '杭州中数云科智慧科技有限公司'

export const SITE_LEGAL_ICP =
  (import.meta.env.VITE_LEGAL_ICP_NUMBER as string | undefined)?.trim() ||
  '浙ICP备2026009605号-1'

export const SITE_LEGAL_ICP_URL = 'https://beian.miit.gov.cn/'
