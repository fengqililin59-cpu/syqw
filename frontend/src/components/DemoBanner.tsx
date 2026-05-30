import { useNavigate } from 'react-router-dom'
import { postJson } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

export default function DemoBanner() {
  const isDemo = useAuthStore((s) => s.isDemo)
  const isGuest = useAuthStore((s) => s.isGuest)
  const setIsDemo = useAuthStore((s) => s.setIsDemo)
  const navigate = useNavigate()

  if (!isDemo) return null

  async function handleExitDemo() {
    await postJson('/auth/exit-demo', {}).catch(console.error)
    setIsDemo(false)
    navigate('/app/settings')
  }

  return (
    <div
      style={{
        background: '#0f2340',
        borderBottom: '0.5px solid rgba(99,148,220,0.25)',
        padding: '9px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#7eb3f0',
            background: 'rgba(99,148,220,0.15)',
            padding: '2px 8px',
            borderRadius: 4,
            border: '0.5px solid rgba(99,148,220,0.3)',
            letterSpacing: '0.04em',
          }}
        >
          演示模式
        </span>
        {isGuest ? (
          <span style={{ fontSize: 12, color: '#4a7aaa' }}>您正在体验演示数据</span>
        ) : (
          <span style={{ fontSize: 12, color: '#4a7aaa' }}>当前展示演示数据，配置企微后切换真实数据</span>
        )}
      </div>
      {isGuest ? (
        <button
          onClick={() => navigate('/register')}
          style={{
            fontSize: 12,
            color: '#7eb3f0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          立即注册 →
        </button>
      ) : (
        <button
          onClick={() => void handleExitDemo()}
          style={{
            fontSize: 12,
            color: '#7eb3f0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          立即配置企微 →
        </button>
      )}
    </div>
  )
}
