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

type PlaybookScript = { id: number; title: string; body_preview: string; body: string }

type SidebarPlaybook = {
  show_assistant?: boolean
  ai_prompt?: string
  recommended_scripts?: PlaybookScript[]
  links?: { ai_assistant?: string; script_library?: string }
}

export default function SidebarCustomer() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const externalUserId = params.get('uid')
  const [customer, setCustomer] = useState<SidebarCustomerData | null>(null)
  const [playbook, setPlaybook] = useState<SidebarPlaybook | null>(null)
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
      setPlaybook(null)
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

      if (payload.data?.id && Number(payload.data.intent_score) >= 65) {
        const pbRes = await sidebarFetch(`/api/v1/customers/${payload.data.id}/intent-playbook`)
        const pbJson = await pbRes.json()
        if (pbRes.ok && pbJson?.code === 0 && pbJson.data?.show_assistant !== false) {
          setPlaybook(pbJson.data)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      window.alert('已复制')
    } catch {
      window.alert('复制失败')
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

  const topScripts = playbook?.recommended_scripts?.slice(0, 2) ?? []

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

      {playbook && topScripts.length > 0 ? (
        <div
          style={{
            margin: '12px 16px',
            padding: 12,
            borderRadius: 8,
            background: 'linear-gradient(135deg,#f5f3ff,#fff)',
            border: '1px solid #ddd6fe',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: '#5b21b6' }}>
            ✨ 推荐跟进话术
          </p>
          {topScripts.map((s) => (
            <div
              key={s.id}
              style={{
                marginBottom: 8,
                padding: 8,
                background: '#fff',
                borderRadius: 6,
                border: '1px solid #ede9fe',
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{s.title}</p>
              <p style={{ fontSize: 11, color: '#666', margin: '0 0 6px', lineHeight: 1.4 }}>
                {s.body_preview}…
              </p>
              <button
                type="button"
                onClick={() => void copyText(s.body)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  border: '1px solid #c4b5fd',
                  borderRadius: 4,
                  background: '#faf5ff',
                  color: '#6d28d9',
                }}
              >
                复制
              </button>
            </div>
          ))}
        </div>
      ) : null}

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
          type="button"
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
          type="button"
          onClick={() => {
            if (playbook?.links?.ai_assistant) {
              window.open(`${window.location.origin}${playbook.links.ai_assistant}`, '_blank')
              return
            }
            navigate(`/sidebar/script?uid=${encodeURIComponent(externalUserId || '')}&cid=${customer.id}`)
          }}
          style={{
            flex: 1,
            padding: '12px 0',
            border: 'none',
            background: '#faf5ff',
            color: '#6d28d9',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          AI 跟进
        </button>
        <button
          type="button"
          onClick={() =>
            navigate(`/sidebar/script?uid=${encodeURIComponent(externalUserId || '')}&cid=${customer.id}`)
          }
          style={{
            flex: 1,
            padding: '12px 0',
            border: 'none',
            background: '#fff',
            color: '#374151',
            fontSize: 13,
          }}
        >
          话术
        </button>
      </div>
    </div>
  )
}
