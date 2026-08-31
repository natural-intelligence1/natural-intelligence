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
      // Sand-family borders.
      border: {
        ...base.theme.colors.border,
        default: '#DDCFB2',
        muted:   ni.sand,
        strong:  '#C6B28C',
      },
      // Ink text; brand text is pine (gold no longer the default accent text).
      text: {
        ...base.theme.colors.text,
        primary:     ni.ink,
        secondary:   '#4C574F',
        muted:       '#6E766E',
        placeholder: '#9AA096',
        inverted:    ni['warm-white'],
        brand:       ni.pine,
      },
      // Gold retained as a RARE accent, aligned to Brand System V1 values.
      gold: {
        ...base.theme.colors.gold,
        default: ni.gold,
        mid:     ni['gold-tint'],
      },
    },
  },
}

export default config
