import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'Natural Intelligence — intelligent natural healthcare'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#F8F6F2',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px 96px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle background grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(14,13,11,.015) 1px, transparent 1px), ' +
              'linear-gradient(90deg, rgba(14,13,11,.015) 1px, transparent 1px)',
            backgroundSize: '88px 88px',
          }}
        />

        {/* Gold accent bar — top left */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: '#B8935A',
            opacity: 0.6,
          }}
        />

        {/* Logo wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '56px',
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: '18px',
              fontWeight: 500,
              color: '#0E0D0B',
              letterSpacing: '0.04em',
            }}
          >
            Natural{'  '}
            <span style={{ color: '#B8935A' }}>Intelligence</span>
          </span>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#B8935A',
            marginBottom: '24px',
            zIndex: 1,
          }}
        >
          Naturopathic &amp; functional medicine
        </div>

        {/* Headline — line 1 */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 300,
            color: '#0E0D0B',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            marginBottom: '8px',
            maxWidth: '840px',
            zIndex: 1,
          }}
        >
          The space between
        </div>

        {/* Headline — line 2 */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 600,
            color: '#0E0D0B',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            marginBottom: '40px',
            maxWidth: '840px',
            zIndex: 1,
          }}
        >
          normal and thriving.
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: '20px',
            fontWeight: 400,
            color: '#4A4945',
            lineHeight: 1.6,
            maxWidth: '600px',
            zIndex: 1,
          }}
        >
          Find trusted practitioners, join expert-led workshops,
          and access evidence-based health resources.
        </div>

        {/* Bottom-right module pills */}
        <div
          style={{
            position: 'absolute',
            bottom: '64px',
            right: '96px',
            display: 'flex',
            gap: '8px',
          }}
        >
          {['DailyPath', 'BioHub', 'RootFinder', 'LifeTracker'].map((name) => (
            <div
              key={name}
              style={{
                background: '#F2EFE9',
                border: '1px solid #DDD9D1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#8A8880',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
