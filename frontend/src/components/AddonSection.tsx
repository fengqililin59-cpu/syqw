/**
 * @file 用量加购包购买与管理。
 */
import { useCallback, useEffect, useState } from 'react'
import { getJson, postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import dayjs from 'dayjs'

interface AddonPackage {
  id: number
  name: string
  code: string
  resource_type: string
  quantity: number
  price: number
  duration_months: number
}

interface ActiveAddon {
  id: number
  resource_type: string
  addon_name: string
  quantity: number
  consumed: number
  remaining: number
  expires_at: string
  created_at: string
}

const resourceLabels: Record<string, string> = {
  customers: '客户数',
  seats: '席位',
  broadcasts: '群发',
  ai_calls: 'AI调用',
}

function formatCny(amount: number) {
  return Number(amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })
}

export function AddonSection() {
  const [packages, setPackages] = useState<AddonPackage[]>([])
  const [activeAddons, setActiveAddons] = useState<ActiveAddon[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [purchasing, setPurchasing] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [pkgs, mine] = await Promise.all([
        getJson<{ list: AddonPackage[] }>('/billing/addons'),
        getJson<{ summary: Record<string, number>; list: ActiveAddon[] }>('/billing/addons/mine'),
      ])
      setPackages(pkgs.list || [])
      setActiveAddons(mine.list || [])
      setSummary(mine.summary || {})
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handlePurchase(pkgId: number) {
    setPurchasing(pkgId)
    try {
      await postJson('/billing/addons/purchase', { addon_package_id: pkgId })
      window.alert('购买成功！加购包已生效')
      await load()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '购买失败')
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>用量加购包</CardTitle>
          <CardDescription>
            套餐配额不够？购买临时加购包扩展额度。从余额扣款，有效期1个月
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(summary).length > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(summary).map(([type, qty]) =>
                qty > 0 ? (
                  <div key={type} className="rounded-lg bg-green-50 px-3 py-2">
                    <p className="text-xs text-green-600">{resourceLabels[type] || type}</p>
                    <p className="text-lg font-bold text-green-800">+{qty.toLocaleString()}</p>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex flex-col justify-between rounded-lg border p-3">
                <div>
                  <h4 className="font-semibold">{pkg.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {resourceLabels[pkg.resource_type] || pkg.resource_type} · 有效期{pkg.duration_months}个月
                  </p>
                  <p className="mt-1 text-lg font-bold text-blue-700">{formatCny(pkg.price)}</p>
                </div>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  disabled={purchasing !== null}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {purchasing === pkg.id ? '购买中…' : '购买'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeAddons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>我的加购包</CardTitle>
            <CardDescription>有效期内未消耗完的加购包</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left">加购包</th>
                    <th className="p-3 text-left">类型</th>
                    <th className="p-3 text-left">已用/总量</th>
                    <th className="p-3 text-left">剩余</th>
                    <th className="p-3 text-left">到期</th>
                    <th className="p-3 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAddons.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="p-3">{a.addon_name}</td>
                      <td className="p-3">{resourceLabels[a.resource_type] || a.resource_type}</td>
                      <td className="p-3">
                        <div className="h-2 w-24 rounded bg-gray-200">
                          <div
                            className="h-2 rounded bg-blue-500"
                            style={{ width: `${Math.min(100, (a.consumed / Math.max(1, a.quantity)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {a.consumed} / {a.quantity}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{a.remaining.toLocaleString()}</td>
                      <td className="p-3 text-xs">{dayjs(a.expires_at).format('YYYY-MM-DD')}</td>
                      <td className="p-3">
                        {a.remaining > 0 ? (
                          <Badge className="bg-green-600 hover:bg-green-600">有效</Badge>
                        ) : (
                          <Badge variant="secondary">已用完</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
