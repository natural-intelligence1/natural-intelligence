import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'Natural Intelligence'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#F8F6F2',
          padding: '0 96px',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Warm glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            right: '-80px',
            width: '480px',
            height: '480px',
            borderRadius: '240px',
            background:
              'radial-gradient(circle, rgba(184,147,90,0.08) 0%, rgba(248,246,242,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Logo wordmark */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: '56px',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: '500',
              color: '#0E0D0B',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Natural Intelligence
          </span>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            fontSize: '13px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: '#B8935A',
            marginBottom: '28px',
          }}
        >
          Naturopathic &amp; functional medicine
        </div>

        {/* H1 line 1 */}
        <div
          style={{
            display: 'flex',
            fontSize: '68px',
            fontWeight: '300',
            color: '#0E0D0B',
            lineHeight: '1.05',
            letterSpacing: '-0.025em',
            marginBottom: '4px',
            fontStyle: 'italic',
          }}
        >
          The space between
        </div>

        {/* H1 line 2 */}
        <div
          style={{
            display: 'flex',
            fontSize: '68px',
            fontWeight: '600',
            color: '#0E0D0B',
            lineHeight: '1.05',
            letterSpacing: '-0.025em',
            marginBottom: '36px',
          }}
        >
          normal and thriving.
        </div>

        {/* Subline */}
        <div
          style={{
            display: 'flex',
            fontSize: '19px',
            fontWeight: '400',
            color: '#4A4945',
            lineHeight: '1.55',
            maxWidth: '560px',
          }}
        >
          Find trusted practitioners, join expert-led
          workshops, and access evidence-based health
          resources.
        </div>

        {/* Module pills — NO .map(), explicit divs */}
        <div
          style={{
            position: 'absolute',
            bottom: '64px',
            right: '96px',
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F2EFE9',
              border: '1px solid #DDD9D1',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#8A8880',
            }}
          >
            DailyPath
          </div>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F2EFE9',
              border: '1px solid #DDD9D1',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#8A8880',
            }}
          >
            BioHub
          </div>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F2EFE9',
              border: '1px solid #DDD9D1',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#8A8880',
            }}
          >
            RootFinder
          </div>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F2EFE9',
              border: '1px solid #DDD9D1',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#8A8880',
            }}
          >
            LifeTracker
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
