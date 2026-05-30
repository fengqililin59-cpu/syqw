interface ZhiFlowLogoProps {
  size?: 'sm' | 'lg'
  showText?: boolean
}

export default function ZhiFlowLogo({ size = 'sm', showText = true }: ZhiFlowLogoProps) {
  const isLg = size === 'lg'
  const boxSize = isLg ? 48 : 30
  const fontSize = isLg ? 28 : 17
  const dotSize = isLg ? 2.5 : 2
  const dotGap = isLg ? 2 : 1.5
  const dotAreaW = isLg ? 10 : 8

  return (
    <div className={`flex items-center ${isLg ? 'flex-col gap-3' : 'gap-2.5'}`}>
      <div
        className="relative flex-shrink-0 flex items-center justify-center overflow-hidden bg-[#0d1e35] border border-[rgba(99,148,220,0.3)]"
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: isLg ? 12 : 8,
        }}
      >
        <span
          className="font-black leading-none select-none bg-gradient-to-br from-[#7eb3f0] via-[#a78bfa] to-[#e0eeff] bg-clip-text text-transparent"
          style={{
            fontSize,
            letterSpacing: isLg ? '-2px' : '-1px',
          }}
        >
          Z
        </span>
        <div
          className="absolute flex flex-wrap"
          style={{
            gap: dotGap,
            width: dotAreaW,
            top: isLg ? 5 : 3,
            right: isLg ? 4 : 2,
          }}
        >
          {[0.9, 0.5, 0.7, 0.3, 0.8, 0.4].map((op, i) => (
            <div
              key={i}
              className="bg-[#7c6fe0] rounded-[0.5px]"
              style={{
                width: dotSize,
                height: dotSize,
                opacity: op,
              }}
            />
          ))}
        </div>
      </div>

      {showText ? (
        <div className={isLg ? 'text-center' : ''}>
          <div className={`font-bold text-[#e8f0fb] tracking-[0.3px] leading-tight ${isLg ? 'text-[22px]' : 'text-[14px]'}`}>
            ZhiFlow
          </div>
          <div
            className={`font-semibold text-[#2a4a6a] tracking-[0.08em] uppercase ${
              isLg ? 'text-[11px] mt-1' : 'text-[9px] mt-0.5'
            }`}
          >
            私域增长平台
          </div>
        </div>
      ) : null}
    </div>
  )
}

