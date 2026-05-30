/**
 * @file 通用工具：合并 className（clsx + tailwind-merge），供 shadcn 组件使用。
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
