import { useCallback, useEffect, useState } from 'react'
import { getJson, postJson } from '@/api/client'
import {
  createMigrationCampaign,
  generateMigrationScript,
  getMigrationCampaignDetail,
  importMigrationContacts,
  listMigrationCampaigns,
  listMigrationRecords,
  patchMigrationRecordStatus,
  updateMigrationCampaign,
  type MigrationCampaignDetail,
  type MigrationCampaignRow,
  type MigrationRecordRow,
} from '@/api/migration'
import { hasPermUser } from '@/lib/roles'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus } from 'lucide-react'

type ChannelOption = { id: number; name: string; state?: string | null }

const statusLabel: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  ended: '已结束',
}

const recordStatusLabel: Record<string, string> = {
  pending: '待迁移',
  contacted: '已触达',
  migrated: '已迁移',
  lost: '已流失',
}

export function MigrationPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const canView = hasPermUser(permissions, 'campaign:view')
  const canManage = hasPermUser(permissions, 'campaign:manage')
  const canAi = hasPermUser(permissions, 'ai:use')

  const [tab, setTab] = useState<'campaigns' | 'records'>('campaigns')
  const [campaigns, setCampaigns] = useState<MigrationCampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<MigrationCampaignDetail | null>(null)
  const [records, setRecords] = useState<MigrationRecordRow[]>([])
  const [recTotal, setRecTotal] = useState(0)
  const [recPage, setRecPage] = useState(1)
  const [recStatus, setRecStatus] = useState('')
  const recSize = 20

  const [channels, setChannels] = useState<ChannelOption[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formChannelId, setFormChannelId] = useState<string>('')
  const [formWelcome, setFormWelcome] = useState('')
  const [formScript, setFormScript] = useState('')
  const [formTarget, setFormTarget] = useState('0')
  const [formStarts, setFormStarts] = useState('')
  const [formEnds, setFormEnds] = useState('')
  const [saving, setSaving] = useState(false)
  const [campaignStatusSaving, setCampaignStatusSaving] = useState(false)

  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)

  const [manualNick, setManualNick] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualRemark, setManualRemark] = useState('')

  const loadCampaigns = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setErr(null)
    try {
      const res = await listMigrationCampaigns({ page: 1, size: 100 })
      setCampaigns(res.list)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [canView])

  const loadChannels = useCallback(async () => {
    if (!canManage) return
    try {
      const list = await getJson<ChannelOption[]>('/channel-live/channels')
      setChannels(list)
    } catch {
      setChannels([])
    }
  }, [canManage])

  useEffect(() => {
    void loadCampaigns()
  }, [loadCampaigns])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  const loadDetailAndRecords = useCallback(
    async (cid: number, page = 1) => {
      const d = await getMigrationCampaignDetail(cid)
      setDetail(d)
      const r = await listMigrationRecords(cid, {
        page,
        size: recSize,
        status: recStatus || undefined,
      })
      setRecords(r.list)
      setRecTotal(r.total)
      setRecPage(r.page)
    },
    [recSize, recStatus],
  )

  useEffect(() => {
    if (selectedId != null && tab === 'records') {
      void loadDetailAndRecords(selectedId, 1).catch((e) => setErr(e instanceof Error ? e.message : '加载失败'))
    }
  }, [selectedId, tab, loadDetailAndRecords])

  async function onCreateCampaign() {
    if (!formName.trim()) {
      window.alert('请填写活动名称')
      return
    }
    setSaving(true)
    try {
      const row = await createMigrationCampaign({
        name: formName.trim(),
        channel_live_code_id: formChannelId ? Number(formChannelId) : null,
        welcome_msg: formWelcome.trim() || null,
        script_template: formScript.trim() || null,
        target_count: Math.max(0, Number(formTarget) || 0),
        status: 'draft',
        starts_at: formStarts ? `${formStarts}T00:00:00` : null,
        ends_at: formEnds ? `${formEnds}T23:59:59` : null,
      })
      const hint = row.suggested_contact_state
        ? `请在企微「联系我」中将渠道 state 配置为：${row.suggested_contact_state}（与所选活码一致）`
        : ''
      window.alert(`创建成功。${hint}`)
      setCreateOpen(false)
      setFormName('')
      setFormChannelId('')
      setFormWelcome('')
      setFormScript('')
      setFormTarget('0')
      setFormStarts('')
      setFormEnds('')
      await loadCampaigns()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await importMigrationContacts(selectedId, fd)
      window.alert(`导入完成：成功 ${res.imported}，跳过 ${res.skipped}`)
      await loadDetailAndRecords(selectedId, recPage)
    } catch (er) {
      window.alert(er instanceof Error ? er.message : '导入失败')
    }
    e.target.value = ''
  }

  async function onManualAdd() {
    if (!selectedId) return
    try {
      await postJson(`/migration/campaigns/${selectedId}/import`, {
        contacts: [
          {
            wx_nickname: manualNick.trim() || null,
            wx_phone: manualPhone.trim() || null,
            wx_remark: manualRemark.trim() || null,
          },
        ],
      })
      setManualNick('')
      setManualPhone('')
      setManualRemark('')
      await loadDetailAndRecords(selectedId, recPage)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '添加失败')
    }
  }

  async function onPatchStatus(id: number, status: string) {
    try {
      await patchMigrationRecordStatus(id, { status })
      if (selectedId) await loadDetailAndRecords(selectedId, recPage)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '更新失败')
    }
  }

  async function onGenerateScript(recordId: number) {
    setScriptOpen(true)
    setScriptText('')
    setScriptLoading(true)
    try {
      const { text } = await generateMigrationScript(recordId)
      setScriptText(text)
    } catch (e) {
      setScriptText(e instanceof Error ? e.message : '生成失败')
    } finally {
      setScriptLoading(false)
    }
  }

  function openRecords(c: MigrationCampaignRow) {
    setSelectedId(c.id)
    setTab('records')
  }

  async function onSetCampaignStatus(campaignId: number, status: 'active' | 'ended') {
    setCampaignStatusSaving(true)
    try {
      await updateMigrationCampaign(campaignId, { status })
      await loadCampaigns()
      if (selectedId === campaignId) {
        await loadDetailAndRecords(campaignId, recPage)
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '更新失败')
    } finally {
      setCampaignStatusSaving(false)
    }
  }

  const funnel = detail?.funnel
  const selectedCampaignRow = selectedId != null ? campaigns.find((c) => c.id === selectedId) : null
  const detailStatus = detail?.campaign.status ?? selectedCampaignRow?.status

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户迁移</h1>
          <p className="text-sm text-muted-foreground">
            引导个人微信好友添加企业微信；获客回调需配置渠道 state 为 <code className="rounded bg-muted px-1">mc_活动ID_租户ID</code>
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            新建活动
          </Button>
        ) : null}
      </div>

      {!canView ? <p className="text-sm text-destructive">缺少权限：campaign:view</p> : null}

      <div className="flex gap-2 border-b pb-2">
        <Button variant={tab === 'campaigns' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('campaigns')}>
          迁移活动
        </Button>
        <Button
          variant={tab === 'records' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setTab('records')}
          disabled={!selectedId}
        >
          迁移名单
          {selectedId ? ` (#${selectedId})` : ''}
        </Button>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {tab === 'campaigns' && canView ? (
        <div className="grid gap-3 md:grid-cols-2">
          {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
          {!loading && campaigns.length === 0 ? <p className="text-sm text-muted-foreground">暂无活动</p> : null}
          {campaigns.map((c) => {
            const target = Math.max(0, c.target_count || 0)
            const mig = Math.max(0, c.migrated_count || 0)
            const pct = target > 0 ? Math.min(100, Math.round((100 * mig) / target)) : 0
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{statusLabel[c.status] || c.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-muted-foreground">
                    已迁移 {mig} / 目标 {target} · 迁移率 {target > 0 ? `${pct}%` : '—'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openRecords(c)}>
                      查看详情 / 名单
                    </Button>
                    {canManage && c.status === 'draft' ? (
                      <Button
                        size="sm"
                        disabled={campaignStatusSaving}
                        onClick={() => void onSetCampaignStatus(c.id, 'active')}
                      >
                        设为进行中
                      </Button>
                    ) : null}
                    {canManage && c.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={campaignStatusSaving}
                        onClick={() => {
                          if (window.confirm('确定结束该迁移活动？结束后将不再统计新回调。')) {
                            void onSetCampaignStatus(c.id, 'ended')
                          }
                        }}
                      >
                        结束活动
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {tab === 'records' && selectedId && canView ? (
        <div className="space-y-4">
          {detail ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{detail.campaign.name}</p>
                  <Badge variant={detailStatus === 'active' ? 'default' : 'secondary'}>
                    {detailStatus ? statusLabel[detailStatus] || detailStatus : '—'}
                  </Badge>
                </div>
              {detail.campaign.suggested_contact_state ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  建议渠道 state：<span className="font-mono">{detail.campaign.suggested_contact_state}</span>
                  {detail.campaign.live_channel?.state ? (
                    <span> · 当前活码 state：{detail.campaign.live_channel.state}</span>
                  ) : null}
                </p>
              ) : null}
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {detailStatus === 'draft' ? (
                    <Button
                      size="sm"
                      disabled={campaignStatusSaving}
                      onClick={() => selectedId != null && void onSetCampaignStatus(selectedId, 'active')}
                    >
                      设为进行中
                    </Button>
                  ) : null}
                  {detailStatus === 'active' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={campaignStatusSaving}
                      onClick={() => {
                        if (window.confirm('确定结束该迁移活动？结束后将不再统计新回调。')) {
                          selectedId != null && void onSetCampaignStatus(selectedId, 'ended')
                        }
                      }}
                    >
                      结束活动
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {funnel ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(
                [
                  ['待迁移', funnel.pending],
                  ['已触达', funnel.contacted],
                  ['已迁移', funnel.migrated],
                  ['已流失', funnel.lost],
                ] as const
              ).map(([label, n]) => (
                <Card key={label}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold">{n}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">导入联系人</CardTitle>
                <CardDescription>Excel/CSV 表头支持：昵称、手机、备注</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">上传文件</Label>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void onImportFile(e)} />
                </div>
                <div className="flex flex-wrap gap-2 border-l pl-3">
                  <Input placeholder="昵称" value={manualNick} onChange={(e) => setManualNick(e.target.value)} className="w-28" />
                  <Input placeholder="手机" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} className="w-36" />
                  <Input placeholder="备注" value={manualRemark} onChange={(e) => setManualRemark(e.target.value)} className="w-28" />
                  <Button type="button" variant="secondary" size="sm" onClick={() => void onManualAdd()}>
                    添加一条
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={recStatus}
              onChange={(e) => setRecStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              {Object.entries(recordStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                selectedId &&
                void loadDetailAndRecords(selectedId, 1).catch((e) => setErr(e instanceof Error ? e.message : '加载失败'))
              }
            >
              筛选
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>昵称</TableHead>
                <TableHead>手机</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>销售</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.wx_nickname || '—'}</TableCell>
                  <TableCell>{r.wx_phone || '—'}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.wx_remark || '—'}</TableCell>
                  <TableCell>{r.owner?.real_name || r.owner?.username || '—'}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <select
                        className="h-8 rounded border border-input bg-background px-1 text-xs"
                        value={r.status}
                        onChange={(e) => void onPatchStatus(r.id, e.target.value)}
                      >
                        {Object.entries(recordStatusLabel).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      recordStatusLabel[r.status] || r.status
                    )}
                  </TableCell>
                  <TableCell>
                    {canAi ? (
                      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => void onGenerateScript(r.id)}>
                        生成话术
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无名单
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              共 {recTotal} 条 · 第 {recPage} 页
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={recPage <= 1}
                onClick={() => selectedId && void loadDetailAndRecords(selectedId, recPage - 1)}
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={recPage * recSize >= recTotal}
                onClick={() => selectedId && void loadDetailAndRecords(selectedId, recPage + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建迁移活动</DialogTitle>
            <DialogDescription>保存后请把渠道活码的 state 配成系统提示的 mc_ 格式，并将活动置为「进行中」以接收回调。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>活动名称</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label>关联渠道活码</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={formChannelId}
                onChange={(e) => setFormChannelId(e.target.value)}
              >
                <option value="">不关联（自行配置）</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} (#{ch.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>欢迎语（迁移成功后发给客户）</Label>
              <Textarea value={formWelcome} onChange={(e) => setFormWelcome(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>话术模板（可选，用于 AI 生成）</Label>
              <Textarea value={formScript} onChange={(e) => setFormScript(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>目标人数</Label>
              <Input type="number" min={0} value={formTarget} onChange={(e) => setFormTarget(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>开始日期</Label>
                <Input type="date" value={formStarts} onChange={(e) => setFormStarts(e.target.value)} />
              </div>
              <div>
                <Label>结束日期</Label>
                <Input type="date" value={formEnds} onChange={(e) => setFormEnds(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onCreateCampaign()} disabled={saving}>
              {saving ? '保存中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>个性化话术</DialogTitle>
            <DialogDescription>请复制后发送到个人微信；不会自动保存。</DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={scriptLoading ? '生成中…' : scriptText} rows={8} className="font-mono text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(scriptText)}>
              复制
            </Button>
            <Button onClick={() => setScriptOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
