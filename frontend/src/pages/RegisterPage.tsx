/**
 * @file 企业注册页：可选邮箱/短信验证码后创建租户与管理员。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJson, getJsonWithToken, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore, type AuthUser } from '@/store/authStore'
import { getAttributionToken, getLandingAttribution, saveLandingAttributionFromUrl } from '@/utils/attribution'
import { permListFromMeResponse, type MePermissionsResponse } from '@/lib/permApi'
import { markShowAiGuideAfterRegister } from '@/lib/aiOnboarding'
import ZhiFlowLogo from '@/components/ZhiFlowLogo'
import { SiteLegalFooter } from '@/components/SiteLegalFooter'

type RegisterRes = {
  token: string
  tenant: { id: number; name: string }
  user: AuthUser
}

type RegisterOptions = {
  otpRequired: boolean
  channels: ('email' | 'sms')[]
}

type SendOtpRes = {
  ok: boolean
  expiresInSec: number
  devMode?: boolean
  devCode?: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [opts, setOpts] = useState<RegisterOptions | null>(null)
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [tenantName, setTenantName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [realName, setRealName] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    saveLandingAttributionFromUrl()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const o = await getJson<RegisterOptions>('/auth/register/options')
        if (cancelled) return
        setOpts(o)
        if (o.channels.includes('email')) setChannel('email')
        else if (o.channels.includes('sms')) setChannel('sms')
      } catch {
        if (!cancelled) setOpts({ otpRequired: false, channels: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function onSendOtp() {
    setErr(null)
    if (!username.trim()) {
      setErr(channel === 'email' ? '请先填写邮箱' : '请先填写手机号')
      return
    }
    setSendingOtp(true)
    try {
      const data = await postJson<SendOtpRes>('/auth/register/send-otp', { channel, target: username.trim() })
      setCooldown(60)
      if (data?.devMode && data?.devCode) {
        setOtpCode(String(data.devCode))
        setErr(`开发模式验证码：${data.devCode}（已自动填入）`)
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '发送失败')
    } finally {
      setSendingOtp(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        tenant_name: tenantName,
        username: username.trim(),
        password,
        real_name: realName || undefined,
        attribution_token: getAttributionToken() || undefined,
        landing_from: getLandingAttribution().from,
        landing_variant: getLandingAttribution().variant,
        landing_cta: getLandingAttribution().cta,
      }
      if (otpRequired) {
        body.register_channel = channel
        body.register_target = username.trim()
        body.otp_code = otpCode.trim()
      }
      const data = await postJson<RegisterRes>('/auth/register', body)
      localStorage.setItem('last_tenant_id', String(data.tenant.id))
      useAuthStore.setState({ token: data.token })
      const perm = await getJsonWithToken<MePermissionsResponse>('/auth/me/permissions', data.token)
      setSession({
        token: data.token,
        tenantId: data.tenant.id,
        tenantName: data.tenant.name,
        user: data.user,
        permissions: permListFromMeResponse(perm),
      })
      markShowAiGuideAfterRegister()
      navigate('/app', { replace: true })
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const optsLoading = opts === null
  const otpRequired = opts?.otpRequired ?? false
  const channels = opts?.channels ?? []
  const showChannelSwitch = channels.length > 1
  const otpMisconfigured = otpRequired && channels.length === 0

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4">
      <Card className="mx-auto w-full max-w-[380px] rounded-2xl border border-[#dde8f5] bg-white p-2 shadow-xl shadow-blue-100/30">
        <CardHeader>
          <div className="mb-4 flex flex-col items-center">
            <ZhiFlowLogo size="lg" showText />
          </div>
          <CardTitle>企业注册</CardTitle>
          <CardDescription>
            {otpRequired ? '请先验证邮箱或手机号，再创建企业与管理员账号' : '创建企业与管理员账号'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {otpMisconfigured ? (
              <p className="text-sm text-amber-700 dark:text-amber-500">
                已开启注册验证码，但服务端未配置 SMTP 或 SMS_WEBHOOK_URL，请联系管理员。
              </p>
            ) : null}
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            {showChannelSwitch ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={channel === 'email' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setChannel('email')}
                >
                  邮箱注册
                </Button>
                <Button
                  type="button"
                  variant={channel === 'sms' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setChannel('sms')}
                >
                  手机号注册
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tenantName">企业名称</Label>
              <div className="login-input">
                <Input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">
                {otpRequired ? (channel === 'email' ? '管理员邮箱' : '管理员手机号') : '管理员账号'}
              </Label>
              <div className="login-input">
                <Input
                  id="username"
                  type={otpRequired ? (channel === 'email' ? 'email' : 'tel') : 'text'}
                  autoComplete={otpRequired ? (channel === 'email' ? 'email' : 'tel') : 'username'}
                  placeholder={otpRequired ? (channel === 'email' ? 'name@example.com' : '11 位手机号') : '登录用户名'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              {otpRequired ? (
                <p className="text-xs text-muted-foreground">
                  登录账号与此相同，验证码将发至该{channel === 'email' ? '邮箱' : '手机号'}。
                </p>
              ) : null}
            </div>
            {otpRequired ? (
              <div className="space-y-2">
                <Label htmlFor="otp">验证码（6 位数字）</Label>
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
                  <Button type="button" variant="secondary" disabled={sendingOtp || cooldown > 0} onClick={onSendOtp}>
                    {cooldown > 0 ? `${cooldown}s` : sendingOtp ? '发送中…' : '获取验证码'}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="password">密码（至少 6 位）</Label>
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
              <Label htmlFor="realName">真实姓名（可选）</Label>
              <div className="login-input">
                <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="submit"
              disabled={loading || optsLoading}
              className="w-full text-white hover:opacity-90 sm:w-auto"
              style={{ background: 'linear-gradient(135deg,#1e3a6e,#2d5fa8)' }}
            >
              {loading ? '提交中…' : '注册并登录'}
            </Button>
            <Button variant="link" asChild className="px-0">
              <Link to="/login">已有账号？去登录</Link>
            </Button>
            <p className="w-full text-center text-[11px] leading-relaxed text-[#8aabb8]">
              注册即表示同意
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#5b8dd9]">
                《服务条款》
              </a>
              和
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#5b8dd9]">
                《隐私政策》
              </a>
            </p>
            <SiteLegalFooter className="w-full" showProductTagline />
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
