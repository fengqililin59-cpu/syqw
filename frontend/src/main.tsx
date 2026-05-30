/**
 * @file 前端入口：挂载 React 根节点。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { trackAdLandingIfPresent, trackUtmOnLanding } from './utils/attribution'
import { useAuthStore } from './store/authStore'
import type { ThemeId } from './store/authStore'

// 启动时恢复主题（优先读 localStorage，其次 store 持久化值，默认 blue）
const savedTheme = (localStorage.getItem('zf-theme') || useAuthStore.getState().theme || 'blue') as ThemeId
document.documentElement.classList.add(`theme-${savedTheme}`)
useAuthStore.getState().setTheme(savedTheme)

void trackUtmOnLanding()
void trackAdLandingIfPresent()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
