import { BRAND_NAME, BRAND_TAGLINE } from '@/constants/brand'

interface ZhiFlowLogoProps {
  size?: 'sm' | 'lg'
  showText?: boolean
  /** 登录/注册浅色底用 light；侧栏深色底用 dark（默认） */
  variant?: 'dark' | 'light'
}

/** 纯文字品牌标识（无图形 logo，规避商标风险） */
export default function ZhiFlowLogo({
  size = 'sm',
  showText = true,
  variant = 'dark',
}: ZhiFlowLogoProps) {
  const isLg = size === 'lg'
  const isLight = variant === 'light'
  const titleColor = isLight ? 'text-[#0d1e35]' : 'text-[#e8f0fb]'
  const subColor = isLight ? 'text-[#2a4a6a]' : 'text-[#8aabb8]'

  if (!showText) return null

  return (
    <div className={`flex items-center ${isLg ? 'flex-col gap-1.5' : 'gap-0'}`}>
      <div className={isLg ? 'text-center' : ''}>
        <div
          className={`font-bold tracking-[0.3px] leading-tight ${titleColor} ${
            isLg ? 'text-[22px]' : 'text-[14px]'
          }`}
        >
          {isLg ? `${BRAND_NAME}${BRAND_TAGLINE}` : BRAND_NAME}
        </div>
        {!isLg ? (
          <div className={`mt-0.5 text-[9px] font-semibold tracking-[0.08em] ${subColor}`}>
            {BRAND_TAGLINE}
          </div>
        ) : null}
      </div>
    </div>
  )
}
