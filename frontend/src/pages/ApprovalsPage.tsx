/**
 * @file 审批中心 — 我的申请 / 待我审批 / 已处理。
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, X, Ban, FileText, Clock, User, Loader2, SearchX, RefreshCw } from 'lucide-react'
import {
  fetchMyApplications,
  fetchPendingApprovals,
  fetchProcessedApprovals,
  approveInstance,
  rejectInstance,
  cancelInstance,
  submitApproval,
  fetchTemplates,
} from '@/api/approvals'
import type { ApprovalInstance, ApprovalTemplate } from '@/api/approvals'

type TabKey = 'my' | 'pending' | 'processed'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'my', label: '我的申请' },
  { key: 'pending', label: '待我审批' },
  { key: 'processed', label: '已处理' },
]

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '审批中', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '已通过', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '已撤销', cls: 'bg-gray-100 text-gray-500' },
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('my')
  const [items, setItems] = useState<ApprovalInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actingId, setActingId] = useState<number | null>(null) // 正在操作的审批ID

  // 提交审批弹窗
  const [showSubmit, setShowSubmit] = useState(false)
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [submitTemplateId, setSubmitTemplateId] = useState<number | string>('')
  const [submitTitle, setSubmitTitle] = useState('')
  const [submitRelatedType, setSubmitRelatedType] = useState('')
  const [submitRelatedId, setSubmitRelatedId] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 审批评论弹窗
  const [showApproveDialog, setShowApproveDialog] = useState<{
    instance: ApprovalInstance
    action: 'approve' | 'reject'
  } | null>(null)
  const [actionComment, setActionComment] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      let res
      if (activeTab === 'my') {
        res = await fetchMyApplications({ page, limit: 20 })
      } else if (activeTab === 'pending') {
        res = await fetchPendingApprovals({ page, limit: 20 })
      } else {
        res = await fetchProcessedApprovals({ page, limit: 20 })
      }
      setItems(res.items)
      setTotalPages(res.totalPages)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [activeTab, page])

  useEffect(() => {
    load()
  }, [load])

  function switchTab(tab: TabKey) {
    setActiveTab(tab)
    setPage(1)
  }

  // 打开提交弹窗时加载模板列表
  async function openSubmit() {
    try {
      const res = await fetchTemplates({ limit: 100, is_active: 'true' })
      setTemplates(res.items)
      setSubmitTemplateId('')
      setSubmitTitle('')
      setSubmitRelatedType('')
      setSubmitRelatedId('')
      setSubmitError('')
      setShowSubmit(true)
    } catch (e: any) {
      alert('加载模板失败: ' + (e.message || ''))
    }
  }

  async function handleSubmit() {
    if (!submitTemplateId || !submitTitle.trim()) {
      setSubmitError('请选择模板并填写标题')
      return
    }
    try {
      setSubmitting(true)
      setSubmitError('')
      await submitApproval({
        template_id: Number(submitTemplateId),
        title: submitTitle.trim(),
        related_type: submitRelatedType || undefined,
        related_id: submitRelatedId || undefined,
      })
      setShowSubmit(false)
      switchTab('my')
    } catch (e: any) {
      setSubmitError(e.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(instance: ApprovalInstance) {
    try {
      setActingId(instance.id)
      await approveInstance(instance.id, actionComment)
      setShowApproveDialog(null)
      setActionComment('')
      await load()
    } catch (e: any) {
      alert(e.message || '操作失败')
    } finally {
      setActingId(null)
    }
  }

  async function handleReject(instance: ApprovalInstance) {
    try {
      setActingId(instance.id)
      await rejectInstance(instance.id, actionComment)
      setShowApproveDialog(null)
      setActionComment('')
      await load()
    } catch (e: any) {
      alert(e.message || '操作失败')
    } finally {
      setActingId(null)
    }
  }

  async function handleCancel(instance: ApprovalInstance) {
    if (!confirm('确定撤销此审批申请？')) return
    try {
      setActingId(instance.id)
      await cancelInstance(instance.id)
      await load()
    } catch (e: any) {
      alert(e.message || '撤销失败')
    } finally {
      setActingId(null)
    }
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const stepBadge = (status: string, _idx: number) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-600 border-amber-200',
      waiting: 'bg-gray-50 text-gray-400 border-gray-200',
      approved: 'bg-green-100 text-green-600 border-green-200',
      rejected: 'bg-red-100 text-red-500 border-red-200',
    }
    return `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] || map.waiting}`
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0f1e2e]">审批中心</h1>
          <p className="mt-1 text-sm text-[#6b7d91]">管理审批申请与审批流程</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm text-[#6b7d91] hover:bg-[#f0f4fa]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            onClick={openSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4a7a] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#163d66]"
          >
            <FileText className="h-4 w-4" />
            提交申请
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 rounded-xl bg-[#f0f4fa] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === t.key
                ? 'bg-white text-[#0f1e2e] shadow-sm'
                : 'text-[#6b7d91] hover:text-[#3d6a9a]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#3d6a9a]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c5d9ef] py-16 text-center">
          <SearchX className="mx-auto mb-3 h-10 w-10 text-[#c5d9ef]" />
          <p className="text-sm text-[#9ab0c8]">
            {activeTab === 'my' && '暂无申请记录'}
            {activeTab === 'pending' && '暂无待审批事项'}
            {activeTab === 'processed' && '暂无已处理记录'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[#e0e7f0] bg-white p-5 shadow-sm transition hover:border-[#c5d9ef]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[#0f1e2e]">{item.title}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LABEL[item.status]?.cls || ''}`}
                    >
                      {STATUS_LABEL[item.status]?.label || item.status}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-xs text-[#9ab0c8]">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      申请人 #{item.applicant_user_id}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(item.submitted_at)}
                    </span>
                    {item.related_type && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {item.related_type}#{item.related_id}
                      </span>
                    )}
                  </div>

                  {/* 步骤进度 */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(item.steps_snapshot || []).map((step) => (
                      <span key={step.order} className={stepBadge(step.status, step.order)}>
                        {item.current_step === step.order && item.status === 'pending' && (
                          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-white">
                            ▶
                          </span>
                        )}
                        {step.step_name}
                        {step.comment && (
                          <span className="text-[9px] text-gray-400" title={step.comment}>
                            ({step.comment.length > 8 ? step.comment.slice(0, 8) + '...' : step.comment})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="ml-4 flex gap-1">
                  {activeTab === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setShowApproveDialog({ instance: item, action: 'approve' })
                          setActionComment('')
                        }}
                        disabled={actingId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-600 disabled:opacity-50"
                      >
                        {actingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        通过
                      </button>
                      <button
                        onClick={() => {
                          setShowApproveDialog({ instance: item, action: 'reject' })
                          setActionComment('')
                        }}
                        disabled={actingId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                        驳回
                      </button>
                    </>
                  )}
                  {activeTab === 'my' && item.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(item)}
                      disabled={actingId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" />
                      撤销
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-[#c5d9ef] px-3 py-1.5 text-sm text-[#6b7d91] hover:bg-[#f0f4fa] disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-[#6b7d91]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-[#c5d9ef] px-3 py-1.5 text-sm text-[#6b7d91] hover:bg-[#f0f4fa] disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}

      {/* 提交审批弹窗 */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0f1e2e]">提交审批</h2>
              <button
                onClick={() => setShowSubmit(false)}
                className="rounded-lg p-1 text-[#9ab0c8] hover:bg-[#f0f4fa]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">审批模板</label>
                {templates.length === 0 ? (
                  <p className="text-sm text-[#9ab0c8]">暂无可用的审批模板</p>
                ) : (
                  <select
                    value={submitTemplateId}
                    onChange={(e) => {
                      setSubmitTemplateId(e.target.value)
                      if (!submitTitle) {
                        const tpl = templates.find((t) => t.id === Number(e.target.value))
                        if (tpl) setSubmitTitle(tpl.name)
                      }
                    }}
                    className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none"
                  >
                    <option value="">-- 选择模板 --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">审批标题</label>
                <input
                  type="text"
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  placeholder="如：客户李四折扣审批-8000元"
                  className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">
                    关联类型 <span className="text-[#9ab0c8]">(可选)</span>
                  </label>
                  <select
                    value={submitRelatedType}
                    onChange={(e) => setSubmitRelatedType(e.target.value)}
                    className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none"
                  >
                    <option value="">无</option>
                    <option value="customer">客户</option>
                    <option value="deal">交易</option>
                    <option value="order">订单</option>
                    <option value="refund">退款</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">
                    关联ID <span className="text-[#9ab0c8]">(可选)</span>
                  </label>
                  <input
                    type="text"
                    value={submitRelatedId}
                    onChange={(e) => setSubmitRelatedId(e.target.value)}
                    placeholder="业务记录ID"
                    className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSubmit(false)}
                className="rounded-lg border border-[#c5d9ef] px-4 py-2 text-sm text-[#6b7d91] hover:bg-[#f0f4fa]"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4a7a] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#163d66] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {submitting ? '提交中...' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 审批评论弹窗 */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0f1e2e]">
                {showApproveDialog.action === 'approve' ? '通过审批' : '驳回审批'}
              </h2>
              <button
                onClick={() => setShowApproveDialog(null)}
                className="rounded-lg p-1 text-[#9ab0c8] hover:bg-[#f0f4fa]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-sm text-[#6b7d91]">
              {showApproveDialog.action === 'approve' ? '确认通过此审批？' : '确认驳回此审批？'}
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">
                审批意见 <span className="text-[#9ab0c8]">(可选)</span>
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                rows={3}
                placeholder="输入审批意见..."
                className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowApproveDialog(null)}
                className="rounded-lg border border-[#c5d9ef] px-4 py-2 text-sm text-[#6b7d91] hover:bg-[#f0f4fa]"
              >
                取消
              </button>
              {showApproveDialog.action === 'approve' ? (
                <button
                  onClick={() => handleApprove(showApproveDialog.instance)}
                  disabled={actingId !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600 disabled:opacity-50"
                >
                  {actingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  确认通过
                </button>
              ) : (
                <button
                  onClick={() => handleReject(showApproveDialog.instance)}
                  disabled={actingId !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 disabled:opacity-50"
                >
                  {actingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  确认驳回
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
