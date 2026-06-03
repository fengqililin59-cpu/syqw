/**
 * @file usePushSubscription — 浏览器推送订阅管理 Hook
 *
 * 封装 Service Worker 注册 + Push 订阅全流程：
 * 1. 注册 Service Worker
 * 2. 获取 VAPID 公钥
 * 3. 请求浏览器推送权限
 * 4. 创建 PushSubscription
 * 5. 发送订阅信息到后端
 */
import { useState, useEffect, useCallback } from 'react'
import {
  fetchVapidPublicKey,
  subscribePush,
  unsubscribePush,
  fetchPushStatus,
  urlBase64ToUint8Array,
} from '@/api/browserPush'

interface UsePushSubscriptionReturn {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  permissionState: NotificationPermission | null
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(null)

  const isSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window

  // 注册 Service Worker
  const registerSW = useCallback(async (): Promise<ServiceWorkerRegistration> => {
    if (!isSupported) throw new Error('浏览器不支持推送通知')

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // 等待 SW 激活
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') resolve()
        })
      })
    } else if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    return registration
  }, [isSupported])

  // 订阅推送
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('浏览器不支持推送通知')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. 请求通知权限
      const permission = await Notification.requestPermission()
      setPermissionState(permission)

      if (permission !== 'granted') {
        throw new Error('未获得通知权限')
      }

      // 2. 注册 Service Worker
      const registration = await registerSW()

      // 3. 获取 VAPID 公钥
      const { data: { publicKey } } = await fetchVapidPublicKey()

      // 4. 创建 push 订阅
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      })

      // 5. 发送订阅到后端
      const subJSON = pushSubscription.toJSON()
      await subscribePush({
        ...subJSON,
        user_agent: navigator.userAgent,
        device_name: navigator.platform || 'Unknown',
      })

      setIsSubscribed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '订阅失败')
      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, registerSW])

  // 取消订阅
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return

    setIsLoading(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await unsubscribePush(subscription.endpoint)
      }

      setIsSubscribed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消订阅失败')
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  // 初始化：检查已有订阅状态
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false)
      return
    }

    const init = async () => {
      try {
        setPermissionState(Notification.permission)

        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          // 已有订阅，检查后端状态
          const { data } = await fetchPushStatus()
          setIsSubscribed(data.active_subscriptions > 0)
        }
      } catch {
        // 静默失败
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [isSupported])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    permissionState,
  }
}
