/**
 * @file 打开智学 AI 主站（优先 bridge 联通，失败则回退首页）。
 */
import { getJson, postJson } from '@/api/client'

const DEFAULT_HOME = 'https://syzs.top'

export async function openSyzsPlatform(): Promise<void> {
  let home = DEFAULT_HOME
  try {
    const cfg = await getJson<{ enabled?: boolean; platform_url?: string }>('/integrations/syzs/config')
    if (cfg.platform_url) home = cfg.platform_url.replace(/\/$/, '')
  } catch {
    /* 使用默认主站 */
  }

  try {
    const data = await postJson<{ redirectUrl?: string }>('/integrations/syzs/bridge', {})
    if (data.redirectUrl) {
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
      return
    }
  } catch {
    /* bridge 失败时仍打开首页 */
  }

  window.open(`${home}/`, '_blank', 'noopener,noreferrer')
}
