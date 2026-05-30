/**
 * @file 平台超管路由守卫。
 */
import { Navigate } from 'react-router-dom'
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'

export function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, loading } = usePlatformAdmin()

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">验证平台权限…</p>
  }
  if (!isPlatformAdmin) {
    return <Navigate to="/app" replace />
  }
  return <>{children}</>
}
