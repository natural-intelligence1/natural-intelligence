// ─── Care V2 preview — shared UI primitives ───────────────────────────────────
// Self-contained NI brand palette (the admin shell keeps its own theme, so the
// previews carry the public palette explicitly — same approach as the pricing
// preview). Cormorant display / DM Sans body arrive via next/font CSS
// variables set by each preview page.

import type { Provenance, Sourced } from './fixtures'

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

const PROVENANCE_STYLE: Record<Provenance, { label: string; bg: string; fg: string; border: string; dashed?: boolean }> = {
  client:    { label: 'Client-reported',       bg: '#EEF2EA', fg: '#5E6B3F', border: '#C9D2BE' },
  verified:  { label: 'Practitioner-verified', bg: '#E9EFEA', fg: '#2E4636', border: '#B9CBBE' },
  corrected: { label: 'Corrected',             bg: '#F5EDDA', fg: '#7D6128', border: '#B08A3E' },
  missing:   { label: 'Missing',               bg: 'transparent', fg: '#5F6862', border: '#C9C2B2', dashed: true },
}

/** Provenance chip — appears on every claim in the synopsis. */
export function ProvenanceChip({ provenance }: { provenance: Provenance }) {
  const p = PROVENANCE_STYLE[provenance]
  return (
    <span className="inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-medium tracking-wide whitespace-nowrap align-middle"
      style={{ ...body, background: p.bg, color: p.fg, border: `1px ${p.dashed ? 'dashed' : 'solid'} ${p.border}` }}>
      {p.label}
    </span>
  )
}

/** A sourced fact: value + provenance chip; a correction NEVER overwrites the
 *  original — it renders beside it with who/when (the audit trail). */
export function Fact({ label, fact }: { label?: string; fact: Sourced }) {
  return (
    <div style={body}>
      {label && <p className="text-[11px] mb-0.5" style={{ color: C.muted }}>{label}</p>}
      {fact.provenance === 'missing' || fact.value === '' ? (
        <p className="text-[13px] italic" style={{ color: C.muted }}>
          Not provided <ProvenanceChip provenance="missing" />
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed" style={{ color: C.text }}>
          {fact.value} <ProvenanceChip provenance={fact.provenance} />
        </p>
      )}
      {fact.provenance === 'corrected' && fact.correction && (
        <p className="text-[12px] mt-1 pl-3 leading-relaxed" style={{ color: C.goldInk, borderLeft: `2px solid ${C.gold}` }}>
          Correction (original kept above): {fact.correction}
          {fact.correctedBy && <span style={{ color: C.muted }}> — {fact.correctedBy}{fact.correctedAt ? `, ${fact.correctedAt}` : ''}</span>}
        </p>
      )}
    </div>
  )
}

/** Section shell with the NI display face for headings. */
export function Section({ number, title, note, children, tone = 'default' }: {
  number?: string; title: string; note?: string; children: React.ReactNode
  tone?: 'default' | 'gold'
}) {
  return (
    <section className="rounded-2xl p-6 mb-5"
      style={{ background: C.warm, border: `1px solid ${tone === 'gold' ? C.gold : C.border}` }}>
      <div className="flex items-baseline gap-3 mb-4">
        {number && (
          <span className="font-mono text-[10px] tracking-[0.14em]" style={{ color: tone === 'gold' ? C.goldInk : C.muted }}>{number}</span>
        )}
        <h2 className="text-[22px] font-medium" style={{ ...display, color: tone === 'gold' ? C.goldInk : C.pine }}>{title}</h2>
      </div>
      {note && <p className="text-[12px] -mt-2 mb-4 leading-relaxed" style={{ ...body, color: C.muted }}>{note}</p>}
      {children}
    </section>
  )
}

/** Inert control — a picture of a button. Cannot submit or save anything. */
export function InertControl({ children, variant = 'outline' }: { children: React.ReactNode; variant?: 'pine' | 'outline' | 'gold' }) {
  const styles: Record<string, React.CSSProperties> = {
    pine:    { background: C.pine, color: C.cream, border: '1px solid transparent' },
    outline: { background: 'transparent', color: C.text2, border: `1px solid ${C.border}` },
    gold:    { background: 'transparent', color: C.goldInk, border: `1px solid ${C.gold}` },
  }
  return (
    <span role="button" aria-disabled="true" title="Preview only — controls are inert"
      className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-[12px] font-medium cursor-default select-none"
      style={{ ...body, ...styles[variant] }}>
      {children}
    </span>
  )
}
