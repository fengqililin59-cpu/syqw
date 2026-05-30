import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSidebarToken, sidebarFetch } from './sidebarAuth'

interface SidebarCustomerData {
  id: number
  name: string
  company: string
  position: string
  stage: string
  intent_score: number
  intent_tier: string
  last_contact_at: string
  tags: Array<{ name: string }>
  recent_followups: Array<{
    id: number
    content: string
    created_at: string
  }>
}

export default function SidebarCustomer() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const externalUserId = params.get('uid')
  const [customer, setCustomer] = useState<SidebarCustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!externalUserId) {
      setLoading(false)
      return
    }
    void loadCustomer()
  }, [externalUserId])

  async function loadCustomer() {
    try {
      setLoading(true)
      setNotFound(false)
      const token = getSidebarToken()
      if (!token) {
        throw new Error('未检测到登录态')
      }
      const res = await sidebarFetch(
        `/api/v1/customers/by-external-userid/${encodeURIComponent(externalUserId || '')}`,
      )
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      const payload = await res.json()
      if (!res.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '拉取客户信息失败')
      }
      setCustomer(payload.data)
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score: number) => (score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444')

  const stageMap: Record<string, string> = {
    new: '新客户',
    following: '跟进中',
    negotiating: '谈判中',
    won: '已成交',
    lost: '已流失',
    intent_confirm: '意向确认',
    proposal: '方案报价',
    negotiation: '商务谈判',
    deal: '成交',
  }

  if (loading) return <div style={{ padding: 20 }}>加载中...</div>

  if (notFound) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: '#666' }}>该客户暂未录入系统</p>
        <p style={{ fontSize: 12, color: '#999' }}>external_userid: {externalUserId}</p>
      </div>
    )
  }

  if (!customer) return <div style={{ padding: 20, color: '#666' }}>暂无客户信息</div>

  return (
    <div
      style={{
        fontFamily: 'system-ui',
        maxWidth: 375,
        margin: '0 auto',
        paddingBottom: 60,
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>{customer.name || '未命名客户'}</h2>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
              {customer.company || '未知公司'} · {customer.position || '未知职位'}
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: scoreColor(Number(customer.intent_score) || 0),
                lineHeight: 1,
              }}
            >
              {Number(customer.intent_score) || 0}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>意向分</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <span
            style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            {stageMap[customer.stage] ?? customer.stage}
          </span>
          {(customer.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag.name}
              style={{
                background: '#f3f4f6',
                color: '#374151',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <h3 style={{ fontSize: 13, color: '#999', margin: '0 0 8px', fontWeight: 500 }}>最近跟进</h3>
        {(customer.recent_followups || []).length === 0 ? (
          <p style={{ fontSize: 13, color: '#ccc' }}>暂无跟进记录</p>
        ) : (
          (customer.recent_followups || []).map((f) => (
            <div key={f.id} style={{ padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}>
              <p style={{ fontSize: 13, margin: '0 0 4px', lineHeight: 1.5 }}>{f.content}</p>
              <p style={{ fontSize: 11, color: '#ccc', margin: 0 }}>
                {new Date(f.created_at).toLocaleDateString('zh-CN')}
              </p>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
        }}
      >
        <button
          style={{
            flex: 1,
            padding: '12px 0',
            border: 'none',
            background: '#f0f9ff',
            color: '#0369a1',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          客户画像
        </button>
        <button
          onClick={() => navigate(`/sidebar/script?uid=${encodeURIComponent(externalUserId || '')}&cid=${customer.id}`)}
          style={{
            flex: 1,
            padding: '12px 0',
            border: 'none',
            background: '#fff',
            color: '#374151',
            fontSize: 13,
          }}
        >
          AI 话术
        </button>
      </div>
    </div>
  )
}
