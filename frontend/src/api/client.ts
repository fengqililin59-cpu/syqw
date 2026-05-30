/**
 * @file Axios 实例与轻量封装：自动附加 JWT、解析统一业务 code。
 */
import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse } from '@/api/types'

/** 空字符串表示同域（Docker / Nginx 反代 /api 时使用） */
function resolveApiRoot(): string {
  const v = import.meta.env.VITE_API_URL
  if (v === undefined || v === null || String(v).trim() === '') return ''
  const raw = String(v).replace(/\/$/, '')
  try {
    const u = new URL(raw)
    const apiIsLoopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (apiIsLoopback && typeof window !== 'undefined') {
      const pageHost = window.location.hostname
      if (pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
        // 线上误打进 localhost API 时浏览器会 CORS；强制走当前站点同域 /api
        return ''
      }
    }
  } catch {
    /* 非合法绝对 URL 时仍返回 raw，由请求阶段暴露错误 */
  }
  return raw
}

const apiRoot = resolveApiRoot()
const baseURL = apiRoot === '' ? '/api/v1' : `${apiRoot}/api/v1`

function showToast(msg: string, type: 'error' | 'warning' = 'warning') {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `
    position:fixed;top:16px;
    left:50%;transform:translateX(-50%);
    background:${type === 'error' ? '#ef4444' : '#f59e0b'};
    color:white;padding:10px 20px;
    border-radius:8px;z-index:9999;
    font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.15)
  `
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 4000)
}

export const http = axios.create({
  baseURL,
  timeout: 30_000,
})

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** 未授权：清空本地登录态并回到登录页（与后端 JWT 失效/被禁用一致） */
http.interceptors.response.use(
  (res) => {
    const demoHeader = res.headers['x-demo-mode']
    if (demoHeader === '1') {
      useAuthStore.getState().setIsDemo(true)
    } else if (demoHeader !== undefined) {
      useAuthStore.getState().setIsDemo(false)
    }
    return res
  },
  (err: unknown) => {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    if (status === 403) {
      const d = axios.isAxiosError(err)
        ? (err.response?.data as Partial<ApiResponse<unknown>> & { data?: { is_demo?: boolean } } | undefined)
        : undefined
      if (d?.data?.is_demo) {
        const msg = useAuthStore.getState().isGuest
          ? '体验版不支持此操作，注册后可使用全部功能'
          : '演示模式仅支持查看，请先配置企微'
        showToast(msg, 'warning')
      }
    }
    if (status === 401) {
      useAuthStore.getState().clear()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    if (status === 402) {
      const d = axios.isAxiosError(err)
        ? (err.response?.data as Partial<ApiResponse<unknown>> & { message?: string } | undefined)
        : undefined
      const msg = d?.message ?? '已达套餐上限，请升级'
      showToast(`功能受限：${msg}`, 'warning')
      if (!window.location.pathname.startsWith('/app/billing')) {
        setTimeout(() => {
          window.location.assign('/app/billing')
        }, 1500)
      }
    }
    return Promise.reject(err)
  },
)

function unwrap<T>(body: ApiResponse<T>): T {
  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data
}

/** 把后端 { code, message } 或 HTTP 错误转成可读 Error */
function wrapAxiosError(err: unknown): Error {
  if (!axios.isAxiosError(err)) return err instanceof Error ? err : new Error('请求失败')
  const d = err.response?.data as Partial<ApiResponse<unknown>> & { message?: string } | undefined
  if (d && typeof d.message === 'string' && d.message) {
    const e = new Error(d.message) as Error & { status?: number; data?: unknown }
    e.status = err.response?.status
    e.data = d.data
    return e
  }
  if (err.response?.status) {
    const e = new Error(`请求失败，状态码 ${err.response.status}`) as Error & { status?: number; data?: unknown }
    e.status = err.response.status
    e.data = d?.data
    return e
  }
  return new Error(err.message || '网络错误')
}

export async function getJson<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.get<ApiResponse<T>>(url, config)
    return unwrap(res.data)
  } catch (e) {
    throw wrapAxiosError(e)
  }
}

export async function postJson<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.post<ApiResponse<T>>(url, body, config)
    return unwrap(res.data)
  } catch (e) {
    throw wrapAxiosError(e)
  }
}

export async function putJson<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.put<ApiResponse<T>>(url, body, config)
    return unwrap(res.data)
  } catch (e) {
    throw wrapAxiosError(e)
  }
}

export async function patchJson<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.patch<ApiResponse<T>>(url, body, config)
    return unwrap(res.data)
  } catch (e) {
    throw wrapAxiosError(e)
  }
}

export async function deleteJson<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.delete<ApiResponse<T>>(url, config)
    return unwrap(res.data)
  } catch (e) {
    throw wrapAxiosError(e)
  }
}

/** multipart/form-data（勿手写 Content-Type，需浏览器自动带 boundary） */
export async function postFormData<T>(url: string, formData: FormData): Promise<T> {
  try {
    const res = await http.post<ApiResponse<T>>(url, formData)
    return unwrap(res.data)
  } catch (e) {
    throw wrapAxiosError(e)
  }
}
