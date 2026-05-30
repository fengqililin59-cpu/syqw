import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSidebarToken, sidebarFetch } from './sidebarAuth'

declare global {
  interface Window {
    wx: any
  }
}

type InitStatus = 'loading' | 'ready' | 'error'

export default function SidebarApp() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<InitStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    void initSdk()
  }, [])

  async function initSdk() {
    setStatus('loading')
    setErrorMsg('')
    try {
      const currentUrl = window.location.href.split('#')[0]
      const token = getSidebarToken()
      if (!token) {
        throw new Error('未检测到登录态，请先在浏览器登录系统')
      }

      const res = await sidebarFetch(
        `/api/v1/wework/jssdk-signature?url=${encodeURIComponent(currentUrl)}`,
      )
      const payload = await res.json()
      if (!res.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '获取签名失败')
      }
      const sig = payload.data

      await loadWxScript()

      await new Promise<void>((resolve, reject) => {
        window.wx.config({
          beta: true,
          debug: false,
          appId: sig.corpSign.appId,
          timestamp: sig.corpSign.timestamp,
          nonceStr: sig.corpSign.nonceStr,
          signature: sig.corpSign.signature,
          jsApiList: ['getCurExternalContact'],
        })
        window.wx.ready(() => resolve())
        window.wx.error((err: any) => reject(new Error(err?.errMsg || 'wx.config 初始化失败')))
      })

      await new Promise<void>((resolve, reject) => {
        window.wx.agentConfig({
          corpid: sig.agentSign.appId,
          agentid: Number(sig.agentSign.agentId),
          timestamp: sig.agentSign.timestamp,
          nonceStr: sig.agentSign.nonceStr,
          signature: sig.agentSign.signature,
          jsApiList: ['getCurExternalContact'],
          success: () => resolve(),
          fail: (err: any) => reject(new Error(err?.errMsg || JSON.stringify(err))),
        })
      })

      const contact = await new Promise<any>((resolve, reject) => {
        window.wx.invoke('getCurExternalContact', {}, (invokeRes: any) => {
          if (invokeRes?.err_msg === 'getCurExternalContact:ok') {
            resolve(invokeRes)
            return
          }
          reject(new Error(invokeRes?.err_msg || '获取当前客户失败'))
        })
      })

      const externalUserId = contact?.userId
      if (!externalUserId) {
        throw new Error('未能识别当前聊天客户')
      }

      setStatus('ready')
      navigate(`/sidebar/customer?uid=${encodeURIComponent(externalUserId)}`, { replace: true })
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err?.message || '初始化失败')
    }
  }

  async function loadWxScript(): Promise<void> {
    if (window.wx) return
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://res.wx.qq.com/open/js/jweixin-1.2.0.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('企微 SDK 加载失败'))
      document.head.appendChild(script)
    })
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 20, color: '#ef4444' }}>
        <p style={{ marginTop: 0 }}>初始化失败</p>
        <p style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all' }}>{errorMsg}</p>
        <button
          onClick={() => {
            void initSdk()
          }}
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <p>{status === 'ready' ? '跳转中...' : '加载中...'}</p>
    </div>
  )
}
