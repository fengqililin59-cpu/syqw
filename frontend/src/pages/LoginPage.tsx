/**
 * @file 登录页：租户 ID + 账号密码，成功后写入全局登录态。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore, type AuthUser } from '@/store/authStore'
import { getAttributionToken, getLandingAttribution, saveLandingAttributionFromUrl } from '@/utils/attribution'
import { permListFromMeResponse, type MePermissionsResponse } from '@/lib/permApi'
import ZhiFlowLogo from '@/components/ZhiFlowLogo'

type LoginRes = {
  token: string
  user: AuthUser
  tenant: { id: number; name: string }
}

type MyPermRes = MePermissionsResponse & {
  role?: { id: number; name: string } | null
}

type TenantOption = {
  tenant_id: number
  tenant_name: string
}

/** 可选企业 ID，仅接受正整数；空值表示走账号自动匹配企业 */
function parseTenantId(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isSafeInteger(n) || n < 1) return null
  return n
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const setIsDemo = useAuthStore((s) => s.setIsDemo)
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('last_tenant_id') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [weworkLoading, setWeworkLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [tenantPickerOpen, setTenantPickerOpen] = useState(false)

  function showToast(msg: string) {
    const el = document.createElement('div')
    el.textContent = msg
    el.style.cssText = `
      position:fixed;top:16px;
      left:50%;transform:translateX(-50%);
      background:#ef4444;color:white;
      padding:10px 20px;border-radius:8px;
      z-index:9999;font-size:14px;
      box-shadow:0 4px 12px rgba(0,0,0,.15)
    `
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 4000)
  }

  async function submitLogin(tenantIdOverride?: number | null) {
    const tenantRaw = tenantId.trim()
    const tid = tenantIdOverride ?? parseTenantId(tenantRaw)
    if (tenantIdOverride == null && tenantRaw && tid == null) {
      setErr('企业 ID 必须是正整数（留空表示自动识别企业）')
      return
    }
    const data = await postJson<LoginRes>('/auth/login', {
      tenant_id: tid ?? undefined,
      username,
      password,
      attribution_token: getAttributionToken() || undefined,
      landing_from: getLandingAttribution().from,
      landing_variant: getLandingAttribution().variant,
      landing_cta: getLandingAttribution().cta,
    })
    const perm = await getJson<MyPermRes>('/auth/me/permissions')
    localStorage.setItem('last_tenant_id', String(data.tenant.id))
    setSession({
      token: data.token,
      tenantId: data.tenant.id,
      tenantName: data.tenant.name,
      user: data.user,
      permissions: permListFromMeResponse(perm),
    })
    navigate('/app', { replace: true })
  }

  useEffect(() => {
    saveLandingAttributionFromUrl()
  }, [])

  useEffect(() => {
    const code = searchParams.get('error')
    const msg = searchParams.get('msg')
    if (code === 'wework_invalid_params') {
      setErr('企微回调参数不完整，请重试扫码')
    } else if (code === 'wework_invalid_state') {
      setErr('登录状态已过期，请重新扫码')
    } else if (code === 'wework_tenant_not_found') {
      setErr('企业不存在或已被删除')
    } else if (code === 'wework_not_bound') {
      const uid = searchParams.get('userid')
      setErr(
        uid
          ? `成员「${uid}」尚未绑定系统账号：请让管理员在「用户管理 → 编辑」中填写企微 UserID，或使用账号密码登录`
          : '该企微成员尚未绑定系统账号',
      )
    } else if (code === 'wework_failed' && msg) {
      try {
        setErr(decodeURIComponent(msg))
      } catch {
        setErr(msg)
      }
    }
  }, [searchParams])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await submitLogin()
    } catch (ex: unknown) {
      const e = ex as Error & { status?: number; data?: unknown }
      const maybeTenants = Array.isArray(e?.data) ? (e.data as TenantOption[]) : []
      if (e?.status === 409 && maybeTenants.length > 0) {
        setTenantOptions(
          maybeTenants.filter((x) => Number.isFinite(Number(x.tenant_id))).map((x) => ({
            tenant_id: Number(x.tenant_id),
            tenant_name: String(x.tenant_name || ''),
          })),
        )
        setTenantPickerOpen(true)
        setErr('同一账号归属多个企业，请先选择企业')
      } else {
        setErr(ex instanceof Error ? ex.message : '登录失败')
      }
    } finally {
      setLoading(false)
    }
  }

  async function onWeworkScan() {
    setErr(null)
    const tid = parseTenantId(tenantId)
    if (tid == null) {
      setErr('请先填写正确的企业 ID（租户 ID）')
      return
    }
    setWeworkLoading(true)
    try {
      const data = await getJson<{ url: string }>(`/wework/qr-login-url?tenant_id=${tid}`)
      window.location.href = data.url
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '无法获取扫码地址')
    } finally {
      setWeworkLoading(false)
    }
  }

  async function handleGuestLogin() {
    setErr(null)
    setLoading(true)
    try {
      const data = await postJson<LoginRes>('/auth/guest-login', {})
      useAuthStore.setState({ token: data.token })
      const perm = await getJson<MyPermRes>('/auth/me/permissions')
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
    } catch {
      showToast('演示环境暂不可用')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4">
      <Card className="mx-auto w-full max-w-[380px] rounded-2xl border border-[#dde8f5] bg-white p-2 shadow-lg shadow-blue-100/50">
        <CardHeader>
          <div className="mb-4 flex flex-col items-center">
            <ZhiFlowLogo size="lg" showText />
          </div>
          <CardTitle className="text-center">登录</CardTitle>
          <CardDescription className="text-center">使用账号密码登录；企业 ID 可选（用于多企业账号）</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="tenantId">企业 ID（可选）</Label>
              <div className="login-input">
                <Input
                  id="tenantId"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="留空自动识别；多企业同账号时可填写"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground">企微扫码登录仍需填写企业 ID。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">手机号或邮箱</Label>
              <div className="login-input">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="请输入手机号或邮箱"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="login-input">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={loading || weworkLoading}
              className="relative w-full overflow-hidden rounded-lg py-2.5 text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#1e3a6e,#2d5fa8)' }}
            >
              {loading ? '登录中…' : '登录'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || weworkLoading}
              className="w-full"
              onClick={() => void onWeworkScan()}
            >
              {weworkLoading ? '跳转中…' : '企微扫码登录'}
            </Button>
            <Button variant="link" asChild className="px-0">
              <Link to="/register">没有账号？去注册企业</Link>
            </Button>
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                marginTop: 4,
                paddingTop: 16,
                borderTop: '0.5px solid #e8edf5',
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: '#8aabb8',
                  marginBottom: 10,
                }}
              >
                想先看看效果？
              </p>
              <button
                type="button"
                disabled={loading || weworkLoading}
                onClick={() => void handleGuestLogin()}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: '#f0f4f8',
                  color: '#0f1e2e',
                  border: '0.5px solid #dde8f5',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading || weworkLoading ? 'not-allowed' : 'pointer',
                  opacity: loading || weworkLoading ? 0.6 : 1,
                }}
              >
                免费体验演示系统（无需注册）
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[#8aabb8]">© 2026 ZhiFlow · 私域增长平台</p>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={tenantPickerOpen} onOpenChange={setTenantPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择企业后登录</DialogTitle>
            <DialogDescription>该账号在多个企业中存在，请选择你要登录的企业。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {tenantOptions.map((t) => (
              <button
                key={t.tenant_id}
                type="button"
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setTenantId(String(t.tenant_id))
                  setTenantPickerOpen(false)
                  setLoading(true)
                  setErr(null)
                  void submitLogin(t.tenant_id)
                    .catch((ex: unknown) => {
                      setErr(ex instanceof Error ? ex.message : '登录失败')
                    })
                    .finally(() => setLoading(false))
                }}
              >
                <span className="truncate">{t.tenant_name || `企业 ${t.tenant_id}`}</span>
                <span className="ml-2 text-xs text-muted-foreground">ID: {t.tenant_id}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTenantPickerOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
