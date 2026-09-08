import type { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require('@natural-intelligence/design-tokens/tailwind.base')

// ─── NI Brand System V1 — public-website palette (web app ONLY) ───────────────
// Overrides the shared design-token values for the public site: cream/parchment
// surfaces, deep pine as the brand anchor (CTAs, links, eyebrows), warm-white
// cards, sand dividers, and gold demoted to a rare accent. The care/admin apps
// consume the base package directly and are intentionally unaffected.
const ni = {
  cream:      '#F4ECDD',
  'warm-white': '#FBF7EF',
  sand:       '#E7DAC4',
  pine:       '#2E4636',
  botanical:  '#1E2F24',
  sage:       '#8AA07E',
  olive:      '#5E6B3F',
  gold:       '#B08A3E',
  'gold-tint': '#D9BE86',
  // V2 derived tokens — measured for WCAG AA on cream #F4ECDD (see handoff
  // RECONCILIATION.md §3): gold-ink is the ONLY gold permitted as text (≥18px
  // eyebrow-scale excepted per spec); gold/sage/border are decoration only.
  'gold-ink': '#7D6128',
  'gold-pale': '#E2D2AE',
  positive:   '#4A6B4F',
  ink:        '#26302A',
}

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  ...base,
  theme: {
    ...base.theme,
    colors: {
      ...base.theme.colors,
      // Raw brand palette (classes: bg-ni-cream, text-ni-pine, bg-ni-gold …)
      ni,
      // Brand anchor: pine green (was gold). Pale tints for pill/icon chips.
      brand: {
        ultra:   '#EFF3EC',
        light:   '#E6EEE3',
        muted:   '#CBDAC7',
        subtle:  '#DDE8DA',
        default: ni.pine,        // primary CTAs / accents
        hover:   ni.botanical,
        pressed: '#16241B',
      },
      // Cream-dominant surfaces with warm-white cards and sand sunken areas.
      surface: {
        ...base.theme.colors.surface,
        base:   ni.cream,
        raised: ni['warm-white'],
        sunken: ni.sand,
        muted:  '#EFE5D2',
      },
      // Sand-family borders (V2 measured values; decoration only, never text).
      border: {
        ...base.theme.colors.border,
        default: '#E0D4BE',
        muted:   ni.sand,
        strong:  '#C6B694',
      },
      // Ink text; brand text is pine. Secondary/muted are V2's MEASURED
      // AA-clearing values on cream (6.72:1 / 4.91:1) — the earlier estimates
      // failed AA and were corrected in the V2 reconciliation.
      text: {
        ...base.theme.colors.text,
        primary:     ni.ink,
        secondary:   '#4A544C',
        muted:       '#5F6862',
        placeholder: '#9AA096',
        inverted:    ni['warm-white'],
        brand:       ni.pine,
      },
      // Gold: rare accent, never a surface; gold TEXT uses gold-ink only.
      gold: {
        ...base.theme.colors.gold,
        ultra:   '#F2E8D3',
        default: ni.gold,
        mid:     ni['gold-tint'],
        ink:     ni['gold-ink'],
        pale:    ni['gold-pale'],
      },
    },
    boxShadow: {
      ...base.theme.boxShadow,
      // V2's two warm-tinted shadows — the only two the brand permits.
      sm:      '0 1px 3px rgba(38,48,42,0.06), 0 1px 2px rgba(38,48,42,0.04)',
      DEFAULT: '0 1px 3px rgba(38,48,42,0.06), 0 1px 2px rgba(38,48,42,0.04)',
      md:      '0 4px 14px rgba(38,48,42,0.08), 0 2px 5px rgba(38,48,42,0.05)',
    },
  },
}

export default config
