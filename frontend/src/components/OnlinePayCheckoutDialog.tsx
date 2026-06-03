/**
 * @file 在线支付收银台（微信 Native / JSAPI、支付宝 Native 扫码 + 轮询）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getJson, postJson } from '@/api/client'
import { invokeWechatJsapiPay, isWechatInAppBrowser, type WechatJsapiParams } from '@/lib/wechatPay'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ALIPAY_UI_ENABLED } from '@/config/paymentFeatures'

export type OnlinePayChannel = 'wechat' | 'alipay'

type PaymentChannels = {
  wechat: { enabled: boolean; mock: boolean; jsapi_enabled?: boolean }
  alipay: { enabled: boolean; mock: boolean }
}

type CheckoutPayload = {
  plan_code: string
  plan_name: string
  billing_cycle: 'monthly' | 'yearly'
  amount_label: string
}

type ResumeOrder = {
  out_trade_no: string
  code_url: string
  pay_mode?: 'native' | 'jsapi' | null
}

type OnlineOrder = {
  out_trade_no: string
  code_url?: string
  redirect_url?: string  // alipay page.pay 跳转 URL
  pay_mode?: 'native' | 'jsapi'
  jsapi_params?: WechatJsapiParams
  wechat_mock?: boolean
  alipay_mock?: boolean
}

const CHANNEL_META: Record<
  OnlinePayChannel,
  { titleNative: string; titleJsapi: string; scanHint: string; channelKey: keyof PaymentChannels }
> = {
  wechat: {
    titleNative: '微信扫码支付',
    titleJsapi: '微信支付',
    scanHint: '请使用微信「扫一扫」完成支付，支付成功后本页将自动刷新。',
    channelKey: 'wechat',
  },
  alipay: {
    titleNative: '支付宝支付',
    titleJsapi: '支付宝支付',
    scanHint: '已跳转到支付宝收银台，请在弹出页面中完成支付。支付成功后本页将自动刷新。',
    channelKey: 'alipay',
  },
}

function shouldUseWechatJsapi(channel: OnlinePayChannel, channels: PaymentChannels | null) {
  if (channel !== 'wechat') return false
  if (!isWechatInAppBrowser()) return false
  return channels?.wechat?.jsapi_enabled === true
}

export function OnlinePayCheckoutDialog({
  channel,
  open,
  onOpenChange,
  payload,
  resumeOrder,
  onPaid,
}: {
  channel: OnlinePayChannel
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: CheckoutPayload | null
  resumeOrder?: ResumeOrder | null
  onPaid: () => void
}) {
  const meta = CHANNEL_META[channel]
  const [channels, setChannels] = useState<PaymentChannels | null>(null)
  const jsapiMode = shouldUseWechatJsapi(channel, channels)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OnlineOrder | null>(null)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [mockMode, setMockMode] = useState(false)
  const [oauthPending, setOauthPending] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const applyCodeUrl = useCallback((url: string, outTradeNo: string) => {
    setOrder({ out_trade_no: outTradeNo, code_url: url, pay_mode: 'native' })
    setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`)
  }, [])

  const startPoll = useCallback(
    (outTradeNo: string) => {
      stopPoll()
      pollRef.current = setInterval(() => {
        void getJson<{ status: string }>(`/billing/payment/${encodeURIComponent(outTradeNo)}/status`)
          .then((st) => {
            if (st.status === 'paid') {
              setPaid(true)
              stopPoll()
              onPaid()
            }
          })
          .catch(() => {})
      }, 2500)
    },
    [onPaid, stopPoll],
  )

  const invokeJsapi = useCallback(
    async (params: WechatJsapiParams, outTradeNo: string) => {
      try {
        const result = await invokeWechatJsapiPay(params)
        if (result === 'ok') {
          setPaid(true)
          stopPoll()
          onPaid()
          return
        }
        if (result === 'cancel') {
          setError('已取消支付')
          startPoll(outTradeNo)
          return
        }
        setError('支付未完成，请重试')
        startPoll(outTradeNo)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '调起支付失败')
        startPoll(outTradeNo)
      }
    },
    [onPaid, startPoll, stopPoll],
  )

  const ensureWechatOAuth = useCallback(async (returnTo: string) => {
    const ready = await getJson<{
      jsapi_enabled: boolean
      openid_bound: boolean
      oauth_url: string | null
    }>(`/billing/wechat/jsapi-ready?return_to=${encodeURIComponent(returnTo)}`)
    if (!ready.openid_bound && ready.oauth_url) {
      setOauthPending(true)
      window.location.href = ready.oauth_url
      return false
    }
    return true
  }, [])

  const startCheckout = useCallback(async () => {
    if (channel === 'alipay' && !ALIPAY_UI_ENABLED) {
      setError('支付宝支付暂未开放，请使用微信或线下转账')
      return
    }
    const returnTo = '/app/billing'
    const resumeIsJsapi =
      resumeOrder?.pay_mode === 'jsapi' ||
      (resumeOrder?.code_url && resumeOrder.code_url.startsWith('jsapi:'))

    if (resumeOrder?.out_trade_no && resumeIsJsapi && channel === 'wechat') {
      setError(null)
      setPaid(false)
      setOrder({ out_trade_no: resumeOrder.out_trade_no, pay_mode: 'jsapi' })
      void getJson<PaymentChannels>('/billing/payment/channels')
        .then((ch) => {
          setChannels(ch)
          setMockMode(ch.wechat?.mock === true)
        })
        .catch(() => {})
      startPoll(resumeOrder.out_trade_no)
      return
    }

    if (resumeOrder?.code_url && resumeOrder.out_trade_no && !resumeIsJsapi) {
      setError(null)
      setPaid(false)
      // 支付宝使用跳转，不需要二维码
      if (channel === 'alipay') {
        const isMockUrl = resumeOrder.code_url.startsWith('mock:alipay:')
        void getJson<PaymentChannels>('/billing/payment/channels')
          .then((ch) => {
            setChannels(ch)
            const mock = ch.alipay?.mock === true
            setMockMode(mock)
            setOrder({
              out_trade_no: resumeOrder.out_trade_no,
              redirect_url: mock || isMockUrl ? undefined : resumeOrder.code_url,
              alipay_mock: mock || isMockUrl,
            })
          })
          .catch(() => {
            setOrder({
              out_trade_no: resumeOrder.out_trade_no,
              redirect_url: isMockUrl ? undefined : resumeOrder.code_url,
              alipay_mock: isMockUrl,
            })
          })
        startPoll(resumeOrder.out_trade_no)
        if (!resumeOrder.code_url.startsWith('mock:alipay:')) {
          window.open(resumeOrder.code_url, '_blank')
        }
      } else {
        applyCodeUrl(resumeOrder.code_url, resumeOrder.out_trade_no)
        void getJson<PaymentChannels>('/billing/payment/channels')
          .then((ch) => {
            setChannels(ch)
            setMockMode(ch[meta.channelKey]?.mock === true)
          })
          .catch(() => {})
      }
      return
    }

    if (!payload) return
    setLoading(true)
    setError(null)
    setOrder(null)
    setQrSrc(null)
    setPaid(false)
    try {
      const ch = await getJson<PaymentChannels>('/billing/payment/channels')
      setChannels(ch)
      setMockMode(ch[meta.channelKey]?.mock === true)
      if (!ch[meta.channelKey]?.enabled) {
        setError(`${meta.titleNative.replace('扫码', '')}未开通，请使用其他支付方式`)
        return
      }

      const useJsapi = shouldUseWechatJsapi(channel, ch)
      if (useJsapi) {
        if (!(await ensureWechatOAuth(returnTo))) return
        const row = await postJson<OnlineOrder>('/billing/payment', {
          plan_code: payload.plan_code,
          billing_cycle: payload.billing_cycle,
          pay_channel: 'wechat_jsapi',
        })
        setOrder(row)
        if (row.jsapi_params) {
          await invokeJsapi(row.jsapi_params, row.out_trade_no)
        } else {
          startPoll(row.out_trade_no)
        }
        return
      }

      const row = await postJson<OnlineOrder>('/billing/payment', {
        plan_code: payload.plan_code,
        billing_cycle: payload.billing_cycle,
        pay_channel: channel,
      })

      // 支付宝：真实环境跳转收银台；MOCK 仅在本弹窗内模拟支付
      if (channel === 'alipay') {
        setOrder(row)
        startPoll(row.out_trade_no)
        if (row.redirect_url && !row.alipay_mock) {
          window.open(row.redirect_url, '_blank')
        }
      } else {
        const url = row.code_url
        if (url) applyCodeUrl(url, row.out_trade_no)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建订单失败')
    } finally {
      setLoading(false)
    }
  }, [
    payload,
    resumeOrder,
    applyCodeUrl,
    channel,
    meta.channelKey,
    meta.titleNative,
    ensureWechatOAuth,
    invokeJsapi,
    startPoll,
  ])

  useEffect(() => {
    if (open && (payload || resumeOrder)) void startCheckout()
    if (!open) {
      stopPoll()
      setOrder(null)
      setError(null)
      setPaid(false)
      setOauthPending(false)
    }
    return () => stopPoll()
  }, [open, payload, resumeOrder, startCheckout, stopPoll])

  useEffect(() => {
    if (!order?.out_trade_no || paid || jsapiMode) return
    startPoll(order.out_trade_no)
    return () => stopPoll()
  }, [order?.out_trade_no, paid, jsapiMode, startPoll, stopPoll])

  async function simulatePay() {
    if (!order?.out_trade_no) return
    setLoading(true)
    try {
      const mockPath =
        channel === 'wechat' ? '/billing/webhooks/wechat/mock' : '/billing/webhooks/alipay/mock'
      await postJson(mockPath, { out_trade_no: order.out_trade_no })
      setPaid(true)
      stopPoll()
      onPaid()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '模拟支付失败')
    } finally {
      setLoading(false)
    }
  }

  const title = jsapiMode ? meta.titleJsapi : meta.titleNative

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {payload ? `${payload.plan_name} · ${payload.amount_label}` : null}
          </DialogDescription>
        </DialogHeader>

        {oauthPending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">正在跳转微信授权…</p>
        ) : null}

        {loading && !order && !oauthPending ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {jsapiMode ? '正在发起支付…' : '正在生成支付二维码…'}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {paid ? (
          <p className="rounded-lg bg-green-50 px-3 py-4 text-center text-sm font-medium text-green-800">
            支付成功，套餐已自动开通。
          </p>
        ) : null}

        {!paid && !jsapiMode && order && channel === 'alipay' && (order.redirect_url || mockMode) ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg bg-blue-50 px-4 py-6 text-center space-y-3 w-full">
              <p className="text-4xl">💙</p>
              <p className="font-semibold text-blue-800">
                {mockMode ? '本地开发：支付宝模拟支付' : '已在新窗口打开支付宝收银台'}
              </p>
              <p className="text-sm text-blue-600">
                {mockMode
                  ? '点击下方按钮模拟支付成功，无需打开支付宝页面'
                  : '请在新打开的页面完成支付，支付成功后本页将自动刷新'}
              </p>
              <p className="text-xs text-muted-foreground">
                订单号：{order.out_trade_no}
              </p>
              <p className="text-xs text-muted-foreground">
                如未弹出窗口，请检查浏览器是否拦截了弹窗
              </p>
            </div>
            {mockMode ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void simulatePay()} disabled={loading}>
                开发模式：模拟支付成功
              </Button>
            ) : null}
          </div>
        ) : null}

        {!paid && !jsapiMode && order && qrSrc && channel !== 'alipay' ? (
          <div className="flex flex-col items-center gap-3">
            <img src={qrSrc} alt="支付二维码" width={220} height={220} className="rounded-lg border" />
            <p className="text-center text-xs text-muted-foreground">{meta.scanHint}</p>
            <p className="text-xs text-muted-foreground">订单号：{order.out_trade_no}</p>
            {mockMode ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void simulatePay()} disabled={loading}>
                开发模式：模拟支付成功
              </Button>
            ) : null}
          </div>
        ) : null}

        {!paid && jsapiMode && order ? (
          <div className="space-y-3 py-2 text-center text-sm text-muted-foreground">
            <p>已在微信内发起支付，请完成付款。</p>
            <p className="text-xs">订单号：{order.out_trade_no}</p>
            {mockMode ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void simulatePay()} disabled={loading}>
                开发模式：模拟支付成功
              </Button>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {paid ? '关闭' : '取消'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
