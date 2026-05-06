import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Account not found — NI Care' }

export default function UnauthorisedPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '480px', width: '100%', padding: '64px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A8880', marginBottom: '20px' }}>
          Access
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 400, lineHeight: 1.15, marginBottom: '24px' }}>
          Account not found
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#555350', marginBottom: '36px' }}>
          Your account is not registered as a practitioner with Natural Intelligence.
          If you believe this is incorrect, please contact your programme coordinator.
        </p>
        <Link
          href="https://natural-intelligence.uk"
          style={{ fontSize: '14px', color: '#B8935A', textDecoration: 'none' }}
        >
          Return to natural-intelligence.uk →
        </Link>
      </div>
    </main>
  )
}
