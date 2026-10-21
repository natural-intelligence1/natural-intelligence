// ─── apps/care/components/cockpit/cockpitTokens.ts ──────────────────────────
// The APPROVED Cockpit V2 visual language, from IMPLEMENTATION-SPEC.md §2.
//
// The visual-design gate is CLOSED. These values are transcribed from the
// approved spec, not chosen here. Changing one is a redesign, not a tweak.
//
// WHY THIS IS SEPARATE FROM caseTheme.ts
//
// caseTheme.ts holds the greys and golds the rest of apps/care already uses
// (#FAFAF9 page, #B8935A gold). The Cockpit's approved palette is a different,
// warmer system — cream #F4ECDD, parchment, pine, oxblood — and the two are
// not interchangeable. Merging them would quietly restyle either the cockpit
// or every other case-workspace screen. They stay apart until a wider NI
// design-token exercise reconciles them, which is not this pilot's job.
//
// Fonts come from NI's existing pipeline: apps/care/app/layout.tsx already
// loads DM Sans and Cormorant Garamond (including italic) via next/font/google
// as --font-dm-sans and --font-display. No binaries are bundled.

/** Colour tokens — intent → value, exactly as approved. */
export const C = {
  // surfaces
  cream:      '#F4ECDD',   // page and right-pane background
  warmWhite:  '#FBF7EF',   // cards, header, footer
  parchment:  '#EFE6D4',   // left guide background
  sand:       '#E7DAC4',   // canvas/PDF backdrop only — not used in product

  // ink
  pine:       '#2E4636',   // primary buttons, active borders, verified badge
  botanical:  '#1E2F24',   // headings
  text:       '#26302A',   // body
  softText:   '#4A544C',   // helper text

  // accents
  gold:       '#B08A3E',   // borders, rules, overrun track — NEVER body text
  goldInk:    '#7D6128',   // gold text that meets 4.5:1
  oxblood:    '#8A3B2E',   // safety only. Calm, never hospital red

  // tints
  sage:       '#E9EDE3',   // amended badge, subtle success surfaces
  goldTint:   '#F6EBD3',   // draft and needs-clarification badges

  // lines
  line:       '#E0D4BE',   // default divider
  lineStrong: '#CFC2A8',   // stronger divider
  lineControl:'#B8A98C',   // control borders

  // further values used by the approved boards
  parchTint:  '#F7F0E2',   // guide chips and generated-item cards
  stepNow:    '#F6EFE0',   // current branch step row
  olive:      '#5E6B3F',   // running timer dot
  unconfirmed:'#8A7F6A',   // dashed unconfirmed border
  guideRule:  '#DCCFB6',   // guide footnote rule
  nodeBorder: '#D5DCCB',   // review-mode strip border
  nodeDiv:    '#C9D2BE',   // review-mode strip divider
  reconBorder:'#D9BE86',   // reconciliation panel border
} as const

/** Type — Cormorant Garamond for display, DM Sans for UI. */
export const F = {
  display: "var(--font-display), Georgia, serif",
  ui:      "var(--font-dm-sans), system-ui, sans-serif",
} as const

/** Fixed zone heights. The page itself never scrolls; the panes do. */
export const Z = {
  header: 64,
  tabs:   42,
  footer: 62,
  /** Left guide is fixed; the right pane takes the rest and stays dominant. */
  guideWidth: 440,
  /** Below this the guide narrows; see the responsive note in the spec. */
  guideNarrow: 360,
} as const

/** Eyebrow label — 11–12px, uppercase, .08em, 600. */
export function eyebrow(colour: string = C.softText, size = 11.5) {
  return {
    fontSize: `${size}px`,
    letterSpacing: '.08em',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
    color: colour,
  }
}

/** Provenance chip — 11px / 600, 6px radius. */
const chipBase = {
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: '6px',
  padding: '3px 7px',
  whiteSpace: 'nowrap' as const,
  display: 'inline-block',
}

/**
 * The approved provenance treatments.
 *
 * "Not asked" is a dotted border and is NEVER rendered or treated as "No" —
 * the distinction is the whole point of having a chip for it.
 */
export const PROVENANCE_CHIP: Record<string, React.CSSProperties> = {
  client_reported:      { ...chipBase, border: `1px solid ${C.gold}`, color: C.goldInk, background: C.warmWhite },
  practitioner_verified:{ ...chipBase, background: C.pine, color: C.cream },
  corrected:            { ...chipBase, border: `1px solid ${C.pine}`, color: C.pine, background: C.sage },
  observed:             { ...chipBase, border: `1px dashed ${C.pine}`, color: C.pine },
  unconfirmed:          { ...chipBase, border: `1px dashed ${C.unconfirmed}`, color: C.softText },
  not_asked:            { ...chipBase, border: `1px dotted ${C.softText}`, color: C.softText },
  declined:             { ...chipBase, background: C.parchment, color: C.softText, border: `1px solid ${C.lineStrong}` },
  // Non-provenance, same visual family.
  safety:               { ...chipBase, border: `1px solid ${C.oxblood}`, color: C.oxblood },
  student_draft:        { ...chipBase, border: `1px solid ${C.gold}`, color: C.goldInk, background: C.goldTint },
}

/** The legend shown beside the section title, in approved order. */
export const PROVENANCE_LEGEND: Array<{ key: string; label: string }> = [
  { key: 'client_reported',       label: 'Client reported' },
  { key: 'practitioner_verified', label: 'Practitioner verified' },
  { key: 'corrected',             label: 'Amended' },
  { key: 'observed',              label: 'Observed' },
  { key: 'unconfirmed',           label: 'Unconfirmed' },
  { key: 'not_asked',             label: 'Not asked' },
  { key: 'declined',              label: 'Declined' },
]

/** State pill — 10.5–11px / 600, uppercase, 999px radius. */
export function statePill(kind: 'review' | 'clarification' | 'resolved' | 'target' | 'neutral'): React.CSSProperties {
  const base = {
    fontSize: '10.5px',
    fontWeight: 600,
    letterSpacing: '.05em',
    textTransform: 'uppercase' as const,
    borderRadius: '999px',
    padding: '2px 7px',
    whiteSpace: 'nowrap' as const,
    display: 'inline-block',
  }
  switch (kind) {
    // The ONLY clinical review label. Oxblood fill, cream text.
    case 'review':        return { ...base, background: C.oxblood, color: C.cream }
    case 'clarification': return { ...base, background: C.goldTint, border: `1px solid ${C.gold}`, color: C.goldInk }
    case 'resolved':      return { ...base, border: `1px solid ${C.pine}`, color: C.pine }
    case 'target':        return { ...base, border: `1px dashed ${C.pine}`, color: C.pine, background: C.warmWhite }
    default:              return { ...base, border: `1px solid ${C.lineStrong}`, color: C.softText }
  }
}

/** Buttons: 8px radius in-card, 999px in header and footer. */
export function button(
  variant: 'primary' | 'outline' | 'mini' | 'miniPrimary' | 'disabled',
): React.CSSProperties {
  const pill = {
    font: `500 13px ${F.ui}`,
    borderRadius: '999px',
    padding: '8px 14px',
    minHeight: '38px',
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '7px',
    cursor: 'pointer' as const,
  }
  const mini = {
    font: `600 12.5px ${F.ui}`,
    borderRadius: '8px',
    padding: '7px 11px',
    minHeight: '36px',
    cursor: 'pointer' as const,
  }
  switch (variant) {
    case 'primary':     return { ...pill, background: C.pine, color: C.cream, border: `1px solid ${C.pine}` }
    case 'outline':     return { ...pill, background: 'transparent', color: C.pine, border: `1px solid ${C.lineControl}` }
    case 'mini':        return { ...mini, background: 'transparent', color: C.pine, border: `1px solid ${C.pine}` }
    case 'miniPrimary': return { ...mini, background: C.pine, color: C.cream, border: `1px solid ${C.pine}` }
    // Supervisor-only: parchment fill, soft text. Reads as unavailable
    // without shouting about it.
    case 'disabled':    return { ...mini, background: C.parchment, color: C.softText, border: `1px solid ${C.lineStrong}`, cursor: 'not-allowed' }
  }
}

/** Card — 1px line, 12px radius, no shadow. Depth is borders and tints only. */
export const card: React.CSSProperties = {
  background: C.warmWhite,
  border: `1px solid ${C.line}`,
  borderRadius: '12px',
}

/** Active question — pine border plus a 3px inset pine bar. */
export const cardActive: React.CSSProperties = {
  ...card,
  border: `1px solid ${C.pine}`,
  boxShadow: `inset 3px 0 0 ${C.pine}`,
}

/** Safety-active item — 1.5px oxblood border plus a 3px inset oxblood bar. */
export const cardSafety: React.CSSProperties = {
  ...card,
  border: `1.5px solid ${C.oxblood}`,
  boxShadow: `inset 3px 0 0 ${C.oxblood}`,
}
