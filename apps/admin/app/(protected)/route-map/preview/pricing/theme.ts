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
} as const

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
