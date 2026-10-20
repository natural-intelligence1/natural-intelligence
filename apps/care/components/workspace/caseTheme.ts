// ─── apps/care/components/workspace/caseTheme.ts ─────────────────────────────
// The values apps/care already uses, named once.
//
// This is NOT a new design system. apps/care styles inline with literal hex,
// and those hex values are the design tokens by another route: #B8935A is
// brand-default, #1A1917 surface-dark, #8A8880 text-muted, #F8F6F2
// surface-base. Collecting them here stops the case workspace inventing an
// eleventh spelling of the same greys, without migrating the whole app to
// Tailwind classes tonight.

export const T = {
  // surfaces
  page:    '#FAFAF9',   // as used by the existing case routes
  card:    '#FFFFFF',
  sunken:  '#F8F6F2',
  // ink
  text:    '#1A1917',
  text2:   '#4A4945',
  muted:   '#8A8880',
  faint:   '#D0CEC9',
  // lines
  border:  '#E8E6E0',
  // accent — the gold already used for the active nav marker
  gold:    '#B8935A',
  goldInk: '#7D6128',
  goldWash:'#FBF7EF', goldPale:'#E2D2AE',
  // calm status tints, matching the existing reasoning palette's weight
  okBg:    '#F0FDF4', okText: '#166534', okBorder: '#BBF7D0',
  warnBg:  '#FFFBEB', warnText:'#8A6400', warnBorder:'#FDE68A',
} as const

export const FONT_DISPLAY = 'var(--font-display), Georgia, serif'

/** Shared focus treatment. Care has no global focus style; without this the
 *  keyboard path through the workspace is invisible. */
export const focusable = {
  outlineOffset: '2px',
} as const

export const SECTIONS = [
  { slug: '',            label: 'Overview' },
  { slug: 'intake',      label: 'Intake' },
  { slug: 'synopsis',    label: 'Synopsis' },
  { slug: 'evidence',    label: 'Evidence & Systems' },
  { slug: 'nutrition',   label: 'Nutrition' },
  { slug: 'aims',        label: 'Aims & Outcomes' },
  { slug: 'safety',      label: 'Safety' },
  { slug: 'plan',        label: 'Plan / Protocol' },
  { slug: 'progress',    label: 'Progress' },
  { slug: 'team',        label: 'Team' },
] as const

export type SectionSlug = (typeof SECTIONS)[number]['slug']
