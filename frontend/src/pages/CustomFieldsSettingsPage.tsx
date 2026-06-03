/**
 * @file 自定义字段配置页（租户设置 / 全行业 SaaS 核心能力）
 *
 * 功能：
 *   - 查看/新增/编辑/删除自定义字段定义
 *   - 一键应用行业模板（教培/医美/B2B/助贷）
 *   - 拖拽排序（预留）
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  listDefs, createDef, updateDef, deleteDef,
  listTemplates, applyTemplate,
  type CustomFieldDef, type IndustryTemplate,
} from '@/api/customFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Pencil, Download, Loader2 } from 'lucide-react';

// ── 字段类型选项 ──
const FIELD_TYPES = [
  { value: 'text', label: '单行文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '单选下拉' },
  { value: 'multi_select', label: '多选下拉' },
  { value: 'checkbox', label: '复选框' },
  { value: 'textarea', label: '多行文本' },
] as const;

const GROUP_LABELS: Record<string, string> = {
  edu: '教培行业',
  beauty: '医美行业',
  b2b: 'B2B 企服',
  loan: '助贷行业',
};

// ── 空字段表单 ──
function emptyForm(): Partial<CustomFieldDef> {
  return {
    field_key: '',
    field_label: '',
    field_type: 'text',
    group_name: '',
    is_required: false,
    display_order: 0,
    placeholder: '',
    help_text: '',
    options: [],
  };
}

export function CustomFieldsSettingsPage() {
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, IndustryTemplate>>({});
  const [loading, setLoading] = useState(true);

  // 新增/编辑弹窗
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // 选项编辑（select / multi_select）
  const [optionsText, setOptionsText] = useState('');

  // 删除确认
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── 数据加载 ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([listDefs(false), listTemplates()]);
      setDefs(d);
      setTemplates(t);
    } catch (e: any) {
      toast.error('加载字段定义失败: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 打开新增弹窗 ──
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOptionsText('');
    setFormOpen(true);
  };

  // ── 打开编辑弹窗 ──
  const openEdit = (d: CustomFieldDef) => {
    setEditingId(d.id);
    setForm({ ...d });
    setOptionsText(
      (d.options ?? []).map((o: any) => `${o.label}:${o.value}`).join('\n'),
    );
    setFormOpen(true);
  };

  // ── 表单变更 ──
  const updateForm = (kv: Partial<typeof form>) => setForm((f) => ({ ...f, ...kv }));

  // ── 保存 ──
  const handleSave = async () => {
    if (!form.field_key?.trim() || !form.field_label?.trim()) {
      toast.error('字段键和字段名不能为空');
      return;
    }

    // 解析选项
    let options: { label: string; value: string }[] | undefined;
    if (form.field_type === 'select' || form.field_type === 'multi_select') {
      options = optionsText
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [label, value] = line.split(':').map((s) => s.trim());
          return { label: label || value, value: value || label };
        });
    }

    setSaving(true);
    try {
      const data = { ...form, options: options || null };
      if (editingId !== null) {
        await updateDef(editingId, data);
        toast.success('字段已更新');
      } else {
        await createDef(data);
        toast.success('字段已创建');
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      toast.error('保存失败: ' + (e?.response?.data?.message ?? e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  // ── 删除 ──
  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteDef(deleteId);
      toast.success('字段已删除');
      setDeleteId(null);
      await load();
    } catch (e: any) {
      toast.error('删除失败: ' + (e?.message ?? e));
    }
  };

  // ── 应用模板 ──
  const [applying, setApplying] = useState<string | null>(null);
  const handleApplyTemplate = async (key: string) => {
    setApplying(key);
    try {
      const r = await applyTemplate(key);
      toast.success(`已应用 ${GROUP_LABELS[key]}: ${r.added}/${r.total} 个字段`);
      await load();
    } catch (e: any) {
      toast.error('应用失败: ' + (e?.message ?? e));
    } finally {
      setApplying(null);
    }
  };

  // ── 按分组聚合 ──
  const grouped = defs.reduce<Record<string, CustomFieldDef[]>>((acc, d) => {
    const g = d.group_name || '未分组';
    (acc[g] ??= []).push(d);
    return acc;
  }, {});

  // ── 渲染 ──
  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">自定义客户字段</h2>
          <p className="text-sm text-muted-foreground mt-1">
            定义你的客户资料字段（不同行业可配置不同字段），教培配「年级」、医美配「肤质」、B2B配「公司规模」
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> 新增字段
        </Button>
      </div>

      {/* 行业模板 */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Download className="h-4 w-4" /> 一键应用行业模板
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(templates).map(([key, tpl]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              disabled={applying !== null}
              onClick={() => handleApplyTemplate(key)}
            >
              {applying === key && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {GROUP_LABELS[key] ?? tpl.label} ({tpl.fieldCount}个字段)
            </Button>
          ))}
        </div>
      </Card>

      {/* 字段列表 */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-3">还没有自定义字段</p>
          <p className="text-sm mb-4">点击「一键应用模板」快速开始，或「新增字段」手动创建</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([groupName, fields]) => (
          <Card key={groupName} className="p-4">
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground">
              {groupName}
            </h3>
            <div className="space-y-2">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between py-2 px-3 border rounded-lg hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant="outline" className="shrink-0">
                      {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.field_label}</p>
                      <p className="text-xs text-muted-foreground">键: {f.field_key}</p>
                    </div>
                    {f.is_required && (
                      <Badge variant="destructive" className="shrink-0 text-xs">必填</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(f.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {/* 新增/编辑弹窗 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑字段' : '新增字段'}</DialogTitle>
            <DialogDescription>
              字段键创建后不可修改，建议使用英文小写+下划线（如 "grade"、"skin_type"）
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 字段键 */}
            <div>
              <Label>字段键 *</Label>
              <Input
                value={form.field_key || ''}
                onChange={(e) => updateForm({ field_key: e.target.value })}
                placeholder="如 grade、skin_type"
                disabled={editingId !== null}
              />
            </div>

            {/* 字段名 */}
            <div>
              <Label>显示名称 *</Label>
              <Input
                value={form.field_label || ''}
                onChange={(e) => updateForm({ field_label: e.target.value })}
                placeholder="如 年级、肤质"
              />
            </div>

            {/* 字段类型 */}
            <div>
              <Label>字段类型</Label>
              <Select
                value={form.field_type ?? 'text'}
                onValueChange={(v) => updateForm({ field_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 分组 */}
            <div>
              <Label>分组名</Label>
              <Input
                value={form.group_name || ''}
                onChange={(e) => updateForm({ group_name: e.target.value })}
                placeholder="如 学员信息、企业信息"
              />
            </div>

            {/* 选项（select / multi_select） */}
            {(form.field_type === 'select' || form.field_type === 'multi_select') && (
              <div>
                <Label>选项列表</Label>
                <Textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={`每行一个选项，格式：显示名:值\n例：\n初中:junior\n高中:senior`}
                  rows={5}
                />
              </div>
            )}

            {/* placeholder */}
            <div>
              <Label>占位提示</Label>
              <Input
                value={form.placeholder || ''}
                onChange={(e) => updateForm({ placeholder: e.target.value })}
                placeholder="输入框内的提示文字"
              />
            </div>

            {/* help text */}
            <div>
              <Label>帮助说明</Label>
              <Input
                value={form.help_text || ''}
                onChange={(e) => updateForm({ help_text: e.target.value })}
                placeholder="字段下方的小字说明"
              />
            </div>

            {/* 排序 */}
            <div>
              <Label>排序权重</Label>
              <Input
                type="number"
                value={form.display_order ?? 0}
                onChange={(e) => updateForm({ display_order: Number(e.target.value) })}
              />
            </div>

            {/* 必填 */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_required ?? false}
                onCheckedChange={(v) => updateForm({ is_required: v })}
              />
              <Label className="cursor-pointer">必填字段</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除字段后，所有客户的该字段值将一并删除。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
