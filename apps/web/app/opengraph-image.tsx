import { ImageResponse } from 'next/og'
import { NI_LOGO_BASE64 } from './ni-logo-og'

export const runtime     = 'edge'
export const alt         = 'Natural Intelligence'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           '1200px',
          height:          '630px',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          backgroundColor: '#F8F6F2',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NI_LOGO_BASE64}
          alt=""
          width={160}
          height={160}
          style={{ objectFit: 'contain', display: 'flex' }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
