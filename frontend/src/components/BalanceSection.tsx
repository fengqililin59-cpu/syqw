/**
 * @file 余额展示 + 交易流水 + 充值 + 自动续费组件。
 * 充值流程：选择金额 → 选择支付方式（微信/支付宝/线下转账）→ 完成支付
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson, postJson, putJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { ALIPAY_UI_ENABLED } from '@/config/paymentFeatures'

interface BalanceData {
  balance: number
  total_recharged: number
  total_consumed: number
}

interface RechargePackage {
  id: number
  name: string
  amount: number
  bonus: number
}

interface TransactionRow {
  id: number
  type: 'recharge' | 'consume' | 'refund'
  amount: number
  balance_after: number
  channel: string
  description: string | null
  created_at: string
}

interface AutoRenewData {
  auto_renew: boolean
  auto_renew_plan_id: number | null
  auto_renew_cycle: string | null
}

interface RechargeOrderResult {
  out_trade_no: string
  code_url: string
  redirect_url?: string  // alipay page.pay redirect URL
  amount: number
  pay_channel: 'wechat' | 'alipay'
}

type PayChannel = 'wechat' | 'alipay' | 'transfer'
type RechargeStep = 'select-amount' | 'select-payment' | 'qr-display' | 'transfer-info' | 'paid'

const channelLabel: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  manual: '手动',
  transfer: '线下转账',
  auto_renew: '自动续费',
  addon_purchase: '加购包',
}

const COMPANY_BANK = {
  name: '杭州中数云科智慧科技有限公司',
  account: '3301041060007320900',
  bank: '杭州银行股份有限公司香积寺路支行',
}

function formatCny(amount: number) {
  return Number(amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
}

function formatDate(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm') : '—'
}

export function BalanceSection() {
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [packages, setPackages] = useState<RechargePackage[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [autoRenew, setAutoRenew] = useState<AutoRenewData | null>(null)
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [rechargeStep, setRechargeStep] = useState<RechargeStep>('select-amount')
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number>(0)
  const [selectedBonus, setSelectedBonus] = useState<number>(0)
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)
  const [payChannel, setPayChannel] = useState<PayChannel | null>(null)
  const [recharging, setRecharging] = useState(false)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [outTradeNo, setOutTradeNo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const loadBalance = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        getJson<BalanceData>('/billing/balance'),
        getJson<{ list: RechargePackage[] }>('/billing/balance/packages'),
      ])
      setBalance(b)
      setPackages(p.list || [])
    } catch {
      // ignore
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    try {
      const data = await getJson<{ list: TransactionRow[] }>('/billing/balance/transactions?size=30')
      setTransactions(data.list || [])
    } catch {
      // ignore
    }
  }, [])

  const loadAutoRenew = useCallback(async () => {
    try {
      const data = await getJson<AutoRenewData>('/billing/subscription/auto-renew')
      setAutoRenew(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadBalance()
    void loadTransactions()
    void loadAutoRenew()
  }, [loadBalance, loadTransactions, loadAutoRenew])

  function resetRechargeDialog() {
    stopPoll()
    setRechargeOpen(false)
    setRechargeStep('select-amount')
    setRechargeAmount('')
    setSelectedAmount(0)
    setSelectedBonus(0)
    setSelectedPackageId(null)
    setPayChannel(null)
    setRecharging(false)
    setQrSrc(null)
    setOutTradeNo(null)
    setError(null)
  }

  function selectAmount(amount: number, bonus: number, pkgId: number | null) {
    setSelectedAmount(amount)
    setSelectedBonus(bonus)
    setSelectedPackageId(pkgId)
    setError(null)
    setRechargeStep('select-payment')
  }

  function selectPayChannel(channel: PayChannel) {
    setPayChannel(channel)
    if (channel === 'transfer') {
      setRechargeStep('transfer-info')
    } else {
      void createRechargeOrder(channel)
    }
  }

  async function createRechargeOrder(channel: 'wechat' | 'alipay') {
    setRecharging(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        pay_channel: channel,
        amount: selectedAmount,
      }
      if (selectedPackageId) {
        body.amount_package_id = selectedPackageId
      }
      const result = await postJson<RechargeOrderResult>('/billing/balance/recharge-order', body)
      setOutTradeNo(result.out_trade_no)

      // 支付宝：直接跳转支付宝收银台，不用扫二维码
      if (channel === 'alipay' && result.redirect_url && !result.mock) {
        setRechargeStep('qr-display') // 复用等待状态
        startPolling(result.out_trade_no)
        window.open(result.redirect_url, '_blank')
      } else if (channel === 'alipay' && result.mock) {
        setRechargeStep('qr-display')
        startPolling(result.out_trade_no)
      } else {
        // 微信：显示二维码
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(result.code_url)}`
        setQrSrc(qrUrl)
        setRechargeStep('qr-display')
        startPolling(result.out_trade_no)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建充值订单失败')
    } finally {
      setRecharging(false)
    }
  }

  function startPolling(tradeNo: string) {
    stopPoll()
    pollRef.current = setInterval(() => {
      void getJson<{ status: string }>(`/billing/payment/${encodeURIComponent(tradeNo)}/status`)
        .then((st) => {
          if (st.status === 'paid') {
            stopPoll()
            setRechargeStep('paid')
            void Promise.all([loadBalance(), loadTransactions()])
          }
        })
        .catch(() => {})
    }, 2500)
  }

  async function handleTransferConfirm() {
    setRecharging(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        pay_channel: 'transfer',
        amount: selectedAmount,
      }
      if (selectedPackageId) {
        body.amount_package_id = selectedPackageId
      }
      const result = await postJson<{ balance: number; amount: number; bonus: number }>(
        '/billing/balance/recharge',
        body,
      )
      window.alert(
        `充值已提交！到账 ${formatCny(result.balance)}${result.bonus > 0 ? `（含赠送 ${formatCny(result.bonus)}）` : ''}\n请完成转账后联系平台方确认收款。`,
      )
      resetRechargeDialog()
      await Promise.all([loadBalance(), loadTransactions()])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setRecharging(false)
    }
  }

  async function handleAutoRenewToggle(enabled: boolean) {
    try {
      await putJson('/billing/subscription/auto-renew', { auto_renew: enabled })
      await loadAutoRenew()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '操作失败')
    }
  }

  function goBack() {
    if (rechargeStep === 'select-payment') {
      setRechargeStep('select-amount')
      setPayChannel(null)
      setError(null)
    }
  }

  return (
    <>
      <div id="balance-section">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>账户余额</CardTitle>
              <CardDescription>充值余额可用于自动续费或购买加购包，余额永不过期</CardDescription>
            </div>
            <Button onClick={() => { resetRechargeDialog(); setRechargeOpen(true); }}>充值</Button>
          </CardHeader>
          <CardContent>
            {balance ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-700">当前余额</p>
                  <p className="text-2xl font-semibold text-blue-900">{formatCny(balance.balance)}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-4 py-3">
                  <p className="text-sm text-green-700">累计充值</p>
                  <p className="text-2xl font-semibold text-green-900">{formatCny(balance.total_recharged)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-600">累计消费</p>
                  <p className="text-2xl font-semibold text-slate-800">{formatCny(balance.total_consumed)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">加载中…</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50/50 px-4 py-3">
              <div>
                <span className="text-sm font-medium">自动续费</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  开启后套餐到期将从余额自动扣款续费，余额不足则降为体验版
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {autoRenew?.auto_renew ? (
                  <>
                    <Badge className="bg-green-600 hover:bg-green-600">已开启</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleAutoRenewToggle(false)}>
                      关闭
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary">未开启</Badge>
                    <Button size="sm" onClick={() => handleAutoRenewToggle(true)}>
                      开启自动续费
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <Accordion type="single">
              <AccordionItem value="transactions">
                <AccordionTrigger value="transactions">余额交易记录</AccordionTrigger>
                <AccordionContent value="transactions">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>余额</TableHead>
                        <TableHead>渠道</TableHead>
                        <TableHead>说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{formatDate(t.created_at)}</TableCell>
                          <TableCell>
                            {t.type === 'recharge' ? (
                              <Badge className="bg-green-600 hover:bg-green-600">充值</Badge>
                            ) : t.type === 'consume' ? (
                              <Badge className="bg-orange-500 hover:bg-orange-500">消费</Badge>
                            ) : (
                              <Badge variant="secondary">退款</Badge>
                            )}
                          </TableCell>
                          <TableCell className={t.amount > 0 ? 'text-green-700' : 'text-orange-700'}>
                            {t.amount > 0 ? '+' : ''}{formatCny(t.amount)}
                          </TableCell>
                          <TableCell>{formatCny(t.balance_after)}</TableCell>
                          <TableCell>{channelLabel[t.channel] || t.channel}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{t.description || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            暂无交易记录
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* 充值弹窗 — 多步骤 */}
      <Dialog open={rechargeOpen} onOpenChange={(o) => { if (!o) resetRechargeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rechargeStep === 'select-amount' && '选择充值金额'}
              {rechargeStep === 'select-payment' && '选择支付方式'}
              {rechargeStep === 'qr-display' && `${payChannel === 'wechat' ? '微信扫码支付' : '支付宝扫码支付'}`}
              {rechargeStep === 'transfer-info' && '线下转账充值'}
              {rechargeStep === 'paid' && '支付成功'}
            </DialogTitle>
            {rechargeStep === 'select-payment' && (
              <DialogDescription>
                充值金额：{formatCny(selectedAmount)}
                {selectedBonus > 0 ? `（含赠送 ${formatCny(selectedBonus)}）` : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {/* Step 1: 选择金额 */}
          {rechargeStep === 'select-amount' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className="rounded-lg border p-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
                    onClick={() => selectAmount(pkg.amount, pkg.bonus, pkg.id)}
                  >
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-lg font-bold text-blue-700">{formatCny(pkg.amount)}</p>
                    {pkg.bonus > 0 ? (
                      <p className="text-xs text-green-600">赠送 {formatCny(pkg.bonus)}</p>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="border-t pt-3">
                <Label>自定义金额</Label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    placeholder="输入充值金额"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    min={1}
                    step={0.01}
                  />
                  <Button
                    disabled={!rechargeAmount}
                    onClick={() => {
                      const amt = parseFloat(rechargeAmount)
                      if (isNaN(amt) || amt <= 0) return
                      selectAmount(amt, 0, null)
                    }}
                  >
                    下一步
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Step 2: 选择支付方式 */}
          {rechargeStep === 'select-payment' ? (
            <div className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-green-400 hover:bg-green-50"
                onClick={() => selectPayChannel('wechat')}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl">💚</span>
                <div>
                  <p className="font-semibold">微信支付</p>
                  <p className="text-sm text-muted-foreground">打开微信扫一扫完成支付</p>
                </div>
              </button>
              {ALIPAY_UI_ENABLED ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
                  onClick={() => selectPayChannel('alipay')}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xl">💙</span>
                  <div>
                    <p className="font-semibold">支付宝</p>
                    <p className="text-sm text-muted-foreground">跳转到支付宝页面完成支付</p>
                  </div>
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-slate-400 hover:bg-slate-50"
                onClick={() => selectPayChannel('transfer')}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl">🏦</span>
                <div>
                  <p className="font-semibold">线下转账</p>
                  <p className="text-sm text-muted-foreground">通过对公账户转账，联系平台方确认</p>
                </div>
              </button>
            </div>
          ) : null}

          {/* Step 3: 支付等待 */}
          {rechargeStep === 'qr-display' ? (
            <div className="flex flex-col items-center gap-3 py-2">
              {recharging ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {payChannel === 'alipay' ? '正在跳转到支付宝…' : '正在生成支付二维码…'}
                </div>
              ) : null}
              {payChannel === 'alipay' ? (
                <div className="rounded-lg bg-blue-50 px-4 py-6 text-center space-y-3">
                  <p className="text-4xl">💙</p>
                  <p className="font-semibold text-blue-800">已在新窗口打开支付宝收银台</p>
                  <p className="text-sm text-blue-600">请在新打开的页面完成支付，支付成功后本页将自动刷新</p>
                  <p className="text-xs text-muted-foreground">
                    金额：{formatCny(selectedAmount)}{selectedBonus > 0 ? `（到账含赠送 ${formatCny(selectedBonus)}）` : ''}
                  </p>
                  {outTradeNo ? (
                    <p className="text-xs text-muted-foreground">订单号：{outTradeNo}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-2">
                    如未弹出窗口，请检查浏览器是否拦截了弹窗，或<a href="#" className="text-blue-600 underline" onClick={(e) => { e.preventDefault(); window.open('about:blank', '_blank'); }}>点击尝试手动打开</a>
                  </p>
                </div>
              ) : (
                <>
                  {qrSrc ? (
                    <>
                      <img src={qrSrc} alt="支付二维码" width={220} height={220} className="rounded-lg border" />
                      <p className="text-center text-xs text-muted-foreground">
                        请使用微信「扫一扫」完成支付，支付成功后本页将自动刷新。
                      </p>
                      <p className="text-xs text-muted-foreground">
                        金额：{formatCny(selectedAmount)}{selectedBonus > 0 ? `（到账含赠送 ${formatCny(selectedBonus)}）` : ''}
                      </p>
                      {outTradeNo ? (
                        <p className="text-xs text-muted-foreground">订单号：{outTradeNo}</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* Step 4: 线下转账信息 */}
          {rechargeStep === 'transfer-info' ? (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">账户名称</span>
                  <span className="font-medium">{COMPANY_BANK.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">账号</span>
                  <span className="font-mono font-medium">{COMPANY_BANK.account}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">开户行</span>
                  <span className="font-medium">{COMPANY_BANK.bank}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                充值金额：<strong>{formatCny(selectedAmount)}</strong>
                {selectedBonus > 0 ? <span className="text-green-600">（含赠送 {formatCny(selectedBonus)}）</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                请完成转账后联系平台方确认收款，确认后余额将自动到账。
              </p>
              <Button
                className="w-full"
                disabled={recharging}
                onClick={() => void handleTransferConfirm()}
              >
                {recharging ? '提交中…' : '确认已转账，提交充值申请'}
              </Button>
            </div>
          ) : null}

          {/* Step: 支付成功 */}
          {rechargeStep === 'paid' ? (
            <div className="rounded-lg bg-green-50 px-3 py-4 text-center text-sm font-medium text-green-800">
              支付成功，余额已到账！
            </div>
          ) : null}

          <DialogFooter>
            {rechargeStep === 'select-payment' ? (
              <Button variant="outline" onClick={goBack}>返回修改金额</Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => resetRechargeDialog()}
            >
              {rechargeStep === 'paid' ? '关闭' : '取消'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
