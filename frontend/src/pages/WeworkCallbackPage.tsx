/**
 * @file 企微 OAuth 回前端落地页：从 URL hash 读取 token，拉取 /auth/me 后写入登录态并进入仪表盘。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJson } from '@/api/client'
import { useAuthStore, type AuthUser } from '@/store/authStore'
import { permListFromMeResponse, type MePermissionsResponse } from '@/lib/permApi'

type MeResponse = {
  id: number
  tenant_id: number
  username: string
  real_name?: string | null
  Role?: { id: number; name: string } | null
  Tenant?: { id: number; name: string }
}

function mapMeToAuthUser(me: MeResponse): AuthUser {
  return {
    id: me.id,
    tenant_id: me.tenant_id,
    username: me.username,
    real_name: me.real_name,
    Role: me.Role,
    role: me.Role ? { id: me.Role.id, name: me.Role.name } : undefined,
  }
}

export function WeworkCallbackPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [msg, setMsg] = useState('正在完成登录…')

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const token = params.get('token')
    if (!token) {
      setMsg('缺少登录令牌，请返回登录页重新扫码')
      return
    }

    ;(async () => {
      try {
        useAuthStore.setState({ token })
        const me = await getJson<MeResponse>('/auth/me')
        const perm = await getJson<MePermissionsResponse>('/auth/me/permissions')
        const tenantName = me.Tenant?.name ?? ''
        localStorage.setItem('last_tenant_id', String(me.tenant_id))
        setSession({
          token,
          tenantId: me.tenant_id,
          tenantName,
          user: mapMeToAuthUser(me),
          permissions: permListFromMeResponse(perm),
        })
        navigate('/app', { replace: true })
      } catch (e) {
        useAuthStore.getState().clear()
        setMsg(e instanceof Error ? e.message : '登录态无效，请重试')
      }
    })()
  }, [navigate, setSession])

  /** 非加载中即视为可返回登录（缺 token、/me 失败等） */
  const showBackLink = msg !== '正在完成登录…'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">{msg}</p>
      {showBackLink ? (
        <Link to="/login" className="text-sm text-primary underline underline-offset-4">
          返回登录
        </Link>
      ) : null}
    </div>
  )
}
