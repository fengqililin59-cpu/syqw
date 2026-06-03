/// <reference types="vite/client" />
/**
 * @file Vite 客户端类型：为 import.meta.env 提供 TypeScript 声明。
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** 可选：覆盖页脚公司主体名称 */
  readonly VITE_LEGAL_COMPANY_NAME?: string
  /** 可选：覆盖页脚 ICP 备案号 */
  readonly VITE_LEGAL_ICP_NUMBER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
