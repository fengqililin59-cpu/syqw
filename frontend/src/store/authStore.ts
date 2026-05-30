/**
 * @file 登录态（Zustand + persist）：token、租户、当前用户，供路由守卫与请求拦截使用。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hasPermUser } from '@/lib/roles'

export type ThemeId = 'blue' | 'green' | 'dark' | 'orange' | 'wecom'

export type AuthUser = {
  id: number
  tenant_id: number
  username: string
  real_name?: string | null
  is_guest?: boolean
  Role?: { id: number; name: string } | null
  /** 登录接口冗余字段，与 Role 二选一存在 */
  role?: { id: number; name: string } | null
}

type AuthState = {
  token: string | null
  tenantId: number | null
  tenantName: string | null
  user: AuthUser | null
  isDemo: boolean
  isGuest: boolean
  permissions: string[]
  theme: ThemeId
  setSession: (payload: { token: string; tenantId: number; tenantName?: string | null; user: AuthUser; permissions?: string[] }) => void
  setPermissions: (permissions: string[]) => void
  setIsDemo: (val: boolean) => void
  setTheme: (theme: ThemeId) => void
  /** 是否与后端 hasPerm 对齐（含 channel/ads 等兼容映射） */
  hasPerm: (code: string) => boolean
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      tenantId: null,
      tenantName: null,
      user: null,
      isDemo: false,
      isGuest: false,
      permissions: [],
      theme: 'blue' as ThemeId,
      setSession: (payload) =>
        set({
          token: payload.token,
          tenantId: payload.tenantId,
          tenantName: payload.tenantName ?? null,
          user: payload.user,
          isDemo: false,
          isGuest: payload.user?.is_guest ?? false,
          permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
        }),
      setPermissions: (permissions) => set({ permissions: Array.isArray(permissions) ? permissions : [] }),
      setIsDemo: (val) => set({ isDemo: Boolean(val) }),
      setTheme: (theme) => {
        set({ theme })
        const html = document.documentElement
        html.classList.remove('theme-blue', 'theme-green', 'theme-dark', 'theme-orange', 'theme-wecom')
        html.classList.add(`theme-${theme}`)
        localStorage.setItem('zf-theme', theme)
      },
      hasPerm: (code) => hasPermUser(get().permissions, code),
      clear: () => set({ token: null, tenantId: null, tenantName: null, user: null, isDemo: false, isGuest: false, permissions: [] }),
    }),
    {
      name: 'wework-saas-auth',
      partialize: (s) => ({
        token: s.token,
        tenantId: s.tenantId,
        tenantName: s.tenantName,
        user: s.user,
        isDemo: s.isDemo,
        isGuest: s.isGuest,
        permissions: s.permissions,
        theme: s.theme,
      }),
    },
  ),
)
