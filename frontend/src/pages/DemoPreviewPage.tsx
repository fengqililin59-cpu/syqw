import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJsonWithToken, postJson } from '@/api/client'
import { useAuthStore, type AuthUser } from '@/store/authStore'
import { permListFromMeResponse, type MePermissionsResponse } from '@/lib/permApi'

type GuestLoginRes = {
  token: string
  user: AuthUser
  tenant: { id: number; name: string }
}

type MyPermRes = MePermissionsResponse & {
  role?: { id: number; name: string } | null
}

export function DemoPreviewPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const setIsDemo = useAuthStore((s) => s.setIsDemo)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await postJson<GuestLoginRes>('/auth/guest-login', {})
        useAuthStore.setState({ token: data.token })
        const perm = await getJsonWithToken<MyPermRes>('/auth/me/permissions', data.token)
        if (cancelled) return
        localStorage.setItem('last_tenant_id', String(data.tenant.id))
        setSession({
          token: data.token,
          tenantId: data.tenant.id,
          tenantName: data.tenant.name,
          user: data.user,
          permissions: permListFromMeResponse(perm),
        })
        setIsDemo(true)
        navigate('/app', { replace: true })
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '加载失败')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-[#dde8f5] bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-[#0f1e2e]">正在进入演示系统</h1>
        <p className="mt-2 text-sm text-[#6f8398]">系统正在自动为您创建体验会话，通常 1-2 秒完成。</p>

        {err ? (
          <>
            <p className="mt-4 text-sm text-destructive">演示环境暂不可用，请稍后重试</p>
            <p className="mt-2 text-xs text-muted-foreground">{err}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/login" className="rounded-md border border-[#dde8f5] px-3 py-2 text-sm text-[#0f1e2e]">
                去登录
              </Link>
              <Link to="/register" className="rounded-md bg-[#0f2340] px-3 py-2 text-sm text-white">
                去注册
              </Link>
            </div>
          </>
        ) : (
          <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-2 border-[#c8d9ef] border-t-[#0f2340]" />
        )}
      </div>
    </div>
  )
}
