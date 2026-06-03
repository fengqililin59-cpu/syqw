/**
 * @file 智学 AI（syzs.top）账号联通回调：从 hash 读取 token 完成登录。
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

export function SyzsCallbackPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [msg, setMsg] = useState('正在完成智学 AI 账号联通…')

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const token = new URLSearchParams(hash).get('token')
    if (!token) {
      setMsg('缺少登录令牌，请从智学 AI 重新进入')
      return
    }

    ;(async () => {
      try {
        useAuthStore.setState({ token })
        const me = await getJson<MeResponse>('/auth/me')
        const perm = await getJson<MePermissionsResponse>('/auth/me/permissions')
        setSession({
          token,
          tenantId: me.tenant_id,
          tenantName: me.Tenant?.name ?? '',
          user: mapMeToAuthUser(me),
          permissions: permListFromMeResponse(perm),
        })
        navigate('/app', { replace: true })
      } catch (e) {
        useAuthStore.getState().clear()
        setMsg(e instanceof Error ? e.message : '联通失败，请重试')
      }
    })()
  }, [navigate, setSession])

  const showBack = msg !== '正在完成智学 AI 账号联通…'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">{msg}</p>
      {showBack ? (
        <Link to="/login" className="text-sm text-primary underline underline-offset-4">
          返回登录
        </Link>
      ) : null}
    </div>
  )
}
