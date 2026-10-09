// ─── Connected Care previews — shared primitives + synthetic case ────────────
// Admin-only, noindex, inert. Every value below is invented for demonstration;
// no real client, practitioner or case is represented.
//
// SELF-CONTAINED by design. On care-journey-v4-connected this file imported
// its palette and SyntheticBanner from ../_careV2/ui. That file belongs to the
// Care V2 synopsis preview, and its fixtures pull in the field registry, case
// snapshot and synopsis mapping — so importing it would have dragged the whole
// Care V2 preview architecture into this release for a colour table and a
// six-line banner.
//
// Carrying the palette explicitly is the established NI preview pattern: the
// pricing preview already on main declares the same `const C` locally, because
// the admin shell keeps its own theme and these pages render the public palette.

import type { V2Provenance } from '@natural-intelligence/db/intakeV2'

export const C = {
  cream: '#F4ECDD', warm: '#FBF7EF', sand: '#E7DAC4',
  pine: '#2E4636', botanical: '#1E2F24', sage: '#8AA07E', olive: '#5E6B3F',
  gold: '#B08A3E', goldInk: '#7D6128', goldPale: '#E2D2AE', goldWash: '#F5EDDA',
  text: '#26302A', text2: '#4A544C', muted: '#5F6862', border: '#E0D4BE',
}

export const display = { fontFamily: 'var(--font-display), serif' } as const
export const body = { fontFamily: 'var(--font-body), sans-serif' } as const

/** Standing banner: this surface is synthetic and inert. */
export function SyntheticBanner({ text }: { text: string }) {
  return (
    <div className="rounded-lg px-4 py-2.5 text-[12px] mb-6"
      style={{ ...body, background: C.goldWash, border: `1px dashed ${C.gold}`, color: C.goldInk }}>
      {text} All controls are inert — nothing is saved, sent or generated.
    </div>
  )
}

/** Focus indicator for the hand-rolled focusable spans these previews use.
 *  Inline `style` cannot express `:focus-visible`, so the ring has to be a
 *  class. Explicit rather than relying on the UA default ring, which is weak
 *  over the dark pine fill. Gold reads on both the cream page and white cards. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-[#7D6128] focus-visible:ring-offset-[#FBF7EF]'

// ─── Provenance chip (all approved states) ───────────────────────────────────

const CHIP: Record<V2Provenance, { label: string; bg: string; fg: string; border: string; dashed?: boolean }> = {
  client_reported:                        { label: 'Client reported',        bg: '#EEF2EA', fg: '#5E6B3F', border: '#C9D2BE' },
  practitioner_verified:                  { label: 'Practitioner verified',  bg: '#E9EFEA', fg: '#2E4636', border: '#B9CBBE' },
  corrected:                              { label: 'Corrected',              bg: '#F5EDDA', fg: '#7D6128', border: '#B08A3E' },
  missing:                                { label: 'Not answered',           bg: 'transparent', fg: '#5F6862', border: '#C9C2B2', dashed: true },
  documented_record:                      { label: 'Documented record',      bg: '#E9EFEA', fg: '#2E4636', border: '#B9CBBE' },
  unconfirmed:                            { label: 'Unconfirmed',            bg: 'transparent', fg: '#7D6128', border: '#B08A3E', dashed: true },
  not_asked:                              { label: 'Not asked',              bg: 'transparent', fg: '#5F6862', border: '#C9C2B2', dashed: true },
  declined:                               { label: 'Preferred to discuss',   bg: 'transparent', fg: '#5F6862', border: '#C9C2B2', dashed: true },
  system_organised:                       { label: 'Organised by NI',        bg: '#F3F1EA', fg: '#5F6862', border: '#DCD5C4' },
  system_structured_from_client_language: { label: 'From client’s words',    bg: '#F3F1EA', fg: '#5F6862', border: '#DCD5C4' },
  practitioner_interpreted:               { label: 'Practitioner view',      bg: '#E9EFEA', fg: '#2E4636', border: '#B9CBBE' },
}

export function Chip({ p }: { p: V2Provenance }) {
  const s = CHIP[p]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-medium whitespace-nowrap"
      style={{
        ...body, background: s.bg, color: s.fg,
        border: `1px ${s.dashed ? 'dashed' : 'solid'} ${s.border}`,
      }}
    >
      {s.label}
    </span>
  )
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function Shell({ eyebrow, title, intro, children }: {
  eyebrow: string; title: string; intro: string; children: React.ReactNode
}) {
  return (
    <main style={{ ...body, background: C.warm, color: C.text, minHeight: '100vh' }}>
      {/* break-words: identifiers like `member_protocols.assigned_by` have no
          break opportunity and would otherwise overflow the 320px viewport. */}
      <div className="mx-auto px-4 sm:px-6 py-10 break-words" style={{ maxWidth: '1040px' }}>
        <p className="text-[11px] font-medium tracking-[0.14em] uppercase mb-3" style={{ color: C.goldInk }}>
          {eyebrow}
        </p>
        <h1 className="mb-2" style={{ ...display, fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.1 }}>
          {title}
        </h1>
        <p className="text-[14px] mb-6" style={{ color: C.text2, maxWidth: '62ch' }}>{intro}</p>
        {children}
      </div>
    </main>
  )
}

export function Card({ title, note, tone = 'default', children }: {
  title?: string; note?: string; tone?: 'default' | 'gold' | 'pine'; children: React.ReactNode
}) {
  const bg = tone === 'gold' ? C.goldWash : tone === 'pine' ? '#EEF2EA' : '#FFFFFF'
  const border = tone === 'gold' ? C.goldPale : tone === 'pine' ? '#C9D2BE' : C.border
  return (
    <section className="rounded-2xl p-5 sm:p-6 mb-5" style={{ background: bg, border: `1px solid ${border}` }}>
      {title && (
        <h2 className="text-[15px] font-semibold mb-1" style={{ color: C.botanical }}>{title}</h2>
      )}
      {note && <p className="text-[12.5px] mb-4" style={{ color: C.muted }}>{note}</p>}
      {children}
    </section>
  )
}

/** A factual line with its provenance and source. */
export function Line({ label, value, p, source, original }: {
  label: string; value: string; p: V2Provenance; source?: string; original?: string
}) {
  return (
    <div className="py-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[12px] min-w-[120px]" style={{ color: C.muted }}>{label}</span>
        <span className="text-[14px] flex-1" style={{ color: C.text }}>{value}</span>
        <Chip p={p} />
      </div>
      {original && (
        <details className="mt-1.5">
          <summary className="text-[11.5px] cursor-pointer" style={{ color: C.goldInk }}>Source details</summary>
          <p className="text-[12.5px] mt-1.5 pl-3" style={{ color: C.text2, borderLeft: `2px solid ${C.goldPale}` }}>
            Client originally said: “{original}”
          </p>
        </details>
      )}
      {source && !original && (
        <p className="text-[11px] mt-1" style={{ color: C.muted }}>Source: {source}</p>
      )}
    </div>
  )
}

/** Inert control — these previews never submit anything. */
export function Inert({ children, variant = 'outline' }: {
  children: React.ReactNode; variant?: 'pine' | 'outline' | 'gold'
}) {
  const style = variant === 'pine'
    ? { background: C.pine, color: C.cream, border: `1px solid ${C.pine}` }
    : variant === 'gold'
      ? { background: C.goldWash, color: C.goldInk, border: `1px solid ${C.goldPale}` }
      : { background: 'transparent', color: C.pine, border: `1px solid ${C.pine}` }
  return (
    <span role="button" aria-disabled="true" tabIndex={0}
      className={`inline-flex items-center justify-center rounded-lg px-4 text-[13px] font-medium ${FOCUS_RING}`}
      style={{ ...body, ...style, minHeight: '44px' }}>
      {children}
    </span>
  )
}

/** A neutral selectable-looking chip (obstacle reasons and the like). Inert,
 *  but keyboard-reachable so the tab order can be checked. */
export function ChoiceChip({ children }: { children: React.ReactNode }) {
  return (
    <span role="button" aria-disabled="true" tabIndex={0}
      className={`inline-flex items-center rounded-full px-3.5 text-[13px] ${FOCUS_RING}`}
      style={{ ...body, minHeight: '44px', background: '#FFFFFF', color: C.text, border: `1px solid ${C.border}` }}>
      {children}
    </span>
  )
}

// ─── The synthetic case these three screens share ────────────────────────────

export const CASE = {
  clientName: 'Rowan Example',
  caseRef: 'NI-4F2A91',
  status: 'In care',
  lead: 'Amara Okafor — Accredited Practitioner',
  yourRole: 'Lead Responsible Practitioner',
  lastReview: '2026-09-18',
  nextReview: '2026-10-16',
  protocolVersion: 3,
  protocolSignedAt: '2026-09-18',
  protocolSignedBy: 'Amara Okafor',
}

export const PROTOCOL_ACTIONS = [
  {
    id: 'a1', instruction: 'Magnesium glycinate', amount: '200 mg', frequency: 'Once daily',
    timing: 'With evening meal', duration: '8 weeks',
    rationaleForClient: 'To support the sleep pattern you described.',
  },
  {
    id: 'a2', instruction: 'Short walk after lunch', amount: '', frequency: 'Five days a week',
    timing: 'After lunch', duration: 'Ongoing',
    rationaleForClient: 'You told us this already helps more than anything.',
  },
  {
    id: 'a3', instruction: 'Protein at breakfast', amount: '20–30 g', frequency: 'Daily',
    timing: 'Breakfast', duration: '8 weeks',
    rationaleForClient: 'To steady the mid-morning dip you noticed.',
  },
]
