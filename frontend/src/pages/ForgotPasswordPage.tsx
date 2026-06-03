/**
 * @file 忘记密码：短信验证码重置（多企业同号需填写企业 ID）。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ZhiFlowLogo from '@/components/ZhiFlowLogo'
import { SiteLegalFooter } from '@/components/SiteLegalFooter'

type SendOtpRes = {
  ok: boolean
  expiresInSec: number
  devMode?: boolean
  devCode?: string
}

type TenantOption = {
  tenant_id: number
  tenant_name: string
}

function parseTenantId(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isSafeInteger(n) || n < 1) return null
  return n
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('last_tenant_id') || '')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [tenantPickerOpen, setTenantPickerOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'send' | 'reset' | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  function buildBody(tenantOverride?: number | null) {
    const tid = tenantOverride ?? parseTenantId(tenantId)
    return {
      phone: phone.trim(),
      tenant_id: tid ?? undefined,
    }
  }

  async function doSendOtp(tenantOverride?: number | null) {
    setErr(null)
    if (!phone.trim()) {
      setErr('请先填写手机号')
      return
    }
    const tenantRaw = tenantId.trim()
    const tid = tenantOverride ?? parseTenantId(tenantRaw)
    if (tenantOverride == null && tenantRaw && tid == null) {
      setErr('企业 ID 必须是正整数')
      return
    }
    setSendingOtp(true)
    try {
      const data = await postJson<SendOtpRes>('/auth/forgot-password/send-otp', buildBody(tid))
      setCooldown(60)
      if (data?.devMode && data?.devCode) {
        setOtpCode(String(data.devCode))
        setErr(`开发模式验证码：${data.devCode}（已自动填入）`)
      }
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
        setPendingAction('send')
        setTenantPickerOpen(true)
        setErr('该手机号存在于多个企业，请选择企业后继续')
      } else {
        setErr(ex instanceof Error ? ex.message : '发送失败')
      }
    } finally {
      setSendingOtp(false)
    }
  }

  async function doReset(tenantOverride?: number | null) {
    setErr(null)
    if (!phone.trim()) {
      setErr('请填写手机号')
      return
    }
    if (password.length < 6) {
      setErr('新密码至少 6 位')
      return
    }
    if (password !== confirmPassword) {
      setErr('两次输入的密码不一致')
      return
    }
    if (!otpCode.trim()) {
      setErr('请填写短信验证码')
      return
    }
    const tenantRaw = tenantId.trim()
    const tid = tenantOverride ?? parseTenantId(tenantRaw)
    if (tenantOverride == null && tenantRaw && tid == null) {
      setErr('企业 ID 必须是正整数')
      return
    }
    setLoading(true)
    try {
      await postJson('/auth/forgot-password/reset', {
        ...buildBody(tid),
        otp_code: otpCode.trim(),
        password,
      })
      navigate('/login', { replace: true, state: { resetOk: true } })
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
        setPendingAction('reset')
        setTenantPickerOpen(true)
        setErr('该手机号存在于多个企业，请选择企业后重试')
      } else {
        setErr(ex instanceof Error ? ex.message : '重置失败')
      }
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await doReset()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4">
      <Card className="mx-auto w-full max-w-[380px] rounded-2xl border border-[#dde8f5] bg-white p-2 shadow-lg shadow-blue-100/50">
        <CardHeader>
          <div className="mb-4 flex flex-col items-center">
            <ZhiFlowLogo size="lg" showText />
          </div>
          <CardTitle className="text-center">忘记密码</CardTitle>
          <CardDescription className="text-center">
            通过注册手机号接收验证码并重置密码；多企业账号请填写企业 ID
          </CardDescription>
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
                  placeholder="多企业同号时必填，如 10000"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <div className="login-input">
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="11 位中国大陆手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp">短信验证码（6 位）</Label>
              <div className="flex gap-2">
                <div className="login-input flex-1">
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="tracking-widest"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sendingOtp || cooldown > 0}
                  onClick={() => void doSendOtp()}
                >
                  {cooldown > 0 ? `${cooldown}s` : sendingOtp ? '发送中…' : '获取验证码'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">新密码（至少 6 位）</Label>
              <div className="login-input">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <div className="login-input">
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={loading || sendingOtp}
              className="w-full text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#1e3a6e,#2d5fa8)' }}
            >
              {loading ? '提交中…' : '重置密码'}
            </Button>
            <Button variant="link" asChild className="px-0">
              <Link to="/login">返回登录</Link>
            </Button>
            <SiteLegalFooter className="w-full" showProductTagline />
          </CardFooter>
        </form>
      </Card>

      <Dialog open={tenantPickerOpen} onOpenChange={setTenantPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择企业</DialogTitle>
            <DialogDescription>该手机号在多个企业中注册，请选择要重置密码的企业。</DialogDescription>
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
                  if (pendingAction === 'send') {
                    void doSendOtp(t.tenant_id)
                  } else if (pendingAction === 'reset') {
                    void doReset(t.tenant_id)
                  }
                  setPendingAction(null)
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
