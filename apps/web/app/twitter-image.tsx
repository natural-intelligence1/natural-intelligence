import { ImageResponse } from 'next/og'
import { NI_LOGO_BASE64 } from './ni-logo-og'

export const runtime = 'edge'
export const alt = 'Natural Intelligence'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8F6F2',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <img
            src={NI_LOGO_BASE64}
            width={160}
            height={160}
            style={{ objectFit: 'contain', display: 'flex' }}
          />
          <span
            style={{
              fontSize: '18px',
              fontWeight: '400',
              color: '#0E0D0B',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Natural Intelligence
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#B8935A',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Naturopathic & functional medicine
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
