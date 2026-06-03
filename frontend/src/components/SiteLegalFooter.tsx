import { SITE_LEGAL_COMPANY, SITE_LEGAL_ICP, SITE_LEGAL_ICP_URL } from '@/constants/siteLegal'

type SiteLegalFooterProps = {
  className?: string
  /** 登录/注册页：带产品副标题；默认仅版权与备案行 */
  showProductTagline?: boolean
}

export function SiteLegalFooter({ className = '', showProductTagline = false }: SiteLegalFooterProps) {
  return (
    <p className={`text-center text-[11px] leading-relaxed text-[#8aabb8] ${className}`.trim()}>
      {showProductTagline ? (
        <>
          © 2026 ZhiFlow · 私域增长平台
          <br />
        </>
      ) : (
        <>© 2026 ZhiFlow · </>
      )}
      {SITE_LEGAL_COMPANY} ·{' '}
      <a
        href={SITE_LEGAL_ICP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-[#5b8dd9]"
      >
        {SITE_LEGAL_ICP}
      </a>
    </p>
  )
}
