import Link                from 'next/link'
import type { Metadata }  from 'next'
import { createAdminClient } from '@natural-intelligence/db'

export const metadata: Metadata = {
  title: 'Cases — NI Care',
}

export default async function CasesPage() {
  const admin = createAdminClient()

  const { data: cases } = await admin
    .from('client_cases')
    .select(`
      id,
      status,
      primary_concern,
      case_complexity_score,
      escalation_required,
      created_at,
      profiles:client_id (full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A8880', marginBottom: '8px' }}>
            NI Care
          </p>
          <h1 style={{ fontSize: '28px', fontWeight: 500, margin: 0 }}>Active Cases</h1>
        </div>

        {!cases || cases.length === 0 ? (
          <p style={{ color: '#8A8880', fontSize: '15px' }}>
            No cases yet. Cases are created automatically when members complete their health intake.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#E8E6E0', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 100px 120px', gap: '16px', padding: '12px 20px', background: '#F4F3F0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A8880', fontWeight: 500 }}>
              <span>Client</span>
              <span>Primary Concern</span>
              <span>Complexity</span>
              <span>Escalation</span>
              <span></span>
            </div>

            {cases.map((c) => {
              const profile = c.profiles as unknown as { full_name: string | null } | null
              const name = profile?.full_name ?? 'Unknown'
              const initials = name
                .split(' ')
                .map(w => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <div
                  key={c.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 100px 120px', gap: '16px', padding: '16px 20px', background: '#FFFFFF', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1A1917', color: '#F8F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{name}</span>
                  </div>
                  <span style={{ fontSize: '14px', color: '#555350' }}>{c.primary_concern ?? '—'}</span>
                  <span style={{ fontSize: '14px', color: '#555350', textAlign: 'center' }}>{c.case_complexity_score}</span>
                  <span style={{ fontSize: '13px' }}>
                    {c.escalation_required
                      ? <span style={{ color: '#C0392B', fontWeight: 600 }}>Escalated</span>
                      : <span style={{ color: '#8A8880' }}>No</span>
                    }
                  </span>
                  <Link
                    href={`/cases/${c.id}/reasoning`}
                    style={{ fontSize: '13px', color: '#B8935A', fontWeight: 500, textDecoration: 'none' }}
                  >
                    View reasoning →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
