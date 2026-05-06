import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Awaiting activation — NI Care' }

export default function PendingActivationPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '480px', width: '100%', padding: '64px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A8880', marginBottom: '20px' }}>
          Onboarding
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 400, lineHeight: 1.15, marginBottom: '24px' }}>
          Awaiting activation
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#555350', marginBottom: '36px' }}>
          Your application has been approved. Our team is completing the activation process
          and will be in touch shortly with next steps.
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
