/**
 * @file 客户详情页的「持卡」区块：查看持卡、开卡、核销、充值。
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  cardRemainingText,
  consumeCard,
  createCard,
  fetchCustomerCards,
  rechargeCard,
  CARD_STATUS_COLOR,
  CARD_STATUS_LABEL,
  type CardType,
  type CustomerCard,
} from '@/api/customerCards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  customerId: number
  canEdit: boolean
}

export function CustomerCardsSection({ customerId, canEdit }: Props) {
  const [cards, setCards] = useState<CustomerCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [cardType, setCardType] = useState<CardType>('times')
  const [name, setName] = useState('')
  const [totalTimes, setTotalTimes] = useState('10')
  const [totalAmount, setTotalAmount] = useState('2000')
  const [paidAmount, setPaidAmount] = useState('')
  const [validUntil, setValidUntil] = useState('')

  const [actionCard, setActionCard] = useState<CustomerCard | null>(null)
  const [actionKind, setActionKind] = useState<'consume' | 'recharge'>('consume')
  const [actionValue, setActionValue] = useState('1')
  const [actionReason, setActionReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchCustomerCards(customerId)
      setCards(res.list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setCardType('times')
    setName('')
    setTotalTimes('10')
    setTotalAmount('2000')
    setPaidAmount('')
    setValidUntil('')
    setError('')
    setCreateOpen(true)
  }

  async function submitCreate() {
    if (!name.trim()) {
      setError('请填写卡项名称')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createCard({
        customer_id: customerId,
        card_type: cardType,
        name: name.trim(),
        total_times: cardType === 'times' ? Number(totalTimes) : null,
        total_amount: cardType === 'stored' ? Number(totalAmount) : null,
        paid_amount: paidAmount === '' ? undefined : Number(paidAmount),
        valid_until: validUntil || null,
      })
      setCreateOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '开卡失败')
    } finally {
      setSaving(false)
    }
  }

  function openAction(card: CustomerCard, kind: 'consume' | 'recharge') {
    setActionCard(card)
    setActionKind(kind)
    setActionValue(kind === 'consume' && card.card_type === 'times' ? '1' : '')
    setActionReason('')
    setError('')
  }

  async function submitAction() {
    if (!actionCard) return
    const num = Number(actionValue)
    if (!num || num <= 0) {
      setError('请填写大于 0 的数值')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (actionKind === 'recharge') {
        await rechargeCard(actionCard.id, { amount: num, reason: actionReason || undefined })
      } else if (actionCard.card_type === 'times') {
        await consumeCard(actionCard.id, { times: num, reason: actionReason || undefined })
      } else {
        await consumeCard(actionCard.id, { amount: num, reason: actionReason || undefined })
      }
      setActionCard(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const actionUnitLabel =
    actionKind === 'recharge' ? '充值金额（元）' : actionCard?.card_type === 'times' ? '核销次数' : '核销金额（元）'

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">持卡</CardTitle>
          {canEdit ? (
            <Button size="sm" variant="ghost" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              开卡
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loading && cards.length === 0 ? <p className="text-muted-foreground">加载中…</p> : null}
          {!loading && cards.length === 0 ? (
            <p className="text-xs text-muted-foreground">该客户还没有卡项。开卡后可核销消耗，并自动进入复购提醒。</p>
          ) : null}

          {cards.map((card) => (
            <div key={card.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{card.name}</div>
                  <div className="text-xs text-muted-foreground">{card.card_type_label}</div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] text-white"
                  style={{ background: CARD_STATUS_COLOR[card.status] }}
                >
                  {CARD_STATUS_LABEL[card.status]}
                </span>
              </div>

              <div className="mt-2 tabular-nums">{cardRemainingText(card)}</div>
              {card.valid_until ? (
                <div className="text-xs text-muted-foreground">
                  有效期至 {card.valid_until}
                  {card.days_to_expire != null && card.days_to_expire >= 0
                    ? `（还剩 ${card.days_to_expire} 天）`
                    : ''}
                </div>
              ) : null}

              {canEdit && card.status === 'active' ? (
                <div className="mt-2 flex gap-2">
                  {card.card_type !== 'period' ? (
                    <Button size="sm" variant="outline" onClick={() => openAction(card, 'consume')}>
                      核销
                    </Button>
                  ) : null}
                  {card.card_type === 'stored' ? (
                    <Button size="sm" variant="outline" onClick={() => openAction(card, 'recharge')}>
                      充值
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}

          {error && !createOpen && !actionCard ? <p className="text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开卡</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="card-type">卡项类型</Label>
              <select
                id="card-type"
                value={cardType}
                onChange={(e) => setCardType(e.target.value as CardType)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="times">次卡（按次消耗）</option>
                <option value="stored">储值卡（按金额消耗）</option>
                <option value="period">期限卡（按有效期）</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-name">卡项名称</Label>
              <Input
                id="card-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：小气泡清洁 10 次卡"
              />
            </div>

            {cardType === 'times' ? (
              <div className="space-y-1.5">
                <Label htmlFor="card-times">总次数</Label>
                <Input
                  id="card-times"
                  type="number"
                  min={1}
                  value={totalTimes}
                  onChange={(e) => setTotalTimes(e.target.value)}
                />
              </div>
            ) : null}

            {cardType === 'stored' ? (
              <div className="space-y-1.5">
                <Label htmlFor="card-amount">卡内面值（元）</Label>
                <Input
                  id="card-amount"
                  type="number"
                  min={0}
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="card-paid">实付金额（元）</Label>
              <Input
                id="card-paid"
                type="number"
                min={0}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="计入客户累计消费，留空按 0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-until">有效期至{cardType === 'period' ? '' : '（选填）'}</Label>
              <Input
                id="card-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={submitCreate} disabled={saving}>
              {saving ? '保存中…' : '确认开卡'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionCard != null} onOpenChange={(open) => !open && setActionCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionKind === 'recharge' ? '充值' : '核销'} · {actionCard?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {actionCard ? (
              <p className="text-sm text-muted-foreground">当前：{cardRemainingText(actionCard)}</p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="action-value">{actionUnitLabel}</Label>
              <Input
                id="action-value"
                type="number"
                min={0}
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="action-reason">备注（选填）</Label>
              <Input
                id="action-reason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="如：本次到店做了小气泡"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionCard(null)} disabled={saving}>
              取消
            </Button>
            <Button onClick={submitAction} disabled={saving}>
              {saving ? '提交中…' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
