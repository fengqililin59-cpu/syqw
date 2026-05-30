/**
 * @file AI 知识库：产品/售后文档维护，供回复草稿 RAG 检索。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  archiveKbDocument,
  createKbDocument,
  fetchKbDocument,
  fetchKbDocuments,
  reindexAllKbDocuments,
  reindexKbDocument,
  updateKbDocument,
} from '@/api/aiEmployee'
import type { KbDocumentRow, Paginated } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const CATEGORIES = ['product', 'pricing', 'after_sale', 'faq', 'policy', 'general']

export function KnowledgeBasePage() {
  const [data, setData] = useState<Paginated<KbDocumentRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<KbDocumentRow | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [content, setContent] = useState('')
  const [indexMsg, setIndexMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchKbDocuments({
        page: 1,
        size: 50,
        status: statusFilter || undefined,
      })
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setTitle('')
    setCategory('general')
    setContent('')
    setOpen(true)
  }

  async function openEdit(row: KbDocumentRow) {
    setEditing(row)
    setTitle(row.title)
    setCategory(row.category || 'general')
    setOpen(true)
    setContent('')
    try {
      const full = await fetchKbDocument(row.id)
      setContent(full.content_text || '')
    } catch {
      setContent('')
    }
  }

  async function onSave() {
    if (!title.trim() || !content.trim()) {
      window.alert('标题与正文不能为空')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateKbDocument(editing.id, {
          title: title.trim(),
          category: category.trim() || 'general',
          content_text: content.trim(),
          status: 'active',
        })
      } else {
        await createKbDocument({
          title: title.trim(),
          category: category.trim() || 'general',
          content_text: content.trim(),
        })
      }
      setOpen(false)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function onArchive(row: KbDocumentRow) {
    if (!window.confirm(`归档「${row.title}」？归档后 AI 将不再检索该文档。`)) return
    await archiveKbDocument(row.id)
    await load()
  }

  async function onReindexAll() {
    if (!window.confirm('将为全部启用文档重建向量索引（需配置 OPENAI_API_KEY 或兼容 Embeddings API）。继续？')) return
    setIndexMsg(null)
    try {
      const res = await reindexAllKbDocuments()
      setIndexMsg(`已索引 ${res.documents} 篇文档，${res.chunks} 个片段，${res.embedded} 个已向量化`)
      await load()
    } catch (e) {
      setIndexMsg(e instanceof Error ? e.message : '索引失败')
    }
  }

  async function onReindexOne(row: KbDocumentRow) {
    setIndexMsg(null)
    try {
      const res = await reindexKbDocument(row.id)
      const s = res.index_stats
      setIndexMsg(
        `「${row.title}」已重建：${s?.chunks ?? 0} 片段，${s?.embedded ?? 0} 已向量化`,
      )
    } catch (e) {
      setIndexMsg(e instanceof Error ? e.message : '索引失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI 知识库</h1>
          <p className="text-sm text-muted-foreground">
            维护产品说明、价格政策与售后话术。已配置 OPENAI_API_KEY 时自动向量检索；否则按关键词匹配。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void onReindexAll()}>
            重建全部索引
          </Button>
          <Button onClick={openCreate}>新建文档</Button>
        </div>
      </div>

      {indexMsg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {indexMsg}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground">状态</Label>
        <select
          className={cn(
            'h-9 rounded-md border border-input bg-transparent px-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="active">启用</option>
          <option value="archived">已归档</option>
          <option value="">全部</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && (data?.list.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  暂无文档，点击「新建文档」添加产品与售后资料。
                </TableCell>
              </TableRow>
            ) : null}
            {data?.list.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.title}</TableCell>
                <TableCell>{row.category || '—'}</TableCell>
                <TableCell>
                  <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                    {row.status === 'active' ? '启用' : '归档'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => void openEdit(row)}>
                    编辑
                  </Button>
                  {row.status === 'active' ? (
                    <Button variant="ghost" size="sm" onClick={() => void onReindexOne(row)}>
                      重建索引
                    </Button>
                  ) : null}
                  {row.status === 'active' ? (
                    <Button variant="ghost" size="sm" onClick={() => void onArchive(row)}>
                      归档
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑文档' : '新建文档'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="kb-title">标题</Label>
              <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-cat">分类</Label>
              <select
                id="kb-cat"
                className={cn(
                  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-body">正文</Label>
              <textarea
                id="kb-body"
                rows={12}
                className={cn(
                  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="产品卖点、价格说明、售后政策等…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void onSave()}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
