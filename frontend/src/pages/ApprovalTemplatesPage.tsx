/**
 * @file 审批模板管理页 — 创建/编辑/删除审批流程模板。
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X, GripVertical, Loader2 } from 'lucide-react'
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '@/api/approvals'
import type { ApprovalTemplate } from '@/api/approvals'

interface StepDraft {
  key: string // 临时 key
  approver_id: string
  approver_role: string
  step_name: string
}

let _stepId = 0
function nextStepKey() {
  return `step_${++_stepId}`
}

export default function ApprovalTemplatesPage() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 编辑/新建弹窗
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState<ApprovalTemplate | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSteps, setFormSteps] = useState<StepDraft[]>([])
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetchTemplates({ limit: 100 })
      setTemplates(res.items)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setFormName('')
    setFormDesc('')
    setFormSteps([{ key: nextStepKey(), approver_id: '', approver_role: '', step_name: '部门经理审批' }])
    setFormActive(true)
    setFormError('')
    setShowEditor(true)
  }

  function openEdit(tpl: ApprovalTemplate) {
    setEditing(tpl)
    setFormName(tpl.name)
    setFormDesc(tpl.description || '')
    setFormSteps(
      (tpl.steps || []).map((s) => ({
        key: nextStepKey(),
        approver_id: s.approver_id ? String(s.approver_id) : '',
        approver_role: s.approver_role || '',
        step_name: s.step_name,
      })),
    )
    setFormActive(tpl.is_active === 1)
    setFormError('')
    setShowEditor(true)
  }

  function addStep() {
    setFormSteps((prev) => [
      ...prev,
      { key: nextStepKey(), approver_id: '', approver_role: '', step_name: '' },
    ])
  }

  function removeStep(key: string) {
    if (formSteps.length <= 1) return
    setFormSteps((prev) => prev.filter((s) => s.key !== key))
  }

  function updateStep(key: string, field: keyof StepDraft, value: string) {
    setFormSteps((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)))
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError('请输入模板名称')
      return
    }
    const validSteps = formSteps.filter((s) => s.step_name.trim())
    if (validSteps.length === 0) {
      setFormError('至少需要一个审批步骤')
      return
    }
    const steps = validSteps.map((s, idx) => ({
      order: idx,
      approver_id: s.approver_id ? Number(s.approver_id) : undefined,
      approver_role: s.approver_role || undefined,
      step_name: s.step_name.trim(),
    }))

    try {
      setSaving(true)
      setFormError('')
      if (editing) {
        await updateTemplate(editing.id, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          steps,
          is_active: formActive,
        })
      } else {
        await createTemplate({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          steps,
          is_active: formActive,
        })
      }
      setShowEditor(false)
      await load()
    } catch (e: any) {
      setFormError(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tpl: ApprovalTemplate) {
    if (!confirm(`确定删除模板「${tpl.name}」？`)) return
    try {
      await deleteTemplate(tpl.id)
      await load()
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  const statusLabel = (tpl: ApprovalTemplate) =>
    tpl.is_active === 1 ? (
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">启用</span>
    ) : (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">停用</span>
    )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#3d6a9a]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0f1e2e]">审批模板</h1>
          <p className="mt-1 text-sm text-[#6b7d91]">管理审批流程模板，定义审批步骤和审批人</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4a7a] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#163d66]"
        >
          <Plus className="h-4 w-4" />
          新建模板
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c5d9ef] py-16 text-center">
          <p className="text-sm text-[#9ab0c8]">暂无审批模板，点击"新建模板"创建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-[#e0e7f0] bg-white p-5 shadow-sm transition hover:border-[#c5d9ef]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-[#0f1e2e]">{tpl.name}</h3>
                    {statusLabel(tpl)}
                  </div>
                  {tpl.description && (
                    <p className="mt-1 text-sm text-[#6b7d91]">{tpl.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(tpl.steps || []).map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full border border-[#c5d9ef] bg-[#f5f8fd] px-3 py-1 text-xs text-[#3d6a9a]"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e4a7a] text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        {s.step_name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-4 flex gap-1">
                  <button
                    onClick={() => openEdit(tpl)}
                    className="rounded-lg p-2 text-[#9ab0c8] hover:bg-[#f0f4fa] hover:text-[#3d6a9a]"
                    title="编辑"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="rounded-lg p-2 text-[#9ab0c8] hover:bg-red-50 hover:text-red-500"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0f1e2e]">
                {editing ? '编辑模板' : '新建模板'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-lg p-1 text-[#9ab0c8] hover:bg-[#f0f4fa]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">模板名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如：销售折扣审批"
                  className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none focus:ring-1 focus:ring-[#3d6a9a]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#3d6a9a]">描述（可选）</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="如：适用于5000元以上的折扣申请"
                  className="w-full rounded-lg border border-[#c5d9ef] px-3 py-2 text-sm focus:border-[#3d6a9a] focus:outline-none focus:ring-1 focus:ring-[#3d6a9a]"
                />
              </div>

              {/* 步骤 */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-[#3d6a9a]">审批步骤</label>
                  <button
                    onClick={addStep}
                    className="text-xs font-medium text-[#3d6a9a] hover:text-[#1e4a7a]"
                  >
                    + 添加步骤
                  </button>
                </div>
                <div className="space-y-3">
                  {formSteps.map((step, idx) => (
                    <div
                      key={step.key}
                      className="flex items-start gap-2 rounded-lg border border-[#e0e7f0] bg-[#fafcfd] p-3"
                    >
                      <GripVertical className="mt-2 h-4 w-4 flex-shrink-0 text-[#c5d9ef]" />
                      <span className="mt-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#1e4a7a] text-[10px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={step.step_name}
                          onChange={(e) => updateStep(step.key, 'step_name', e.target.value)}
                          placeholder="步骤名称，如：部门经理审批"
                          className="w-full rounded border border-[#c5d9ef] px-2 py-1.5 text-sm focus:border-[#3d6a9a] focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={step.approver_id}
                            onChange={(e) => updateStep(step.key, 'approver_id', e.target.value)}
                            placeholder="审批人ID（可选）"
                            className="flex-1 rounded border border-[#c5d9ef] px-2 py-1.5 text-xs focus:border-[#3d6a9a] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={step.approver_role}
                            onChange={(e) => updateStep(step.key, 'approver_role', e.target.value)}
                            placeholder="角色（可选）"
                            className="flex-1 rounded border border-[#c5d9ef] px-2 py-1.5 text-xs focus:border-[#3d6a9a] focus:outline-none"
                          />
                        </div>
                      </div>
                      {formSteps.length > 1 && (
                        <button
                          onClick={() => removeStep(step.key)}
                          className="mt-1 rounded p-1 text-[#9ab0c8] hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 启用/停用 */}
              <label className="flex items-center gap-2 text-sm text-[#3d6a9a]">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#c5d9ef] text-[#1e4a7a]"
                />
                启用模板
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-lg border border-[#c5d9ef] px-4 py-2 text-sm text-[#6b7d91] hover:bg-[#f0f4fa]"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4a7a] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#163d66] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
