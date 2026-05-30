import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSidebarToken, sidebarFetch } from './sidebarAuth'

export default function SidebarScript() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const externalUserId = params.get('uid')
  const customerId = params.get('cid')
  const [scripts, setScripts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function generateScripts() {
    if (!customerId) {
      setError('缺少客户ID')
      return
    }
    setLoading(true)
    setError('')
    try {
      const token = getSidebarToken()
      if (!token) {
        throw new Error('未检测到登录态')
      }
      const res = await sidebarFetch('/api/v1/ai/sidebar-scripts', {
        method: 'POST',
        body: JSON.stringify({ customer_id: Number(customerId) }),
      })
      const payload = await res.json()
      if (!res.ok || payload?.code !== 0) {
        throw new Error(payload?.message || '生成失败')
      }
      setScripts(payload?.data?.scripts ?? [])
    } catch (err: any) {
      setError(err?.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  async function copyScript(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui',
        maxWidth: 375,
        margin: '0 auto',
        paddingBottom: 60,
      }}
    >
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>AI 推荐话术</h2>

        <button
          onClick={() => {
            void generateScripts()
          }}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 0',
            background: loading ? '#e5e7eb' : '#0369a1',
            color: loading ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 16,
          }}
        >
          {loading ? '生成中...' : '生成话术建议'}
        </button>

        {error ? <p style={{ color: '#ef4444', fontSize: 12, marginTop: 0 }}>{error}</p> : null}

        {scripts.map((script, idx) => (
          <div
            key={idx}
            style={{
              background: '#f9fafb',
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
              border: '1px solid #e5e7eb',
            }}
          >
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 8px', color: '#374151' }}>{script}</p>
            <button
              onClick={() => {
                void copyScript(script, idx)
              }}
              style={{
                fontSize: 12,
                color: copied === idx ? '#22c55e' : '#0369a1',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {copied === idx ? '✓ 已复制' : '复制话术'}
            </button>
          </div>
        ))}

        {scripts.length === 0 && !loading && !error && (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            点击上方按钮生成专属话术
          </p>
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
          onClick={() => navigate(`/sidebar/customer?uid=${encodeURIComponent(externalUserId || '')}`)}
          style={{
            flex: 1,
            padding: '12px 0',
            border: 'none',
            background: '#fff',
            color: '#374151',
            fontSize: 13,
          }}
        >
          客户画像
        </button>
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
          AI 话术
        </button>
      </div>
    </div>
  )
}
