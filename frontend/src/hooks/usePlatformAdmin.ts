/**
 * @file 平台方是否超管（登录后拉取 /platform/access）。
 *
 * 缓存绑定到当前 token：不同用户登录时必须重新拉取，
 * 防止平台管理员登出后普通用户继承其缓存状态。
 */
import { useEffect, useState } from 'react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

/** 上次缓存时使用的 token */
let cachedFor: string | null = null
/** 上次缓存的结果 */
let cachedResult: boolean = false
/** 正在进行的请求 */
let inflight: Promise<boolean> | null = null

async function fetchPlatformAdmin(): Promise<boolean> {
  if (!useAuthStore.getState().token) return false
  try {
    const data = await getJson<{ is_platform_admin: boolean }>('/platform/access')
    return Boolean(data.is_platform_admin)
  } catch {
    return false
  }
}

export function usePlatformAdmin() {
  const token = useAuthStore((s) => s.token)

  // 只有当前 token 与缓存 token 一致时才命中缓存
  const isCacheHit = Boolean(token && token === cachedFor)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(isCacheHit ? cachedResult : false)
  const [loading, setLoading] = useState(!isCacheHit && Boolean(token))

  useEffect(() => {
    if (!token) {
      // 登出：清除缓存，防止下一个用户继承
      cachedFor = null
      cachedResult = false
      inflight = null
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }
    if (token === cachedFor) {
      // 同一用户：直接使用缓存
      setIsPlatformAdmin(cachedResult)
      setLoading(false)
      return
    }
    // 新 token（切换用户）：必须重新拉取
    cachedFor = null
    cachedResult = false
    inflight = null
    setLoading(true)

    const currentToken = token
    const req = fetchPlatformAdmin()
    inflight = req
    void req.then((v) => {
      // 确保 token 在请求期间没有变化
      if (currentToken === useAuthStore.getState().token) {
        cachedFor = currentToken
        cachedResult = v
      }
      inflight = null
      setIsPlatformAdmin(v)
      setLoading(false)
    })
  }, [token])

  return { isPlatformAdmin, loading }
}

export function resetPlatformAdminCache() {
  cachedFor = null
  cachedResult = false
  inflight = null
}
