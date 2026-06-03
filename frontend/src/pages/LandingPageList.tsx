import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchLandingPages, createLandingPage, deleteLandingPage,
  publishLandingPage, unpublishLandingPage, type LandingPageRecord,
} from '@/api/landingPage';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const STATUS_LABEL: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' };
const STATUS_COLOR: Record<string, string> = { draft: '#6B7280', published: '#10B981', archived: '#9CA3AF' };

export default function LandingPageList() {
  const nav = useNavigate();
  const [list, setList] = useState<LandingPageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLandingPages({ page, keyword });
      setList(data.list);
      setTotal(data.total);
    } catch { setList([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, keyword]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const lp = await createLandingPage({
        title: `新建落地页 ${new Date().toLocaleDateString()}`,
        content: { sections: [] },
      }) as LandingPageRecord;
      nav(`/app/landing-pages/${lp.id}/edit`);
    } catch (e: any) { alert(e?.message || '创建失败'); }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteLandingPage(confirmDel);
      setConfirmDel(null);
      load();
    } catch (e: any) { alert(e?.message || '删除失败'); }
  };

  const handlePublish = async (id: number) => {
    try {
      const lp = await publishLandingPage(id);
      setList(prev => prev.map(item => item.id === id ? { ...item, status: 'published', published_at: lp.published_at } : item));
    } catch (e: any) { alert(e?.message || '发布失败'); }
  };

  const handleUnpublish = async (id: number) => {
    try {
      await unpublishLandingPage(id);
      setList(prev => prev.map(item => item.id === id ? { ...item, status: 'draft' } : item));
    } catch (e: any) { alert(e?.message || '下线失败'); }
  };

  const previewUrl = (slug: string) => `${window.location.origin}/lp/${slug}`;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>落地页管理</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>创建营销落地页，获客留资，自动同步客户库</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, cursor: 'pointer' }}
        >{creating ? '创建中...' : '+ 新建落地页'}</button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          placeholder="搜索落地页名称..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setPage(1); }}
          style={{ flex: 1, maxWidth: 320, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#6B7280' }}>标题</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#6B7280' }}>路径</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500, color: '#6B7280', width: 80 }}>状态</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500, color: '#6B7280', width: 80 }}>访问</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500, color: '#6B7280', width: 80 }}>留资</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, color: '#6B7280', width: 240 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(lp => (
              <tr key={lp.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{lp.title}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{lp.created_at?.slice(0, 10)}</div>
                </td>
                <td style={{ padding: '12px 16px', color: '#534AB7' }}>/{lp.slug}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 12,
                    background: `${STATUS_COLOR[lp.status]}15`, color: STATUS_COLOR[lp.status], fontWeight: 500,
                  }}>{STATUS_LABEL[lp.status] || lp.status}</span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#6B7280' }}>{lp.view_count}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10B981', fontWeight: 500 }}>{lp.submit_count}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                  <button onClick={() => nav(`/app/landing-pages/${lp.id}/edit`)}
                    style={{ border: 'none', background: 'none', color: '#534AB7', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>编辑</button>
                  {lp.status === 'published' ? (
                    <button onClick={() => handleUnpublish(lp.id)}
                      style={{ border: 'none', background: 'none', color: '#F59E0B', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>下线</button>
                  ) : (
                    <button onClick={() => handlePublish(lp.id)}
                      style={{ border: 'none', background: 'none', color: '#10B981', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>发布</button>
                  )}
                  <button onClick={() => window.open(previewUrl(lp.slug), '_blank')}
                    style={{ border: 'none', background: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: 12, marginRight: 8 }}
                    disabled={lp.status !== 'published'}>预览</button>
                  <button onClick={() => nav(`/app/landing-pages/${lp.id}/submissions`)}
                    style={{ border: 'none', background: 'none', color: '#8B5CF6', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>留资</button>
                  <button onClick={() => setConfirmDel(lp.id)}
                    style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}>删除</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>暂无落地页，点击右上角「新建落地页」创建</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > 20 && <div style={{ marginTop: 16 }}><Pagination page={page} pageSize={20} total={total} onChange={setPage} /></div>}

      {confirmDel && (
        <ConfirmDialog
          message="删除后不可恢复，已收集的留资数据也将被清除。确认删除？"
          onConfirm={async () => { await handleDelete(); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
