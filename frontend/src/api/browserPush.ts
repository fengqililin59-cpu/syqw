/**
 * @file 浏览器 Push API — 订阅/取消订阅/VAPID公钥
 */
import { getJson, postJson } from '@/api/client'

export interface VapidPublicKeyResult {
  publicKey: string
}

export interface PushSubscriptionStatus {
  active_subscriptions: number
}

/** 获取 VAPID 公钥 */
export function fetchVapidPublicKey(): Promise<{ success: boolean; data: VapidPublicKeyResult }> {
  return getJson('/browser-push/vapid-public-key')
}

/** 获取订阅状态 */
export function fetchPushStatus(): Promise<{ success: boolean; data: PushSubscriptionStatus }> {
  return getJson('/browser-push/status')
}

/** 保存浏览器 Push 订阅 */
export function subscribePush(subscription: PushSubscriptionJSON & { user_agent?: string; device_name?: string }): Promise<{ success: boolean }> {
  return postJson('/browser-push/subscribe', subscription)
}

/** 取消浏览器 Push 订阅 */
export function unsubscribePush(endpoint: string): Promise<{ success: boolean }> {
  return postJson('/browser-push/unsubscribe', { endpoint })
}

/**
 * URL-safe base64 转 Uint8Array（VAPID 公钥转换）
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
