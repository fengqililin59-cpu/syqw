/**
 * @file 仪表盘布局配置页
 *
 * 功能：
 *   - 仪表盘 Widget 显示/隐藏切换
 *   - 拖拽排序
 *   - 应用行业模板（教培/医美/B2B/房产/助贷）
 *   - 实时预览效果
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, Eye, EyeOff, GripVertical, LayoutTemplate, Save } from 'lucide-react';
import {
  getConfig,
  listTemplates,
  applyTemplate as applyTemplateApi,
  saveConfig,
} from '@/api/dashboardConfig';
import type { WidgetItem, WidgetTemplate } from '@/api/dashboardConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── 模板元数据 ──
const TEMPLATE_META: Record<string, { icon: string; color: string }> = {
  education:  { icon: '🎓', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  beauty:     { icon: '💎', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  b2b:        { icon: '🏢', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  realestate: { icon: '🏠', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  loan:       { icon: '💰', color: 'bg-green-100 text-green-800 border-green-200' },
};

// ── 组件 ──

export function DashboardLayoutSettingsPage() {
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [_hasCustom, setHasCustom] = useState(false);
  const [templates, setTemplates] = useState<Record<string, WidgetTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // 加载配置
  const load = useCallback(async () => {
    try {
      const [config, tmpl] = await Promise.all([getConfig(), listTemplates()]);
      setWidgets([...config.widgets].sort((a, b) => a.order - b.order));
      setHasCustom(config.hasCustom);
      setTemplates(tmpl);
    } catch {
      setStatus({ type: 'error', msg: '加载配置失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 切换可见性
  function toggleVisible(key: string) {
    setWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, visible: !w.visible } : w)),
    );
  }

  // 上移
  function moveUp(idx: number) {
    if (idx <= 0) return;
    setWidgets((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((w, i) => ({ ...w, order: i }));
    });
  }

  // 下移
  function moveDown(idx: number) {
    setWidgets((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((w, i) => ({ ...w, order: i }));
    });
  }

  // 保存
  async function handleSave() {
    setSaving(true);
    try {
      await saveConfig(widgets);
      setStatus({ type: 'success', msg: '布局已保存，刷新仪表盘即可生效' });
    } catch {
      setStatus({ type: 'error', msg: '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  // 应用模板
  async function handleApplyTemplate(key: string) {
    setSaving(true);
    try {
      const result = await applyTemplateApi(key);
      setWidgets(result.widgets.sort((a, b) => a.order - b.order));
      setStatus({ type: 'success', msg: `已应用「${templates[key]?.label ?? key}」模板` });
    } catch {
      setStatus({ type: 'error', msg: '应用模板失败' });
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = widgets.filter((w) => w.visible).length;

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground animate-pulse">
            加载中...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">仪表盘布局</h1>
          <p className="text-sm text-muted-foreground mt-1">
            拖拽排序 Widget，控制显示/隐藏。共 {widgets.length} 个模块，当前显示 {visibleCount} 个。
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? '保存中...' : '保存布局'}
        </Button>
      </div>

      {/* 状态提示 */}
      {status && (
        <div
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm font-medium',
            status.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200',
          )}
        >
          {status.msg}
        </div>
      )}

      {/* 行业模板 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" />
            行业模板
          </CardTitle>
          <CardDescription>一键应用行业预设布局。应用后仍可手动调整。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(templates).map(([key, t]) => {
              const meta = TEMPLATE_META[key] ?? { icon: '📋', color: 'bg-gray-100 text-gray-800 border-gray-200' };
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void handleApplyTemplate(key)}
                  disabled={saving}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50',
                    meta.color,
                  )}
                >
                  <span>{meta.icon}</span>
                  {t.label}
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                    {t.widgetCount}
                  </Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Widget 列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Widget 列表
          </CardTitle>
          <CardDescription>
            点击眼睛图标切换显示/隐藏，使用上下箭头调整顺序。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {widgets.map((w, idx) => (
            <div
              key={w.key}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                w.visible ? 'bg-card' : 'bg-muted/30 opacity-60',
              )}
            >
              {/* 拖拽手柄 */}
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

              {/* 标签 */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', !w.visible && 'text-muted-foreground')}>
                  {w.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">{w.key}</p>
              </div>

              {/* 可见性切换 */}
              <button
                type="button"
                onClick={() => toggleVisible(w.key)}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  w.visible
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-muted',
                )}
                title={w.visible ? '隐藏' : '显示'}
              >
                {w.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              {/* 排序按钮 */}
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  title="上移"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === widgets.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  title="下移"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 -rotate-90" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
