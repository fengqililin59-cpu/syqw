/**
 * @file 微信支付收银台（封装 OnlinePayCheckoutDialog）。
 */
import {
  OnlinePayCheckoutDialog,
  type OnlinePayChannel,
} from '@/components/OnlinePayCheckoutDialog'

type CheckoutPayload = {
  plan_code: string
  plan_name: string
  billing_cycle: 'monthly' | 'yearly'
  amount_label: string
}

export function WechatPayCheckoutDialog({
  open,
  onOpenChange,
  payload,
  resumeOrder,
  onPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: CheckoutPayload | null
  resumeOrder?: { out_trade_no: string; code_url: string } | null
  onPaid: () => void
}) {
  return (
    <OnlinePayCheckoutDialog
      channel="wechat"
      open={open}
      onOpenChange={onOpenChange}
      payload={payload}
      resumeOrder={resumeOrder}
      onPaid={onPaid}
    />
  )
}

export type { OnlinePayChannel }
