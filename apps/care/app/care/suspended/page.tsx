import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Access suspended — NI Care' }

export default function SuspendedPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '480px', width: '100%', padding: '64px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A8880', marginBottom: '20px' }}>
          Account status
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 400, lineHeight: 1.15, marginBottom: '24px' }}>
          Access temporarily suspended
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#555350', marginBottom: '36px' }}>
          Your practitioner access has been suspended. If you have questions or believe
          this has been applied in error, please contact your programme coordinator.
        </p>
        <Link
          href="mailto:practitioners@natural-intelligence.uk"
          style={{ fontSize: '14px', color: '#B8935A', textDecoration: 'none' }}
        >
          Contact support →
        </Link>
      </div>
    </main>
  )
}
