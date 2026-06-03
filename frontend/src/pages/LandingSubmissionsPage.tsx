import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchLandingSubmissions, fetchLandingPage, type LandingSubmissionRecord, type LandingPageRecord } from '@/api/landingPage';
import Pagination from '@/components/ui/Pagination';

export default function LandingSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [lp, setLp] = useState<LandingPageRecord | null>(null);
  const [list, setList] = useState<LandingSubmissionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [lpData, subData] = await Promise.all([
        fetchLandingPage(Number(id)),
        fetchLandingSubmissions(Number(id), { page }),
      ]);
      setLp(lpData);
      setList(subData.list);
      setTotal(subData.total);
    } catch { setList([]); setTotal(0); }
    finally { setLoading(false); }
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <button onClick={() => nav('/app/landing-pages')} style={{ border: 'none', background: 'none', color: '#534AB7', cursor: 'pointer', fontSize: 13, marginBottom: 4 }}>← 返回列表</button>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{lp?.title || '加载中...'} - 留资记录</h1>
        </div>
        <span style={{ fontSize: 13, color: '#6B7280' }}>共 {total} 条留资</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#6B7280' }}>留资数据</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#6B7280', width: 120 }}>来源</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#6B7280', width: 140 }}>时间</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#6B7280', width: 100 }}>关联客户</th>
            </tr>
          </thead>
          <tbody>
            {list.map(sub => (
              <tr key={sub.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px' }}>
                  {sub.data && Object.entries(sub.data).map(([k, v]) => (
                    <span key={k} style={{
                      display: 'inline-block', marginRight: 12, marginBottom: 4,
                      background: '#F3F4F6', padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    }}>
                      <strong>{k}:</strong> {String(v)}
                    </span>
                  ))}
                </td>
                <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 12 }}>
                  {sub.utm_source && <span style={{ marginRight: 6 }}>{sub.utm_source}</span>}
                  {sub.utm_medium && <span style={{ marginRight: 6 }}>/ {sub.utm_medium}</span>}
                </td>
                <td style={{ padding: '12px 16px', color: '#9CA3AF', fontSize: 12 }}>{sub.created_at?.slice(0, 16)}</td>
                <td style={{ padding: '12px 16px', fontSize: 12 }}>
                  {sub.Customer ? (
                    <span style={{ color: '#10B981' }}>{sub.Customer.name}</span>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>未关联</span>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>暂无留资数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > 20 && <div style={{ marginTop: 16 }}><Pagination page={page} pageSize={20} total={total} onChange={setPage} /></div>}
    </div>
  );
}
