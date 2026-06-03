/**
 * @file 客户管理：分页列表、标签筛选、导入导出、转移；新建/编辑支持标签。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, SlidersHorizontal, Upload, X, Download, Tags, UserPlus, ArrowRight, Trash2, CheckSquare, Square } from 'lucide-react'
import { deleteJson, getJson, postJson, putJson } from '@/api/client'
import { fetchTags } from '@/api/tags'
import { exportCustomers, downloadImportTemplate, batchOperateCustomers } from '@/api/customers'
import type {
  CustomerIntentScoreResult,
  CustomerRow,
  Paginated,
  TagRow,
  UserRow,
  WeworkChatMessage,
} from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { canManageStaffUser, hasPermUser } from '@/lib/roles'
import { ImportDrawer } from '@/components/ImportDrawer'
import CallButton from '@/components/CallButton'
import SmsButton from '@/components/SmsButton'

const stages = [
  { value: 'new', label: '新线索' },
  { value: 'intent_confirm', label: '意向确认' },
  { value: 'proposal', label: '方案报价' },
  { value: 'negotiation', label: '商务谈判' },
  { value: 'deal', label: '成交' },
  { value: 'lost', label: '流失' },
  { value: 'contacted', label: '已联系（旧数据）' },
  { value: 'intent', label: '有意向（旧数据）' },
]

const stageLabels: Record<string, string> = {
  new: '新线索',
  intent_confirm: '意向确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  lost: '流失',
  contacted: '已联系',
  intent: '有意向',
}

/** 表单内阶段选项（含历史枚举，便于编辑旧数据） */
const stageFormChoices = [
  ...stages.slice(0, 6),
  { value: 'contacted', label: '已联系（旧）' },
  { value: 'intent', label: '有意向（旧）' },
]

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function intentScoreEmoji(score: number) {
  if (score >= 80) return '🔥'
  if (score >= 50) return '⚠️'
  return '❄️'
}

export function CustomersPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const permissions = useAuthStore((s) => s.permissions)
  const canManageUsers = canManageStaffUser(permissions)
  const canEdit = hasPermUser(permissions, 'customer:edit')
  const canDelete = hasPermUser(permissions, 'customer:delete')
  const canExport = hasPermUser(permissions, 'customer:export')
  const canImport = hasPermUser(permissions, 'customer:import')
  const [list, setList] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [tags, setTags] = useState<TagRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [keyword, setKeyword] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerRow | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [wechatId, setWechatId] = useState('')
  const [company, setCompany] = useState('')
  const [stage, setStage] = useState('new')
  const [source, setSource] = useState('')
  const [remark, setRemark] = useState('')
  const [intentionLevel, setIntentionLevel] = useState(3)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [formOwnerId, setFormOwnerId] = useState('')
  const [optOutAutoMsg, setOptOutAutoMsg] = useState(false)

  const [transferTarget, setTransferTarget] = useState<CustomerRow | null>(null)
  const [transferUserId, setTransferUserId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // 导出对话框
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFields, setExportFields] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [exportLoading, setExportLoading] = useState(false)
  const [availableExportFields, setAvailableExportFields] = useState<string[]>([])

  // 批量操作加载
  const [batchLoading, setBatchLoading] = useState(false)

  // 批量操作对话框
  const [batchTagOpen, setBatchTagOpen] = useState(false)
  const [batchTagIds, setBatchTagIds] = useState<number[]>([])
  const [batchAssignOpen, setBatchAssignOpen] = useState(false)
  const [batchAssignUserId, setBatchAssignUserId] = useState('')
  const [batchStageOpen, setBatchStageOpen] = useState(false)
  const [batchStage, setBatchStage] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCustomer] = useState<CustomerRow | null>(null)
  const [detailFollowUps, setDetailFollowUps] = useState<
    Array<{ id: number; content: string; created_at: string; type?: string }>
  >([])
  const [quickFollowUp, setQuickFollowUp] = useState('')

  const [chatMsgs, setChatMsgs] = useState<WeworkChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [lastScoreHint, setLastScoreHint] = useState<string | null>(null)

  const [rollbackTarget, setRollbackTarget] = useState<CustomerRow | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [rollbackLoading, setRollbackLoading] = useState(false)

  const loadMeta = useCallback(async () => {
    try {
      const [tagRows, userRes] = await Promise.all([
        fetchTags(),
        getJson<Paginated<UserRow>>('/users?page=1&size=200'),
      ])
      setTags(tagRows)
      setUsers(userRes.list)
    } catch {
      setTags([])
      setUsers([])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), size: '20' })
      if (keyword.trim()) q.set('keyword', keyword.trim())
      if (stageFilter) q.set('stage', stageFilter)
      if (tagFilter) q.set('tag_id', tagFilter)
      if (canManageUsers && ownerFilter) q.set('owner_id', ownerFilter)
      const res = await getJson<Paginated<CustomerRow>>(`/customers?${q.toString()}`)
      setList(res.list)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [page, keyword, stageFilter, tagFilter, ownerFilter, canManageUsers])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!open || !editing?.id) {
      setChatMsgs([])
      return
    }
    let cancelled = false
    setChatLoading(true)
    void getJson<{ list: WeworkChatMessage[] }>(`/customers/${editing.id}/messages`)
      .then((r) => {
        if (!cancelled) setChatMsgs(r.list)
      })
      .catch(() => {
        if (!cancelled) setChatMsgs([])
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, editing?.id])

  async function refreshIntentScore(force: boolean) {
    if (!editing) return
    setScoreLoading(true)
    setLastScoreHint(null)
    try {
      const data = await postJson<CustomerIntentScoreResult>(`/customers/${editing.id}/score-intent`, {
        force,
      })
      if (data.throttled) {
        setLastScoreHint('距上次评分不足 10 分钟，未重复计算（可勾选强制刷新）')
        return
      }
      setLastScoreHint(data.advice ? `建议：${data.advice}` : null)
      setEditing((prev) =>
        prev
          ? {
              ...prev,
              intent_score: data.intent_score,
              intent_tier: data.intent_tier ?? prev.intent_tier,
              intent_stage_label: data.intent_stage_label ?? prev.intent_stage_label,
              intent_confidence: data.intent_confidence ?? prev.intent_confidence,
              intent_rule_score: data.intent_rule_score ?? prev.intent_rule_score,
              intent_ai_score: data.intent_ai_score ?? prev.intent_ai_score,
              last_scored_at: data.last_scored_at ?? prev.last_scored_at,
              followup_count: prev.followup_count,
              priority: prev.priority,
              last_followup_at: prev.last_followup_at,
            }
          : null,
      )
      await load()
    } finally {
      setScoreLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setPhone('')
    setWechatId('')
    setCompany('')
    setStage('new')
    setSource('')
    setRemark('')
    setIntentionLevel(3)
    setSelectedTagIds([])
    setFormOwnerId(user?.id != null ? String(user.id) : '')
    setOptOutAutoMsg(false)
    setLastScoreHint(null)
    setOpen(true)
  }

  function openEdit(row: CustomerRow) {
    setEditing(row)
    setName(row.name || '')
    setPhone(row.phone || '')
    setWechatId(row.wechat_id || '')
    setCompany(row.company || '')
    setStage(row.stage || 'new')
    setSource(row.source || '')
    setRemark(row.remark || '')
    setIntentionLevel(row.intention_level ?? 3)
    setSelectedTagIds(row.tags?.map((t) => t.id) ?? [])
    setFormOwnerId(String(row.owner_id ?? ''))
    setOptOutAutoMsg(Boolean(row.opt_out_auto_msg))
    setLastScoreHint(null)
    setOpen(true)
  }

  async function onSave() {
    const body: {
      name?: string
      phone?: string
      wechat_id?: string
      company?: string
      stage: string
      source?: string
      remark?: string
      intention_level: number
      owner_id?: number
      opt_out_auto_msg?: boolean
    } = {
      name: name || undefined,
      phone: phone || undefined,
      wechat_id: wechatId || undefined,
      company: company || undefined,
      stage,
      source: source || undefined,
      remark: remark || undefined,
      intention_level: intentionLevel,
      opt_out_auto_msg: optOutAutoMsg,
    }
    if (canManageUsers && formOwnerId) {
      body.owner_id = Number(formOwnerId)
    }
    try {
      if (editing) {
        await putJson(`/customers/${editing.id}`, body)
        await putJson(`/customers/${editing.id}/tags`, { tag_ids: selectedTagIds })
      } else {
        const created = await postJson<CustomerRow>('/customers', body)
        if (selectedTagIds.length > 0) {
          await putJson(`/customers/${created.id}/tags`, { tag_ids: selectedTagIds })
        }
      }
      setOpen(false)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败，请重试或查看网络请求详情')
    }
  }

  async function onDelete(row: CustomerRow) {
    if (!window.confirm(`确定删除客户「${row.name || row.phone || row.id}」？`)) return
    await deleteJson(`/customers/${row.id}`)
    await load()
  }

  // 导出功能（含字段选择对话框）
  async function openExportDialog() {
    try {
      // 获取导入模板头（含自定义字段），作为可导出字段列表
      const tpl = await downloadImportTemplate()
      const fields = [...new Set([...tpl.headers])]
      setAvailableExportFields(fields)
      setExportFields(fields) // 默认全选
      setExportOpen(true)
    } catch {
      // 降级：直接导出
      void doExport()
    }
  }

  async function doExport() {
    setExportLoading(true)
    try {
      const res = await exportCustomers({
        keyword: keyword.trim() || undefined,
        stage: stageFilter || undefined,
        tag_id: tagFilter || undefined,
        owner_id: canManageUsers && ownerFilter ? ownerFilter : undefined,
        fields: exportFields.length > 0 ? exportFields.join(',') : undefined,
        format: exportFormat === 'csv' ? 'csv' : undefined,
      })
      const mime =
        exportFormat === 'csv'
          ? 'data:text/csv;base64'
          : 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64'
      const link = document.createElement('a')
      link.href = `${mime},${res.file_base64}`
      link.download = res.filename
      link.click()
      setExportOpen(false)
    } finally {
      setExportLoading(false)
    }
  }

  // 批量选择处理
  function toggleSelectAll() {
    if (selectAll) {
      setSelectedIds(new Set())
      setSelectAll(false)
    } else {
      setSelectedIds(new Set(list.map((c) => c.id)))
      setSelectAll(true)
    }
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
      setSelectAll(false)
    } else {
      next.add(id)
      if (next.size === list.length) setSelectAll(true)
    }
    setSelectedIds(next)
  }

  async function doBatchAction(action: string) {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBatchLoading(true)
    try {
      if (action === 'tag_add') {
        if (batchTagIds.length === 0) { window.alert('请选择标签'); return }
        await batchOperateCustomers({ ids, action: 'tag_add', tag_ids: batchTagIds })
        setBatchTagOpen(false)
      } else if (action === 'tag_remove') {
        if (batchTagIds.length === 0) { window.alert('请选择标签'); return }
        await batchOperateCustomers({ ids, action: 'tag_remove', tag_ids: batchTagIds })
        setBatchTagOpen(false)
      } else if (action === 'assign_owner') {
        if (!batchAssignUserId) { window.alert('请选择负责人'); return }
        await batchOperateCustomers({ ids, action: 'assign_owner', target_owner_id: Number(batchAssignUserId) })
        setBatchAssignOpen(false)
      } else if (action === 'change_stage') {
        if (!batchStage) { window.alert('请选择阶段'); return }
        await batchOperateCustomers({ ids, action: 'change_stage', target_stage: batchStage })
        setBatchStageOpen(false)
      } else if (action === 'delete') {
        if (!window.confirm(`确定批量删除 ${ids.length} 个客户？此操作不可恢复。`)) return
        await batchOperateCustomers({ ids, action: 'delete' })
      }
      setSelectedIds(new Set())
      setSelectAll(false)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '批量操作失败')
    } finally {
      setBatchLoading(false)
    }
  }

  async function onConfirmTransfer() {
    if (!transferTarget || !transferUserId) return
    await postJson(`/customers/${transferTarget.id}/transfer`, { to_user_id: Number(transferUserId) })
    setTransferTarget(null)
    setTransferUserId('')
    await load()
  }

  async function onRollback() {
    if (!rollbackTarget) return
    try {
      setRollbackLoading(true)
      await postJson(`/customers/${rollbackTarget.id}/rollback-auto-deal`, {
        reason_text: rollbackReason,
      })
      setRollbackTarget(null)
      setRollbackReason('')
      await load()
    } finally {
      setRollbackLoading(false)
    }
  }

  const stageLabel = (s: string) => stageLabels[s] ?? stages.find((x) => x.value === s)?.label ?? s
  const scoreColor = (score?: number | null) =>
    (score ?? 0) >= 70 ? 'text-green-500' : (score ?? 0) >= 40 ? 'text-yellow-500' : 'text-red-400'
  const totalPages = Math.max(1, Math.ceil(total / 20))

  const loadFollowUps = useCallback(async (customerId: number) => {
    const rows = await getJson<Array<{ id: number; content: string; created_at: string; type?: string }>>(
      `/customers/${customerId}/follow-ups`,
    )
    setDetailFollowUps(rows)
  }, [])

  async function handleQuickFollowUp() {
    if (!selectedCustomer || !quickFollowUp.trim()) return
    await postJson(`/customers/${selectedCustomer.id}/follow-ups`, {
      type: 'other',
      content: quickFollowUp.trim(),
    })
    setQuickFollowUp('')
    await loadFollowUps(selectedCustomer.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 条 · 第 {page} 页
          </p>
        </div>
        <div className="hidden flex-wrap gap-2 md:flex">
          <Button variant="outline" asChild>
            <Link to="/app/customers/pipeline">销售看板</Link>
          </Button>
          {canImport ? (
            <Button variant="outline" type="button" onClick={() => setImportOpen(true)}>
              批量导入
            </Button>
          ) : null}
          <Button variant="outline" type="button" onClick={openExportDialog} disabled={!canExport || list.length === 0}>
            <Download className="mr-1 h-4 w-4" />导出
          </Button>
          <Button type="button" onClick={openCreate} disabled={!canEdit}>
            新建客户
          </Button>
        </div>
      </div>

      <div className="flex gap-2 md:hidden">
        <Input
          className="flex-1"
          placeholder="搜索客户..."
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
        />
        <Button variant="outline" size="icon" onClick={() => setFilterOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        {canImport ? (
          <Button size="icon" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="hidden flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-end md:flex">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs">搜索</Label>
          <Input
            placeholder="姓名、手机、微信、公司"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="w-full space-y-1 sm:w-40">
          <Label className="text-xs">阶段</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">全部</option>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1 sm:w-40">
          <Label className="text-xs">标签</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">全部</option>
            {tags.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {canManageUsers ? (
          <div className="w-full space-y-1 sm:w-40">
            <Label className="text-xs">负责人</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">全部</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.real_name || u.username}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {selectedIds.size > 0 ? (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-md border bg-blue-50/80 p-3 backdrop-blur">
          <CheckSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">已选 {selectedIds.size} 个客户</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBatchTagOpen(true)}
            disabled={batchLoading || !canEdit}
          >
            <Tags className="mr-1 h-3 w-3" />批量标签
          </Button>
          {canManageUsers ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBatchAssignOpen(true)}
              disabled={batchLoading || !canEdit}
            >
              <UserPlus className="mr-1 h-3 w-3" />转移负责人
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBatchStageOpen(true)}
            disabled={batchLoading || !canEdit}
          >
            <ArrowRight className="mr-1 h-3 w-3" />变更阶段
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void doBatchAction('delete')}
            disabled={batchLoading || !canDelete}
          >
            <Trash2 className="mr-1 h-3 w-3" />批量删除
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setSelectedIds(new Set()); setSelectAll(false) }}
          >
            <X className="mr-1 h-3 w-3" />取消
          </Button>
        </div>
      ) : null}

      {filterOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFilterOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">筛选条件</span>
              <button type="button" onClick={() => setFilterOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">阶段</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">全部</option>
                  {stages.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">标签</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={tagFilter}
                  onChange={(e) => {
                    setTagFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">全部</option>
                  {tags.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {canManageUsers ? (
                <div className="space-y-1">
                  <Label className="text-xs">负责人</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ownerFilter}
                    onChange={(e) => {
                      setOwnerFilter(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">全部</option>
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.real_name || u.username}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <Button className="mt-4 w-full" onClick={() => setFilterOpen(false)}>
                确认
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <button
                  type="button"
                  className="inline-flex items-center justify-center"
                  onClick={toggleSelectAll}
                >
                  {selectAll ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>手机</TableHead>
              <TableHead>微信</TableHead>
              <TableHead>公司</TableHead>
              <TableHead>阶段</TableHead>
              <TableHead>意向分</TableHead>
              <TableHead>意向度</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12}>加载中…</TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  暂无客户，可点击「新建客户」或导入。
                </TableCell>
              </TableRow>
            ) : (
              list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center"
                      onClick={() => toggleSelect(c.id)}
                    >
                      {selectedIds.has(c.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    <button
                      className="text-left hover:underline hover:text-primary transition-colors"
                      onClick={() => navigate(`/app/customers/${c.id}`)}
                    >
                      {c.name || c.phone || `#${c.id}`}
                    </button>
                  </TableCell>
                  <TableCell>{c.phone || '—'}</TableCell>
                  <TableCell>{c.wechat_id || '—'}</TableCell>
                  <TableCell>{c.company || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{stageLabel(c.stage)}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.last_scored_at ? (
                      <span className="whitespace-nowrap text-sm">
                        {intentScoreEmoji(c.intent_score ?? 0)} {c.intent_score ?? 0} 分
                        {c.intent_tier ? (
                          <span className="text-muted-foreground">（{c.intent_tier}）</span>
                        ) : null}
                        {c.priority === 'high' ? (
                          <span className="ml-1 text-xs" title="联动优先">
                            🔥
                          </span>
                        ) : null}
                        {typeof c.followup_count === 'number' && c.followup_count > 0 ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            联动{c.followup_count}/3
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{c.intention_level ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (
                        <span
                          key={t.id}
                          className="rounded px-2 py-0.5 text-xs text-white"
                          style={{ backgroundColor: t.color || '#64748b' }}
                        >
                          {t.name}
                        </span>
                      ))}
                      {(c.tags || []).length === 0 ? <span className="text-muted-foreground">—</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>{c.owner?.real_name || c.owner?.username || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(c.created_at)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <CallButton
                      customerId={c.id}
                      customerName={c.name || `客户#${c.id}`}
                      customerPhone={c.phone || null}
                      size="sm"
                    />
                    <SmsButton
                      customerId={c.id}
                      customerName={c.name || `客户#${c.id}`}
                      customerPhone={c.phone || null}
                      size="sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/app/follow-ups?customer_id=${c.id}`)}
                    >
                      跟进
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)} disabled={!canEdit}>
                      编辑
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTransferTarget(c)} disabled={!canEdit}>
                      转移
                    </Button>
                    {c.stage === 'deal' && !c.opt_out_auto_msg ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRollbackTarget(c)}
                        disabled={!canEdit}
                        className="text-amber-600 hover:text-amber-700"
                      >
                        回滚
                      </Button>
                    ) : null}
                    <Button size="sm" variant="destructive" onClick={() => void onDelete(c)} disabled={!canDelete}>
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
        {!loading && list.length === 0 ? <p className="text-sm text-muted-foreground">暂无客户</p> : null}
        {list.map((customer) => (
          <div
            key={customer.id}
            className="rounded-lg border bg-white p-3"
            onClick={() => navigate(`/app/customers/${customer.id}`)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{customer.name || '未命名客户'}</p>
                <p className="mt-0.5 text-xs text-gray-500">{customer.company || '—'}</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${scoreColor(customer.intent_score)}`}>{customer.intent_score ?? 0}</span>
                <p className="text-xs text-gray-400">意向分</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stageLabel(customer.stage)}
              </Badge>
              {customer.tags?.slice(0, 2).map((tag) => (
                <Badge key={tag.name} variant="secondary" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <SmsButton
                customerId={customer.id}
                customerName={customer.name || `客户#${customer.id}`}
                customerPhone={customer.phone || null}
                size="sm"
              />
              <CallButton
                customerId={customer.id}
                customerName={customer.name || `客户#${customer.id}`}
                customerPhone={customer.phone || null}
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden justify-end gap-2 md:flex">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          上一页
        </Button>
        <Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
          下一页
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between md:hidden">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          上一页
        </Button>
        <span className="text-sm text-gray-500">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          下一页
        </Button>
      </div>

      <div
        className={`fixed inset-0 z-50 bg-white transform transition-transform duration-300 md:hidden ${
          detailOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="sticky top-0 flex items-center gap-3 border-b bg-white p-4">
          <button type="button" onClick={() => setDetailOpen(false)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-medium">{selectedCustomer?.name || '客户详情'}</span>
        </div>
        <div className="h-[calc(100vh-56px)] overflow-y-auto pb-24">
          <div className="border-b p-4">
            <div className="flex justify-between">
              <div>
                <p className="text-xl font-semibold">{selectedCustomer?.name || '未命名客户'}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCustomer?.company || '—'} · {selectedCustomer?.owner?.real_name || selectedCustomer?.owner?.username || '—'}
                </p>
              </div>
              <div className={`text-3xl font-bold ${scoreColor(selectedCustomer?.intent_score)}`}>
                {selectedCustomer?.intent_score ?? 0}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedCustomer?.tags?.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="p-4">
            <h3 className="mb-3 font-medium">跟进记录</h3>
            {detailFollowUps.map((f) => (
              <div key={f.id} className="mb-3 border-l-2 border-blue-200 pl-3">
                <p className="text-sm">{f.content}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDateTime(f.created_at)}</p>
              </div>
            ))}
            {detailFollowUps.length === 0 ? <p className="text-sm text-muted-foreground">暂无跟进记录</p> : null}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex gap-2 border-t bg-white p-3">
          <SmsButton
            customerId={selectedCustomer?.id || 0}
            customerName={selectedCustomer?.name || '客户'}
            customerPhone={selectedCustomer?.phone || null}
            size="sm"
          />
          <CallButton
            customerId={selectedCustomer?.id || 0}
            customerName={selectedCustomer?.name || '客户'}
            customerPhone={selectedCustomer?.phone || null}
            size="sm"
          />
          <Input
            className="flex-1 text-sm"
            placeholder="记录跟进内容..."
            value={quickFollowUp}
            onChange={(e) => setQuickFollowUp(e.target.value)}
          />
          <Button size="sm" onClick={() => void handleQuickFollowUp()} disabled={!quickFollowUp.trim()}>
            记录
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑客户' : '新建客户'}</DialogTitle>
            <DialogDescription>保存后可同步更新标签关联。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>手机</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>微信</Label>
              <Input value={wechatId} onChange={(e) => setWechatId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>公司</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>阶段</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {stageFormChoices.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {canManageUsers ? (
              <div className="space-y-2">
                <Label>负责人</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formOwnerId}
                  onChange={(e) => setFormOwnerId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.real_name || u.username}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>意向度（1–5）</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={intentionLevel}
                onChange={(e) => setIntentionLevel(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>来源</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="如：转介绍、广告" />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-dashed p-2">
              <input
                id="optOutAutoMsg"
                type="checkbox"
                checked={optOutAutoMsg}
                onChange={(e) => setOptOutAutoMsg(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <Label htmlFor="optOutAutoMsg" className="cursor-pointer text-sm font-normal leading-snug">
                退订自动化直发消息（流程动作「send_message」将不再向该客户发送企微消息）
              </Label>
            </div>
            {editing ? (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <Label>意向评分（规则 70% + AI 30%）</Label>
                <p className="text-sm text-muted-foreground">
                  {editing.last_scored_at ? (
                    <>
                      <span className="font-medium text-foreground">
                        {intentScoreEmoji(editing.intent_score ?? 0)} {editing.intent_score ?? 0} 分
                      </span>
                      {editing.intent_tier ? ` · ${editing.intent_tier}` : ''}
                      {editing.intent_stage_label ? ` · 阶段：${editing.intent_stage_label}` : ''}
                      <br />
                      规则 {editing.intent_rule_score ?? '—'} / AI {editing.intent_ai_score ?? '—'} · 更新{' '}
                      {formatDateTime(editing.last_scored_at)}
                      <br />
                      联动策略：已触达 {editing.followup_count ?? 0}/3 次
                      {editing.priority ? ` · 优先 ${editing.priority}` : ''}
                      {editing.last_followup_at
                        ? ` · 上次联动 ${formatDateTime(editing.last_followup_at)}`
                        : ''}
                    </>
                  ) : (
                    '尚未计算过，点击下方按钮生成（未配置 AI 时仅使用规则分）。'
                  )}
                </p>
                {lastScoreHint ? <p className="text-xs text-amber-700 dark:text-amber-400">{lastScoreHint}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={scoreLoading}
                    onClick={() => void refreshIntentScore(false)}
                  >
                    {scoreLoading ? '计算中…' : '刷新意向分'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={scoreLoading}
                    onClick={() => void refreshIntentScore(true)}
                  >
                    强制重算
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>标签</Label>
              <div className="flex max-h-36 flex-col gap-2 overflow-y-auto rounded-md border p-2">
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">请先在「客户标签」页创建标签</p>
                ) : (
                  tags.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTagIds((prev) => [...prev, t.id])
                          } else {
                            setSelectedTagIds((prev) => prev.filter((id) => id !== t.id))
                          }
                        }}
                      />
                      <span>{t.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            {editing ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">企微会话记录（回调）</Label>
                {!editing.external_userid ? (
                  <p className="text-xs text-muted-foreground">
                    尚无外部联系人 ID（可先运行设置页的「立即同步客户」）。入库的消息按 external_userid 关联到客户。
                  </p>
                ) : null}
                {chatLoading ? (
                  <p className="text-xs text-muted-foreground">加载消息…</p>
                ) : chatMsgs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无回调消息。</p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                    {[...chatMsgs].reverse().map((m) => (
                      <div key={m.id} className="rounded bg-background/80 p-2">
                        <div className="flex justify-between gap-2 text-muted-foreground">
                          <span>{m.direction === 'staff' ? '员工 → 客户' : '客户 → 员工'}</span>
                          <span>{formatDateTime(m.msg_time)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words">{m.content || `[${m.msg_type}]`}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onSave()}>保存</Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={!!transferTarget}
        onOpenChange={(o) => {
          if (!o) {
            setTransferTarget(null)
            setTransferUserId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>转移客户：{transferTarget?.name || transferTarget?.phone || ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>转移给</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={transferUserId}
              onChange={(e) => setTransferUserId(e.target.value)}
            >
              <option value="">请选择员工</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.real_name || u.username}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void onConfirmTransfer()} disabled={!transferUserId}>
              确认转移
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rollbackTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRollbackTarget(null)
            setRollbackReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回滚自动成交</DialogTitle>
            <DialogDescription>
              客户：{rollbackTarget?.name || rollbackTarget?.phone || `#${rollbackTarget?.id}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                <span className="font-medium">成交 → 商务谈判</span>
              </p>
              <p className="mt-1 text-xs text-amber-700">此操作将该客户阶段从「成交」回滚至「商务谈判」</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rollback-reason">回滚原因（选填）</Label>
              <textarea
                id="rollback-reason"
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="例如：客户反悔、订单取消等"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRollbackTarget(null)
                setRollbackReason('')
              }}
            >
              取消
            </Button>
            <Button onClick={() => void onRollback()} disabled={rollbackLoading} variant="destructive">
              {rollbackLoading ? '回滚中…' : '确认回滚'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDrawer
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          void load()
        }}
      />

      {/* 导出对话框 */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出客户</DialogTitle>
            <DialogDescription>
              选择要导出的字段和格式。共 {total} 条客户满足当前筛选条件。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>导出格式</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={exportFormat === 'xlsx'} onChange={() => setExportFormat('xlsx')} />
                  Excel (.xlsx)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} />
                  CSV (.csv)
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>导出字段</Label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() =>
                    setExportFields(availableExportFields.length === exportFields.length ? [] : [...availableExportFields])
                  }
                >
                  {availableExportFields.length === exportFields.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  {availableExportFields.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={exportFields.includes(f)}
                        onChange={() =>
                          setExportFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
                        }
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>取消</Button>
            <Button onClick={() => void doExport()} disabled={exportLoading || exportFields.length === 0}>
              {exportLoading ? '导出中…' : '开始导出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量标签对话框 */}
      <Dialog open={batchTagOpen} onOpenChange={setBatchTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量标签操作</DialogTitle>
            <DialogDescription>为选中的 {selectedIds.size} 个客户添加或移除标签</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>选择标签</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${
                        batchTagIds.includes(t.id) ? 'text-white' : 'border bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      style={batchTagIds.includes(t.id) ? { backgroundColor: t.color || '#3b82f6' } : undefined}
                      onClick={() =>
                        setBatchTagIds((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                      }
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchTagOpen(false)}>取消</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void doBatchAction('tag_remove')} disabled={batchLoading || batchTagIds.length === 0}>
                移除标签
              </Button>
              <Button onClick={() => void doBatchAction('tag_add')} disabled={batchLoading || batchTagIds.length === 0}>
                添加标签
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量转移负责人对话框 */}
      <Dialog open={batchAssignOpen} onOpenChange={setBatchAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量转移负责人</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.size} 个客户转移给指定负责人</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>新负责人</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={batchAssignUserId}
                onChange={(e) => setBatchAssignUserId(e.target.value)}
              >
                <option value="">请选择</option>
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>{u.real_name || u.username}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAssignOpen(false)}>取消</Button>
            <Button onClick={() => void doBatchAction('assign_owner')} disabled={batchLoading || !batchAssignUserId}>
              确认转移
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量变更阶段对话框 */}
      <Dialog open={batchStageOpen} onOpenChange={setBatchStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量变更阶段</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.size} 个客户变更为指定阶段</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>目标阶段</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={batchStage}
                onChange={(e) => setBatchStage(e.target.value)}
              >
                <option value="">请选择</option>
                {stages.slice(0, 6).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchStageOpen(false)}>取消</Button>
            <Button onClick={() => void doBatchAction('change_stage')} disabled={batchLoading || !batchStage}>
              确认变更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
