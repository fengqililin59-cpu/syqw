import { useState, useEffect, useCallback } from 'react';
import {
  fetchKbArticles, fetchKbCategories, deleteKbArticle,
  publishKbArticle, archiveKbArticle, fetchKbArticleStats,
  type KbArticleRecord, type KbCategoryRecord,
} from '@/api/knowledgeBase';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';
import {
  Plus, Search, FileText, Eye,
  Edit2, Trash2, Send, Archive, BookOpen,
  Star, StarOff, Clock, CheckCircle,
} from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:          { label: '草稿',   color: '#F59E0B' },
  pending_review: { label: '待审核', color: '#6366F1' },
  published:      { label: '已发布', color: '#10B981' },
  archived:        { label: '已归档', color: '#9CA3AF' },
};

export default function KbArticlePage() {
  const { user } = useAuthStore();
  const tenantId = user?.tenant_id;

  const [articles, setArticles] = useState<KbArticleRecord[]>([]);
  const [categories, setCategories] = useState<KbCategoryRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const pageSize = 15;

  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<KbArticleRecord | null>(null);
  const [form, setForm] = useState({
    title: '',
    category_id: '',
    content: '',
    content_type: 'markdown' as 'html' | 'markdown' | 'text',
    summary: '',
    tags: '',
    status: 'draft' as KbArticleRecord['status'],
    is_featured: false,
  });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const [articlesRes, categoriesRes, statsRes] = await Promise.all([
        fetchKbArticles({
          page,
          page_size: pageSize,
          keyword: keyword || undefined,
          status: statusFilter || undefined,
          category_id: categoryFilter ? Number(categoryFilter) : undefined,
          is_featured: featuredFilter === 'true' ? true : featuredFilter === 'false' ? false : undefined,
        }),
        fetchKbCategories({ is_published: false }),
        fetchKbArticleStats(),
      ]);
      setArticles(articlesRes.list || []);
      setTotal(articlesRes.total || (articlesRes.list || []).length);
      setCategories(categoriesRes || []);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, keyword, statusFilter, categoryFilter, featuredFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = () => { setPage(1); load(); };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', category_id: '', content: '', content_type: 'markdown', summary: '', tags: '', status: 'draft', is_featured: false });
    setShowModal(true);
  };

  const openEdit = (article: KbArticleRecord) => {
    setEditing(article);
    setForm({
      title: article.title,
      category_id: article.category_id ? String(article.category_id) : '',
      content: article.content,
      content_type: article.content_type,
      summary: article.summary || '',
      tags: article.tags || '',
      status: article.status,
      is_featured: article.is_featured,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        category_id: form.category_id ? Number(form.category_id) : null,
        tags: form.tags || null,
        summary: form.summary || null,
      };
      if (editing) {
        await import('@/api/knowledgeBase').then(m => m.updateKbArticle(editing.id, payload));
      } else {
        await import('@/api/knowledgeBase').then(m => m.createKbArticle(payload));
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此文章？')) return;
    try {
      await deleteKbArticle(id);
      load();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await publishKbArticle(id);
      load();
    } catch (err: any) {
      setError(err.message || '发布失败');
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await archiveKbArticle(id);
      load();
    } catch (err: any) {
      setError(err.message || '归档失败');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={pageStyle}>
      {/* 顶部标题 + 操作 */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>📚 知识库管理</h1>
          <p style={subtitleStyle}>
            创建和管理帮助文章，支持 AI 生成
            {tenantId ? (
              <>
                {' · '}
                <a
                  href={`/help-center.html?tenant=${tenantId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#5b8dd9', fontSize: 13 }}
                >
                  打开公开帮助中心
                </a>
              </>
            ) : null}
          </p>
        </div>
        <button onClick={openCreate} style={btnPrimaryStyle}>
          <Plus size={16} style={{ marginRight: 6 }} /> 新建文章
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div style={statsGridStyle}>
          <StatCard label="文章总数" value={stats.total} icon={<BookOpen size={20} />} color="#4F46E5" />
          <StatCard label="已发布" value={stats.published} icon={<CheckCircle size={20} />} color="#10B981" />
          <StatCard label="草稿" value={stats.draft} icon={<Clock size={20} />} color="#F59E0B" />
          <StatCard label="AI 生成" value={stats.ai_generated} icon={<FileText size={20} />} color="#8B5CF6" />
          <StatCard label="总浏览量" value={stats.total_views} icon={<Eye size={20} />} color="#3B82F6" />
        </div>
      )}

      {/* 搜索 + 筛选 */}
      <div style={filterBarStyle}>
        <div style={searchBoxStyle}>
          <Search size={16} color="#9CA3AF" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索文章标题或内容..."
            style={searchInputStyle}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending_review">待审核</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">全部分类</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={featuredFilter} onChange={e => { setFeaturedFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">全部推荐</option>
          <option value="true">推荐</option>
          <option value="false">非推荐</option>
        </select>
        <button onClick={() => { setKeyword(''); setStatusFilter(''); setCategoryFilter(''); setFeaturedFilter(''); setPage(1); }} style={btnResetStyle}>
          重置
        </button>
      </div>

      {error && <div style={errStyle}>{error}</div>}

      {/* 文章列表 */}
      {loading ? (
        <div style={loadingStyle}>加载中...</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>标题</th>
                <th style={thStyle}>分类</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>浏览</th>
                <th style={thStyle}>推荐</th>
                <th style={thStyle}>AI</th>
                <th style={thStyle}>更新时间</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 && (
                <tr><td colSpan={8} style={emptyStyle}>暂无文章，点击「新建文章」开始</td></tr>
              )}
              {articles.map(a => (
                <tr key={a.id} style={trStyle}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {a.is_featured && <Star size={14} fill="#F59E0B" color="#F59E0B" />}
                      <Link to={`/app/kb/articles/${a.id}`} style={titleLinkStyle}>
                        {a.title}
                      </Link>
                    </div>
                    {a.summary && <div style={summaryStyle}>{a.summary.slice(0, 60)}</div>}
                  </td>
                  <td style={tdStyle}>
                    {a.category_name
                      ? <span style={catBadgeStyle}>{a.category_name}</span>
                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...statusBadgeStyle, background: STATUS_MAP[a.status]?.color + '18', color: STATUS_MAP[a.status]?.color || '#666' }}>
                      {STATUS_MAP[a.status]?.label || a.status}
                    </span>
                  </td>
                  <td style={tdCenterStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={14} /> {a.view_count || 0}
                    </span>
                  </td>
                  <td style={tdCenterStyle}>
                    {a.is_featured
                      ? <Star size={16} fill="#F59E0B" color="#F59E0B" />
                      : <StarOff size={16} color="#D1D5DB" />}
                  </td>
                  <td style={tdCenterStyle}>
                    {a.ai_generated
                      ? <span style={{ fontSize: 12, background: '#EDE9FE', color: '#7C3AED', padding: '2px 8px', borderRadius: 4 }}>AI</span>
                      : null}
                  </td>
                  <td style={tdStyle}>{a.updated_at ? new Date(a.updated_at).toLocaleDateString('zh-CN') : '—'}</td>
                  <td style={tdCenterStyle}>
                    <div style={actionRowStyle}>
                      <button onClick={() => openEdit(a)} style={iconBtnStyle} title="编辑"><Edit2 size={15} /></button>
                      {a.status !== 'published' && (
                        <button onClick={() => handlePublish(a.id)} style={{ ...iconBtnStyle, color: '#10B981' }} title="发布"><Send size={15} /></button>
                      )}
                      {a.status === 'published' && (
                        <button onClick={() => handleArchive(a.id)} style={{ ...iconBtnStyle, color: '#6B7280' }} title="归档"><Archive size={15} /></button>
                      )}
                      <button onClick={() => handleDelete(a.id)} style={{ ...iconBtnStyle, color: '#EF4444' }} title="删除"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={paginationStyle}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pageBtnStyle}>上一页</button>
          <span style={{ fontSize: 14, color: '#374151' }}>第 {page} / {totalPages} 页，共 {total} 条</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={pageBtnStyle}>下一页</button>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{editing ? '编辑文章' : '新建文章'}</h3>
            <div style={fieldStyle}>
              <label style={labelStyle}>标题 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inpStyle} placeholder="文章标题" />
            </div>
            <div style={{ ...fieldStyle, display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>分类</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} style={inpStyle}>
                  <option value="">— 无分类 —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>内容类型</label>
                <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value as any }))} style={inpStyle}>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                  <option value="text">纯文本</option>
                </select>
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>摘要</label>
              <input value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} style={inpStyle} placeholder="文章摘要（自动提取前200字）" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>标签（逗号分隔）</label>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={inpStyle} placeholder="CRM, 使用教程, 常见问题" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>内容 *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inpStyle, minHeight: 200, fontFamily: form.content_type === 'markdown' ? 'monospace' : undefined }} placeholder={form.content_type === 'markdown' ? '支持 Markdown 格式...' : '输入文章内容...'} />
            </div>
            <div style={{ ...fieldStyle, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>状态</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} style={{ ...inpStyle, width: 140 }}>
                <option value="draft">草稿</option>
                <option value="pending_review">待审核</option>
                <option value="published">直接发布</option>
              </select>
              <label style={{ ...labelStyle, marginBottom: 0, marginLeft: 16 }}>推荐文章</label>
              <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={btnCancelStyle}>取消</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} style={btnPrimaryStyle}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- 统计卡片子组件 ---- */
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ ...statCardStyle, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? 0}</div>
      <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {icon}
        {label}
      </div>
    </div>
  );
}

/* ---- 样式 ---- */
const pageStyle: React.CSSProperties = { padding: 24, maxWidth: 1280, margin: '0 auto' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 };
const titleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: 0 };
const subtitleStyle: React.CSSProperties = { color: '#6B7280', margin: '4px 0 0' };
const statsGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 };
const statCardStyle: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const filterBarStyle: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' };
const searchBoxStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', flex: 1, minWidth: 260 };
const searchInputStyle: React.CSSProperties = { border: 'none', outline: 'none', padding: '10px 8px', fontSize: 14, width: '100%', background: 'transparent' };
const selStyle: React.CSSProperties = { padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, background: '#fff' };
const btnResetStyle: React.CSSProperties = { padding: '10px 16px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#374151' };
const btnPrimaryStyle: React.CSSProperties = { padding: '10px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center' };
const btnCancelStyle: React.CSSProperties = { padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer' };
const tableWrapStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' };
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 14, color: '#111827', borderBottom: '1px solid #F3F4F6', verticalAlign: 'top' };
const tdCenterStyle: React.CSSProperties = { ...tdStyle, textAlign: 'center' };
const trStyle: React.CSSProperties = { transition: 'background 0.15s' };
const summaryStyle: React.CSSProperties = { fontSize: 12, color: '#9CA3AF', marginTop: 4 };
const titleLinkStyle: React.CSSProperties = { color: '#4F46E5', textDecoration: 'none', fontWeight: 500 };
const catBadgeStyle: React.CSSProperties = { fontSize: 12, background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 4 };
const statusBadgeStyle: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 12, fontWeight: 500 };
const actionRowStyle: React.CSSProperties = { display: 'flex', gap: 6, justifyContent: 'center' };
const iconBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' };
const paginationStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 };
const pageBtnStyle: React.CSSProperties = { padding: '8px 16px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14 };
const errStyle: React.CSSProperties = { background: '#FEF2F2', color: '#DC2626', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };
const emptyStyle: React.CSSProperties = { padding: '40px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 };
const loadingStyle: React.CSSProperties = { padding: 40, textAlign: 'center', color: '#6B7280' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 32, minWidth: 600, maxWidth: 720, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const fieldStyle: React.CSSProperties = { marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 };
const inpStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
