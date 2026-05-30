/**
 * @file 话术库管理：按分类维护常用话术，支持检索与 CRUD。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createScriptLibraryItem,
  deleteScriptLibraryItem,
  fetchScriptLibraryCategories,
  fetchScriptLibraryItems,
  updateScriptLibraryItem,
} from '@/api/scriptLibrary'
import type { ScriptLibraryItem } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const QUICK_CATEGORIES = [
  'general',
  'opening',
  'quote',
  'follow',
  'close',
  'after_sale',
]

export function ScriptLibraryPage() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<ScriptLibraryItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ScriptLibraryItem | null>(null)
  const [formCategory, setFormCategory] = useState('general')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)

  const allCategoryOptions = useMemo(() => {
    const set = new Set([...QUICK_CATEGORIES, ...categories])
    return Array.from(set)
  }, [categories])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [items, cats] = await Promise.all([
        fetchScriptLibraryItems({ category: category || undefined, keyword: keyword || undefined }),
        fetchScriptLibraryCategories(),
      ])
      setList(items)
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }, [category, keyword])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setFormCategory('general')
    setFormTitle('')
    setFormBody('')
    setFormSortOrder(0)
    setOpen(true)
  }

  function openEdit(row: ScriptLibraryItem) {
    setEditing(row)
    setFormCategory(row.category || 'general')
    setFormTitle(row.title)
    setFormBody(row.body)
    setFormSortOrder(Number(row.sort_order) || 0)
    setOpen(true)
  }

  async function onSave() {
    if (!formTitle.trim() || !formBody.trim()) {
      window.alert('标题和内容不能为空')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateScriptLibraryItem(editing.id, {
          category: formCategory.trim() || 'general',
          title: formTitle.trim(),
          body: formBody.trim(),
          sort_order: Number(formSortOrder) || 0,
        })
      } else {
        await createScriptLibraryItem({
          category: formCategory.trim() || 'general',
          title: formTitle.trim(),
          body: formBody.trim(),
          sort_order: Number(formSortOrder) || 0,
        })
      }
      setOpen(false)
      await load()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(row: ScriptLibraryItem) {
    if (!window.confirm(`确定删除话术「${row.title}」？`)) return
    await deleteScriptLibraryItem(row.id)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">话术库</h1>
          <p className="text-sm text-muted-foreground">沉淀常用开场、跟进、报价、促成话术，供团队复用。</p>
        </div>
        <Button onClick={openCreate}>新建话术</Button>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
          <div className="space-y-1">
            <Label>分类</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">全部</option>
              {allCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>关键词</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题或内容"
            />
          </div>
          <Button className="md:self-end" variant="outline" onClick={() => void load()}>
            查询
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>分类</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>内容</TableHead>
              <TableHead>排序</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>加载中...</TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.category}</TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <div className="max-w-[520px] truncate text-sm text-muted-foreground" title={row.body}>
                      {row.body}
                    </div>
                  </TableCell>
                  <TableCell>{row.sort_order}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void onDelete(row)}>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑话术' : '新建话术'}</DialogTitle>
            <DialogDescription>建议内容控制在 50-150 字，方便一键复制发送。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label>分类</Label>
                <Input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>排序（降序）</Label>
                <Input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>标题</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="例如：首聊破冰（贷款咨询）" />
            </div>
            <div className="space-y-1">
              <Label>内容</Label>
              <textarea
                className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="请输入可直接发送给客户的话术正文"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
