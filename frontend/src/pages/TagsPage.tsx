/**
 * @file 客户标签管理：列表与增删改。
 */
import { useCallback, useEffect, useState } from 'react'
import { createTag, deleteTag, fetchTags, updateTag } from '@/api/tags'
import type { TagRow } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** 标签常用色（与仪表盘图表色系接近，便于区分） */
const TAG_COLOR_PRESETS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#22c55e',
  '#06b6d4',
  '#ef4444',
  '#64748b',
  '#a855f7',
  '#14b8a6',
  '#eab308',
  '#f97316',
] as const

function normalizeHexForNativePicker(input: string): string {
  const s = input.trim()
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toLowerCase()
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1],
      g = s[2],
      b = s[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#94a3b8'
}

export function TagsPage() {
  const [list, setList] = useState<TagRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TagRow | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [category, setCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchTags()
      setList(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setColor('')
    setCategory('')
    setOpen(true)
  }

  function openEdit(row: TagRow) {
    setEditing(row)
    setName(row.name)
    setColor(row.color || '')
    setCategory(row.category || '')
    setOpen(true)
  }

  async function onSave() {
    if (!name.trim()) return
    if (editing) {
      await updateTag(editing.id, {
        name: name.trim(),
        color: color || null,
        category: category || null,
      })
    } else {
      await createTag({ name: name.trim(), color: color || null, category: category || null })
    }
    setOpen(false)
    await load()
  }

  async function onDelete(row: TagRow) {
    if (!window.confirm(`确定删除标签「${row.name}」？`)) return
    await deleteTag(row.id)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-bold tracking-tight">客户标签</h1>
            {import.meta.env.DEV ? (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                取色器 UI
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">用于筛选客户与导出归类</p>
        </div>
        <Button onClick={openCreate}>新建标签</Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>颜色</TableHead>
              <TableHead>分类</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>加载中…</TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  暂无标签
                </TableCell>
              </TableRow>
            ) : (
              list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    {t.color ? (
                      <span
                        className="inline-block h-5 w-12 rounded border"
                        style={{ backgroundColor: t.color }}
                        title={t.color}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{t.category || '—'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void onDelete(t)}>
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑标签' : '新建标签'}</DialogTitle>
            <DialogDescription>颜色支持左侧色盘、下方常用色模板，或右侧手动输入 # 色值。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="必填" />
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">色盘</span>
                <input
                  type="color"
                  aria-label="取色器"
                  className="h-10 w-[4.5rem] min-h-10 min-w-[4.5rem] shrink-0 cursor-pointer rounded-md border-2 border-input bg-background p-0.5 shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
                  value={normalizeHexForNativePicker(color)}
                  onChange={(e) => setColor(e.target.value.toLowerCase())}
                />
                <Input
                  className="min-w-0 flex-1 font-mono text-sm"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-muted-foreground">可直接在色盘里选，或点下方模板 / 手动输入 # 开头的色值</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {TAG_COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    onClick={() => setColor(hex)}
                    className={cn(
                      'h-8 w-8 shrink-0 rounded-full border-2 shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      color.trim().toLowerCase() === hex
                        ? 'border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background'
                        : 'border-white/80 dark:border-zinc-900',
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>分类（可选）</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void onSave()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
