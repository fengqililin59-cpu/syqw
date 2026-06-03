/**
 * @file 销售管道配置页
 *
 * 功能：
 *   - 拖拽排序阶段
 *   - 添加/删除/编辑阶段
 *   - 设置阶段颜色（预设色板）
 *   - 设置阶段分类（open/won/lost）
 *   - 应用行业管道模板
 *   - 重置为默认管道
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  getConfig,
  listTemplates,
  applyTemplate as applyTemplateApi,
  resetConfig,
  saveConfig,
} from '@/api/pipeline';
import type { PipelineStage, PipelineTemplate } from '@/api/pipeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── 预设色板 ──
const COLOR_PALETTE = [
  '#94a3b8', '#64748b', // 灰
  '#60a5fa', '#3b82f6', '#2563eb', // 蓝
  '#a78bfa', '#8b5cf6', '#7c3aed', // 紫
  '#f59e0b', '#d97706', // 琥珀
  '#10b981', '#059669', '#047857', // 绿
  '#06b6d4', '#0891b2', // 青
  '#ec4899', '#db2777', // 粉
  '#ef4444', '#dc2626', // 红
  '#f97316', '#ea580c', // 橙
];

const CATEGORY_LABELS: Record<string, string> = {
  open: '进行中',
  won: '成交',
  lost: '流失',
};

const CATEGORY_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

// 生成唯一 key
function genKey(label: string): string {
  return label
    .replace(/[^\w\u4e00-\u9fff]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    || `stage_${Date.now()}`;
}

// ── 组件 ──

export function PipelineSettingsPage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [hasCustom, setHasCustom] = useState(false);
  const [templates, setTemplates] = useState<Record<string, PipelineTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // 加载配置
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, temps] = await Promise.all([getConfig(), listTemplates()]);
      setStages(config.stages);
      setHasCustom(config.hasCustom);
      setTemplates(temps);
    } catch (e: any) {
      setStatus({ type: 'error', msg: e?.message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 阶段操作
  function updateStage(idx: number, patch: Partial<PipelineStage>) {
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      { key: genKey('新阶段'), label: '新阶段', color: '#94a3b8', category: 'open', order: prev.length },
    ]);
  }

  function removeStage(idx: number) {
    if (stages.length <= 2) return;
    setStages((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveStage(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= stages.length) return;
    setStages((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // 保存
  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      // 生成 key + 保存
      const toSave = stages.map((s, i) => ({
        ...s,
        key: s.key || genKey(s.label),
        order: i,
      }));
      await saveConfig(toSave);
      setStatus({ type: 'success', msg: '保存成功' });
      setHasCustom(true);
    } catch (e: any) {
      setStatus({ type: 'error', msg: e?.response?.data?.error || e?.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  // 重置
  async function handleReset() {
    if (!window.confirm('确认重置为默认管道？当前配置将丢失。')) return;
    try {
      const result = await resetConfig();
      setStages(result.stages);
      setHasCustom(false);
      setStatus({ type: 'success', msg: '已重置为默认管道' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e?.message || '重置失败' });
    }
  }

  // 应用模板
  async function handleApplyTemplate(key: string) {
    if (!window.confirm(`确认应用「${templates[key]?.label}」管道模板？当前配置将丢失。`)) return;
    try {
      const result = await applyTemplateApi(key);
      setStages(result.stages);
      setHasCustom(true);
      setStatus({ type: 'success', msg: `已应用「${templates[key]?.label}」模板` });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e?.message || '应用失败' });
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">销售管道配置</h1>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">销售管道配置</h1>
          <p className="text-sm text-muted-foreground">
            自定义租户的销售阶段流程。拖拽调整顺序，修改名称和颜色。
            {hasCustom ? ' · 已自定义' : ' · 使用默认管道'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            重置默认
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? '保存中…' : '保存配置'}
          </Button>
        </div>
      </div>

      {/* 状态提示 */}
      {status ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {status.msg}
        </div>
      ) : null}

      {/* 行业模板 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">行业管道模板</CardTitle>
          <CardDescription>选择匹配行业的预置流程，快速开始</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(templates).map(([key, tmpl]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => handleApplyTemplate(key)}
              >
                {tmpl.label} ({tmpl.stageCount}阶段)
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 阶段列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">管道阶段</CardTitle>
              <CardDescription>至少保留2个阶段。拖拽调整顺序（左侧按钮）。</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addStage}>
              <Plus className="mr-1 h-4 w-4" /> 添加阶段
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.map((stage, idx) => (
            <div
              key={`${stage.key}-${idx}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              {/* 排序 */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => moveStage(idx, -1)}
                >
                  <ArrowUpDown className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  disabled={idx === stages.length - 1}
                  onClick={() => moveStage(idx, 1)}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>

              {/* 序号 */}
              <span className="w-6 text-center text-xs text-muted-foreground">{idx + 1}</span>

              {/* 颜色 */}
              <div className="flex flex-wrap gap-1" style={{ maxWidth: 120 }}>
                {COLOR_PALETTE.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-5 w-5 rounded-full border-2 transition ${
                      stage.color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => updateStage(idx, { color: c })}
                    title={c}
                  />
                ))}
              </div>

              {/* 阶段名称 */}
              <Input
                className="h-9 w-28"
                value={stage.label}
                onChange={(e) => {
                  const label = e.target.value;
                  updateStage(idx, { label, key: genKey(label) });
                }}
                placeholder="阶段名称"
              />

              {/* key */}
              <Input
                className="h-9 w-36 font-mono text-xs"
                value={stage.key}
                onChange={(e) => updateStage(idx, { key: e.target.value })}
                placeholder="stage_key"
              />

              {/* 分类 */}
              <Select
                value={stage.category}
                onValueChange={(v) => updateStage(idx, { category: v as PipelineStage['category'] })}
              >
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">进行中</SelectItem>
                  <SelectItem value="won">成交</SelectItem>
                  <SelectItem value="lost">流失</SelectItem>
                </SelectContent>
              </Select>

              {/* 分类标签 */}
              <Badge className={CATEGORY_COLORS[stage.category] || ''}>
                {CATEGORY_LABELS[stage.category] || stage.category}
              </Badge>

              {/* 预览色块 */}
              <div
                className="h-6 w-6 shrink-0 rounded"
                style={{ backgroundColor: stage.color }}
              />

              {/* 删除 */}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8 text-muted-foreground hover:text-red-600"
                disabled={stages.length <= 2}
                onClick={() => removeStage(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {stages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无阶段，请添加或应用模板
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 预览 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">看板预览</CardTitle>
          <CardDescription>管道阶段在销售看板中的展示效果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {stages.map((stage, idx) => (
              <div
                key={`${stage.key}-${idx}`}
                className="min-w-[140px] rounded-lg border-2 p-3"
                style={{
                  borderColor: stage.color,
                  backgroundColor: stage.color + '18',
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <Badge className={CATEGORY_COLORS[stage.category] || ''}>
                    {CATEGORY_LABELS[stage.category] || stage.category}
                  </Badge>
                </div>
                <div
                  className="mt-2 h-1.5 w-full rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  key: {stage.key}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
