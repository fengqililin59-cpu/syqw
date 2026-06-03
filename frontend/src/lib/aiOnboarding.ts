/**
 * @file 注册后 / 首次 AI 引导（本地标记，不依赖后端）。
 */
const SESSION_FLAG = 'zf_show_ai_guide'
const DISMISS_PREFIX = 'zf_ai_guide_dismiss_'

export function markShowAiGuideAfterRegister() {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1')
  } catch {
    /* ignore */
  }
}

export function consumeShowAiGuideSession(): boolean {
  try {
    const v = sessionStorage.getItem(SESSION_FLAG)
    if (v === '1') {
      sessionStorage.removeItem(SESSION_FLAG)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function isAiGuideDismissed(userId: number) {
  try {
    return localStorage.getItem(`${DISMISS_PREFIX}${userId}`) === '1'
  } catch {
    return false
  }
}

export function dismissAiGuide(userId: number) {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${userId}`, '1')
  } catch {
    /* ignore */
  }
}
