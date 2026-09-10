import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import {
  getCurrentAgreement, isPractitionerCategory,
} from '@natural-intelligence/db/practitioners'
import { acceptCurrentAgreement } from './actions'

export const metadata: Metadata = { title: 'Practitioner agreement — NI Care' }

// Sprint 3 — post-approval agreement acceptance page. Reached via the
// middleware gate (PRACTITIONER_AGREEMENT_GATE, default off). Shows the
// current versioned agreement for the practitioner's category; acceptance is
// recorded with the agreement id + version. All text is
// DRAFT — requires solicitor/clinician review before real-client use.

export default async function AgreementPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let content: React.ReactNode
  if (!user) {
    content = <p style={{ fontSize: '15px', color: '#555350' }}>Please sign in first.</p>
  } else {
    // eslint-disable-next-line
    const loose = supabase as any
    const { data: prac } = await loose
      .from('practitioners').select('category').eq('id', user.id).maybeSingle()
    const category = prac?.category && isPractitionerCategory(prac.category) ? prac.category : null
    const agreement = category ? await getCurrentAgreement(supabase, category) : null

    if (!agreement) {
      content = (
        <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#555350' }}>
          No agreement is currently assigned to your account. The NI team will
          set your practitioner category and publish the agreement for it —
          you will be asked to accept it here before continuing.
        </p>
      )
    } else {
      content = (
        <>
          <p style={{ fontSize: '13px', color: '#8A8880', marginBottom: '16px' }}>
            Version {agreement.version} · DRAFT — requires solicitor/clinician review before real-client use
          </p>
          <div style={{
            textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: 1.7,
            color: '#3A3835', background: '#FFFFFF', border: '1px solid #E5E2DC',
            borderRadius: '12px', padding: '24px', marginBottom: '28px',
            maxHeight: '420px', overflowY: 'auto',
          }}>
            {agreement.body}
          </div>
          {/* agreement_id is a display cross-check only — the server re-derives
              the current agreement from the DB and rejects mismatches. */}
          <form action={acceptCurrentAgreement}>
            <input type="hidden" name="agreement_id" value={agreement.id} />
            <button
              type="submit"
              style={{
                background: '#2E4636', color: '#F4ECDD', border: 'none', cursor: 'pointer',
                padding: '14px 28px', borderRadius: '9999px', fontSize: '15px', fontWeight: 500,
              }}
            >
              I have read and accept this agreement
            </button>
          </form>
        </>
      )
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '640px', width: '100%', padding: '64px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A8880', marginBottom: '20px' }}>
          Practitioner agreement
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 400, lineHeight: 1.15, marginBottom: '24px' }}>
          Before you continue
        </h1>
        {content}
        <p style={{ marginTop: '28px' }}>
          <Link href="mailto:practitioners@natural-intelligence.uk" style={{ fontSize: '14px', color: '#B8935A', textDecoration: 'none' }}>
            Questions? Contact the NI team →
          </Link>
        </p>
      </div>
    </main>
  )
}
