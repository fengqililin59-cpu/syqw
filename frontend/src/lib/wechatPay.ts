/**
 * @file 微信内浏览器检测与 JSAPI 调起支付。
 */

export type WechatJsapiParams = {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

export function isWechatInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

export function invokeWechatJsapiPay(params: WechatJsapiParams): Promise<'ok' | 'cancel' | 'fail'> {
  return new Promise((resolve, reject) => {
    const onBridgeReady = () => {
      const bridge = (window as Window & { WeixinJSBridge?: { invoke: (...args: unknown[]) => void } })
        .WeixinJSBridge
      if (!bridge?.invoke) {
        reject(new Error('无法调起微信支付'))
        return
      }
      bridge.invoke(
        'getBrandWCPayRequest',
        {
          appId: params.appId,
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
        },
        (res: { err_msg?: string }) => {
          const msg = res?.err_msg || ''
          if (msg.includes(':ok')) resolve('ok')
          else if (msg.includes(':cancel')) resolve('cancel')
          else resolve('fail')
        },
      )
    }

    const w = window as Window & { WeixinJSBridge?: unknown }
    if (typeof w.WeixinJSBridge === 'undefined') {
      document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false)
    } else {
      onBridgeReady()
    }
  })
}
