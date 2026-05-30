/**
 * @file 路由守卫：未登录访问后台时重定向到登录页。
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getJson } from '@/api/client'
import { permListFromMeResponse, type MePermissionsResponse } from '@/lib/permApi'

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  const permissions = useAuthStore((s) => s.permissions)
  const setPermissions = useAuthStore((s) => s.setPermissions)
  const [loadingPerm, setLoadingPerm] = useState(false)

  useEffect(() => {
    if (!token) return
    if (permissions.length > 0) return
    let cancelled = false
    setLoadingPerm(true)
    getJson<MePermissionsResponse>('/auth/me/permissions')
      .then((d) => {
        if (!cancelled) setPermissions(permListFromMeResponse(d))
      })
      .catch(() => {
        if (!cancelled) setPermissions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPerm(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, permissions.length, setPermissions])

  if (!token) {
    return <Navigate to="/login" replace />
  }
  if (loadingPerm && permissions.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">加载权限中…</div>
  }
  return <Outlet />
}
