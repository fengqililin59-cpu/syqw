/// <reference types="vite/client" />
/**
 * @file Vite 客户端类型：为 import.meta.env 提供 TypeScript 声明。
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
