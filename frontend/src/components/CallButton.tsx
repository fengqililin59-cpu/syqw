import { useState } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hangupCall, initiateCall } from '@/api/calls'
import { useAuthStore } from '@/store/authStore'

interface CallButtonProps {
  customerId: number
  customerName: string
  customerPhone: string | null
  size?: 'sm' | 'default'
}

function notify(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);
    background:${type === 'success' ? '#16a34a' : '#ef4444'};
    color:#fff;padding:8px 16px;border-radius:8px;z-index:9999;font-size:13px;
  `
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2400)
}

export default function CallButton({ customerId, customerName, customerPhone, size = 'default' }: CallButtonProps) {
  const [calling, setCalling] = useState(false)
  const [callId, setCallId] = useState<number | null>(null)
  const hasPerm = useAuthStore((s) => s.hasPerm)

  if (!hasPerm('call:make')) return null
  if (!customerPhone) {
    return (
      <Button variant="ghost" size={size} disabled title="客户未填写手机号">
        <Phone className="h-4 w-4 text-gray-300" />
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
    setCalling(true)
    try {
      const res = await initiateCall(customerId)
      setCallId(res.id)
      notify(`正在拨打 ${customerName}...`, 'success')
    } catch (err) {
      setCalling(false)
      const msg = err instanceof Error ? err.message : '发起通话失败，请检查外呼设置'
      notify(msg, 'error')
    }
  }

  return (
    <Button
      variant={calling ? 'destructive' : 'outline'}
      size={size}
      onClick={() => void handleCall()}
      title={calling ? '点击挂断' : `拨打 ${customerPhone}`}
    >
      {calling ? (
        <>
          <PhoneOff className="mr-1 h-4 w-4" />
          {size !== 'sm' && '挂断'}
        </>
      ) : (
        <>
          <Phone className="mr-1 h-4 w-4 text-green-600" />
          {size !== 'sm' && '电话'}
        </>
      )}
    </Button>
  )
}
