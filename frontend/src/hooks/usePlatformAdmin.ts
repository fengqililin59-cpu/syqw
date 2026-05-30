/**
 * @file 平台方是否超管（登录后拉取 /platform/access）。
 */
import { useEffect, useState } from 'react'
import { getJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

let cached: boolean | null = null
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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(cached ?? false)
  const [loading, setLoading] = useState(cached === null && Boolean(token))

  useEffect(() => {
    if (!token) {
      cached = false
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }
    if (cached !== null) {
      setIsPlatformAdmin(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    inflight =
      inflight ??
      fetchPlatformAdmin().then((v) => {
        cached = v
        inflight = null
        return v
      })
    void inflight.then((v) => {
      setIsPlatformAdmin(v)
      setLoading(false)
    })
  }, [token])

  return { isPlatformAdmin, loading }
}

export function resetPlatformAdminCache() {
  cached = null
  inflight = null
}
