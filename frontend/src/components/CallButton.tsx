import { useState, type MouseEvent } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { hangupCall, initiateCall, type CallRecord } from '@/api/calls'
import { useAuthStore } from '@/store/authStore'
import { hasPermUser } from '@/lib/roles'

interface CallButtonProps {
  customerId: number
  customerName: string
  customerPhone: string | null
  size?: 'sm' | 'default'
  /** 客户详情页主操作：绿色主按钮 +「一键外呼」文案 */
  prominent?: boolean
  className?: string
}

function notify(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);
    background:${type === 'success' ? '#16a34a' : '#ef4444'};
    color:#fff;padding:8px 16px;border-radius:8px;z-index:9999;font-size:13px;
    max-width:min(92vw,420px);text-align:center;line-height:1.4;
  `
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3200)
}

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
}

/** 本机拨打：手机调起拨号盘，电脑复制号码 */
function dialNative(phone: string) {
  const cleaned = phone.replace(/\s/g, '')
  if (isMobileDevice()) {
    window.location.href = `tel:${cleaned}`
    return
  }
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(cleaned).then(() => {
      notify(`号码已复制：${cleaned}，请用手机拨打`, 'success')
    })
    return
  }
  notify(`请用手机拨打：${cleaned}`, 'success')
}

function dialTel(phone: string) {
  window.location.href = `tel:${phone.replace(/\s/g, '')}`
}

function callFailedMessage(record: CallRecord) {
  const reason = String(record.failure_reason || '').trim()
  if (/模拟外呼/.test(reason)) {
    return `${reason}。也可在「设置→个人设置」改用「本机直接拨打」。`
  }
  if (/TCCC|SecretId|SecretKey|配置/.test(reason)) {
    return '云外呼未配置。请在「设置→云服务配置」填写 TCCC，或改用「本机直接拨打」。'
  }
  if (/请先在设置中填写您的手机号/.test(reason)) {
    return '请先在「设置 → 个人设置 → 我的外呼设置」填写您的手机号。'
  }
  return reason || '发起外呼失败，请稍后重试'
}

function handleCallSuccess(res: CallRecord, customerName: string, phone: string) {
  if (res.dial_mode === 'native') {
    notify(`正在拨打 ${customerName}（${phone}）`, 'success')
    dialNative(phone)
    return { calling: false as const, callId: null as number | null }
  }
  const modeHint =
    res.dial_mode === 'phone'
      ? '系统将先呼叫您的手机，接通后再转接客户'
      : '请在网页接听'
  notify(`正在拨打 ${customerName}（${phone}）… ${modeHint}`, 'success')
  return { calling: true as const, callId: res.id }
}

export default function CallButton({
  customerId,
  customerName,
  customerPhone,
  size = 'default',
  prominent = false,
  className,
}: CallButtonProps) {
  const [calling, setCalling] = useState(false)
  const [callId, setCallId] = useState<number | null>(null)
  const permissions = useAuthStore((s) => s.permissions)
  const canCall = hasPermUser(permissions, 'call:make')

  if (!canCall) return null

  const phone = String(customerPhone || '').trim()
  if (!phone) {
    return (
      <Button
        variant="ghost"
        size={size}
        disabled
        className={className}
        title="客户未填写手机号"
      >
        <Phone className="h-4 w-4 text-gray-300" />
        {prominent ? <span className="ml-1.5 text-muted-foreground">暂无号码</span> : null}
      </Button>
    )
  }

  async function handleCall() {
    if (calling) {
      try {
        if (callId) await hangupCall(callId)
      } finally {
        setCalling(false)
        setCallId(null)
      }
      return
    }

    try {
      const res = await initiateCall(customerId)
      if (res.status === 'failed') {
        notify(callFailedMessage(res), 'error')
        return
      }
      const next = handleCallSuccess(res, customerName, phone)
      setCalling(next.calling)
      setCallId(next.callId)
    } catch (err) {
      setCalling(false)
      const msg = err instanceof Error ? err.message : '发起通话失败'
      if (/手机号|TCCC|外呼|配置|模拟外呼/i.test(msg)) {
        notify(msg, 'error')
      } else {
        notify(`${msg}。您也可点击号码用手机直接拨打。`, 'error')
        dialTel(phone)
      }
    }
  }

  const label = prominent ? '一键外呼' : '外呼'

  return (
    <Button
      variant={calling ? 'destructive' : prominent ? 'default' : 'outline'}
      size={size}
      onClick={() => void handleCall()}
      className={
        prominent && !calling
          ? `bg-emerald-600 hover:bg-emerald-700 text-white ${className || ''}`
          : className
      }
      title={calling ? '点击挂断' : `拨打 ${phone}`}
    >
      {calling ? (
        <>
          <PhoneOff className="mr-1 h-4 w-4" />
          {size !== 'sm' && '挂断'}
        </>
      ) : (
        <>
          <Phone className={`mr-1 h-4 w-4 ${prominent ? '' : 'text-green-600'}`} />
          {size !== 'sm' && label}
        </>
      )}
    </Button>
  )
}

/** 手机号旁快捷外呼（详情页号码行） */
export function PhoneCallLink({
  customerId,
  customerName,
  phone,
}: {
  customerId: number
  customerName: string
  phone: string
}) {
  const permissions = useAuthStore((s) => s.permissions)
  const canCall = hasPermUser(permissions, 'call:make')
  const [busy, setBusy] = useState(false)

  if (!canCall) {
    return <span>{phone}</span>
  }

  async function onClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const res = await initiateCall(customerId)
      if (res.status === 'failed') {
        notify(callFailedMessage(res), 'error')
        return
      }
      handleCallSuccess(res, customerName, phone)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '外呼失败'
      notify(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      className="inline-flex items-center gap-1 rounded-md text-emerald-700 underline-offset-2 hover:text-emerald-800 hover:underline disabled:opacity-60"
      title="点击拨打"
      disabled={busy}
    >
      <Phone className="h-3.5 w-3.5" />
      {phone}
    </button>
  )
}

export function CallSetupHint() {
  const permissions = useAuthStore((s) => s.permissions)
  const canManage = hasPermUser(permissions, 'settings:manage')
  return (
    <p className="text-xs text-muted-foreground">
      个人用户可在
      <Link to="/app/settings" className="mx-0.5 text-emerald-700 hover:underline">
        设置
      </Link>
      选择「本机直接拨打」，无需开通 TCCC。
      {canManage ? '团队云外呼请在云服务配置中填写 TCCC。' : null}
    </p>
  )
}
