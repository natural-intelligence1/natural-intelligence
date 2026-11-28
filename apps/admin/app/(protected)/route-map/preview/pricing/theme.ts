// ─── Pricing preview — shared palette and type scale ─────────────────────────
// NI Brand System V1, carried as explicit values because the admin app keeps
// its own dark-shell theme and the preview must render the PUBLIC palette.
// Plain data so both the server page and the client panels can import it.

export const C = {
  cream: '#F4ECDD', warm: '#FBF7EF', sand: '#E7DAC4', paper: '#FFFDF9',
  pine: '#2E4636', botanical: '#1E2F24', sage: '#8AA07E', olive: '#5E6B3F',
  gold: '#B08A3E', goldInk: '#7D6128', goldPale: '#E2D2AE', goldLine: '#D9C9A3',
  text: '#26302A', text2: '#4A544C', muted: '#5F6862', border: '#E0D4BE',
  // Diagram-specific values from the design canvas.
  dPrimary: '#E6EEE5', dNeutral: '#F1ECE2', dStroke: '#4E7A5C',
  dStrokeOff: '#DDD4C4', dInk: '#0E0D0B', dInkOff: '#7A7266',
  dLeadRing: '#B8935A',
  // ── Eyebrow ink, taken from the v14 artboards ────────────────────────────
  // Gold #B8935A is ORNAMENT ONLY: rules, rings, the table rim. Eyebrows and
  // other small uppercase text use these two instead.
  //
  // Note for the record: the correction pack quoted sage as #4E7A5C, but every
  // eyebrow in the artboards is #3F6B4D. The artboards are authoritative for
  // visual fidelity, so #3F6B4D is what is used; #4E7A5C remains in use as the
  // nutrition-category dot colour inside the galaxy, which is where it appears
  // in the design source.
  eyebrowInk: '#5E5850',
  eyebrowSage: '#3F6B4D',
} as const

/**
 * Cormorant Garamond 500 — H2s, panel titles, table titles, price figures.
 *
 * WEIGHT 500, NOT 300. The superseded build used `font-light` throughout,
 * which rendered the display face a full two steps lighter than the artboards
 * and made every heading look washed out beside the body text.
 *
 * `--ni-display` is the next/font variable set on the preview root, so this is
 * the same loaded face the page headings use rather than a Georgia fallback.
 */
export const DISPLAY_FAMILY = "var(--ni-display), 'Cormorant Garamond', Georgia, serif"

export const DISPLAY: React.CSSProperties = {
  fontFamily: DISPLAY_FAMILY,
  fontWeight: 500,
}

/** Cormorant italic — the one-line taglines under a panel title. */
export const TAGLINE: React.CSSProperties = {
  fontFamily: DISPLAY_FAMILY,
  fontWeight: 500,
  fontStyle: 'italic',
}

export const CHIP_ON: React.CSSProperties = {
  border: `1px solid ${C.pine}`, background: C.pine, color: '#F8F6F2',
  borderRadius: 999, padding: '7px 13px', minHeight: 36, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
}

export const CHIP_OFF: React.CSSProperties = {
  border: '1px solid #D6CDBC', background: C.paper, color: '#2A2723',
  borderRadius: 999, padding: '7px 13px', minHeight: 36, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
}
