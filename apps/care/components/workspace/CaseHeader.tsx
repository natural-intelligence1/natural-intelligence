// ─── CaseHeader ──────────────────────────────────────────────────────────────
// Who this case is, who is responsible for it, and where it stands — the three
// things a practitioner needs before reading anything else.
//
// The client is shown by pseudonym. apps/care already works pseudonymously
// (see the reasoning route), and the workspace must not be the surface that
// reintroduces a legal name into practitioner view.

import { T, FONT_DISPLAY } from './caseTheme'

const STATUS_LABEL: Record<string, string> = {
  in_care: 'In care', awaiting_review: 'Awaiting review', closed: 'Closed',
}

export function CaseHeader({
  pseudonym, reference, ageBand, lead, leadCredential, leadRole, stage, status, nextReview,
}: {
  pseudonym: string; reference: string; ageBand: string
  lead: string; leadCredential: string; leadRole: string
  stage: string; status: string; nextReview: string
}) {
  return (
    <header style={{ padding: '28px 0 20px' }}>
      <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted, margin: '0 0 6px' }}>
        {reference} · Age {ageBand}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px', marginBottom: '10px' }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '30px', lineHeight: 1.1, color: T.text, margin: 0 }}>
          {pseudonym}
        </h1>
        {/* Status carries a word, not only a colour. */}
        <span style={{
          fontSize: '11.5px', padding: '3px 10px', borderRadius: '999px',
          background: T.sunken, border: `1px solid ${T.border}`, color: T.text2,
        }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      <dl style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '14px 28px', margin: 0, maxWidth: '860px',
      }}>
        <div>
          <dt style={{ fontSize: '11px', color: T.muted, margin: '0 0 2px' }}>{leadRole}</dt>
          <dd style={{ fontSize: '14px', color: T.text, margin: 0 }}>{lead}</dd>
          <dd style={{ fontSize: '12px', color: T.muted, margin: '2px 0 0' }}>{leadCredential}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '11px', color: T.muted, margin: '0 0 2px' }}>Stage</dt>
          <dd style={{ fontSize: '14px', color: T.text, margin: 0 }}>{stage}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '11px', color: T.muted, margin: '0 0 2px' }}>Next review</dt>
          <dd style={{ fontSize: '14px', color: T.text, margin: 0 }}>{nextReview}</dd>
        </div>
      </dl>
    </header>
  )
}
