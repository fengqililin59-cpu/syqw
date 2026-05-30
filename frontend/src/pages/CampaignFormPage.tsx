/**
 * @file 创建 / 编辑裂变活动表单。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createCampaign, fetchCampaign, updateCampaign } from '@/api/campaigns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function toDatetimeLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CampaignFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState('task_treasure')
  const [targetCount, setTargetCount] = useState(3)
  const [rewardType, setRewardType] = useState('coupon')
  const [rewardValue, setRewardValue] = useState('{"description":"满100减20优惠券"}')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')

  useEffect(() => {
    if (!isEdit || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const c = await fetchCampaign(Number(id))
        if (cancelled) return
        setName(c.name)
        setType(c.type)
        setTargetCount(c.target_count)
        setRewardType(c.reward_type)
        setRewardValue(
          typeof c.reward_value === 'string' ? c.reward_value : JSON.stringify(c.reward_value, null, 2),
        )
        setStartLocal(toDatetimeLocalInput(c.start_time))
        setEndLocal(toDatetimeLocalInput(c.end_time))
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, id])

  useEffect(() => {
    if (isEdit) return
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    setStartLocal(toDatetimeLocalInput(now.toISOString()))
    setEndLocal(toDatetimeLocalInput(end.toISOString()))
  }, [isEdit])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      let parsedReward: string | Record<string, unknown> = rewardValue.trim()
      if (parsedReward.startsWith('{') || parsedReward.startsWith('[')) {
        parsedReward = JSON.parse(parsedReward) as Record<string, unknown>
      }
      const body = {
        name: name.trim(),
        type,
        target_count: targetCount,
        reward_type: rewardType,
        reward_value: parsedReward,
        start_time: new Date(startLocal).toISOString(),
        end_time: new Date(endLocal).toISOString(),
      }
      if (isEdit && id) {
        await updateCampaign(Number(id), body)
        navigate(`/app/campaigns/${id}`, { replace: true })
      } else {
        const created = await createCampaign(body)
        navigate(`/app/campaigns/${created.id}`, { replace: true })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link to="/app/campaigns">
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? '编辑活动' : '新建活动'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="name">活动名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ctype">活动类型</Label>
                <select
                  id="ctype"
                  className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="task_treasure">任务宝</option>
                  <option value="group_share">拼团分享</option>
                  <option value="red_packet">红包裂变</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">目标邀请人数</Label>
                <Input
                  id="target"
                  type="number"
                  min={1}
                  max={1000}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtype">奖品类型</Label>
              <select
                id="rtype"
                className={cn(
                  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                value={rewardType}
                onChange={(e) => setRewardType(e.target.value)}
              >
                <option value="points">积分</option>
                <option value="coupon">优惠券</option>
                <option value="redpacket">红包</option>
                <option value="exchange_code">兑换码</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reward">奖品配置（JSON 或纯文案）</Label>
              <textarea
                id="reward"
                value={rewardValue}
                onChange={(e) => setRewardValue(e.target.value)}
                rows={4}
                className={cn(
                  'flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
                  'font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">开始时间</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">结束时间</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
