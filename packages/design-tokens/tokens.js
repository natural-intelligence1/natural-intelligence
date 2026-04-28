/**
 * Natural Intelligence — Design Token System  (v5)
 *
 * Cardinal Rule: every value used in the UI traces back to this file.
 * No raw hex, no raw px, no inline font strings anywhere in components.
 * Import this file into tailwind.config.ts and extend from it.
 */

// ─── Primitive palette ────────────────────────────────────────────────────────

const sage = {
  25:  '#EAF2EC',
  50:  '#E8F2EB',   // sage bg
  100: '#C5DECA',
  200: '#9DC6A5',
  300: '#6B9878',   // sage mid — hover states
  400: '#5A8A66',
  500: '#4E7A5C',   // sage default — success / vetted
  600: '#3D6349',
  700: '#2C4B37',
  800: '#1C3324',
  900: '#0E1F14',
}

const warm = {
  0:   '#FDFCFA',   // rare inner card (near-white — not pure white)
  25:  '#F8F6F2',   // page background — warm parchment
  50:  '#F2EFE9',   // card background — cream
  100: '#EAE6DE',   // muted surface
  200: '#DDD9D1',   // border default
  300: '#C4BFB6',   // border strong / hover borders
  400: '#A09B91',   // text placeholder
  500: '#8A8880',   // text muted
  600: '#4A4945',   // text secondary — prose
  700: '#2A2825',   // dark border (inverse surfaces)
  800: '#1A1917',   // dark card (inverse raised surfaces / sidebar hover)
  900: '#0E0D0B',   // obsidian — dark shell bg and primary ink
}

// ─── Gold ─────────────────────────────────────────────────────────────────────
// Brand accent. Use sparingly — one element per section maximum.

const gold = {
  ultra:   '#F8F1E4',   // eyebrow pill backgrounds — very pale tint
  light:   '#EDD8B4',   // soft gold backgrounds
  mid:     '#D4B07A',   // medium gold
  default: '#B8935A',   // primary gold accent
  dark:    '#C8A45C',   // gold dark — used in intelligence layer
}

const status = {
  successBg:    '#E8F2EB',
  successText:  '#2C4B37',
  successBorder:'#9DC6A5',
  warningBg:    '#fefaf0',
  warningText:  '#854d0e',
  warningBorder:'#fde68a',
  errorBg:      '#fff5f5',
  errorText:    '#9b1c1c',
  errorBorder:  '#fca5a5',
  infoBg:       '#f0f7ff',
  infoText:     '#1e4070',
  infoBorder:   '#bfdbfe',
  // Danger = error aliases — for destructive action UI (delete / remove).
  // System error states use error*; destructive button/badge states use danger*.
  // The values are identical; the names carry different semantic intent.
  dangerBg:     '#fff5f5',
  dangerText:   '#9b1c1c',
  dangerBorder: '#fca5a5',
}

// ─── Typography ───────────────────────────────────────────────────────────────

// CSS variable references are prepended in tailwind.base.js so next/font takes priority.
// The string values here serve as fallbacks if the variable is unavailable.
const fontFamily = {
  sans:    ['DM Sans',              'system-ui', 'sans-serif'],
  display: ['Cormorant Garamond',   'Georgia',   'serif'],      // v5: editorial serif
  mono:    ['JetBrains Mono',       'ui-monospace', 'SFMono-Regular', 'monospace'],
}

const fontSize = {
  '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }],
  xs:    ['0.75rem',  { lineHeight: '1rem',      letterSpacing: '0.01em' }],
  sm:    ['0.875rem', { lineHeight: '1.25rem',   letterSpacing: '0em'   }],
  base:  ['1rem',     { lineHeight: '1.5rem',    letterSpacing: '0em'   }],
  lg:    ['1.125rem', { lineHeight: '1.75rem',   letterSpacing: '-0.01em' }],
  xl:    ['1.25rem',  { lineHeight: '1.75rem',   letterSpacing: '-0.01em' }],
  '2xl': ['1.5rem',   { lineHeight: '2rem',      letterSpacing: '-0.02em' }],
  '3xl': ['1.875rem', { lineHeight: '2.25rem',   letterSpacing: '-0.02em' }],
  '4xl': ['2.25rem',  { lineHeight: '2.5rem',    letterSpacing: '-0.03em' }],
  '5xl': ['3rem',     { lineHeight: '1.1',       letterSpacing: '-0.03em' }],
  '6xl': ['3.75rem',  { lineHeight: '1.05',      letterSpacing: '-0.04em' }],
}

const fontWeight = {
  light:    '300',
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
}

// ─── Spacing ──────────────────────────────────────────────────────────────────

const spacing = {
  px:    '1px',
  0:     '0',
  0.5:   '0.125rem',
  1:     '0.25rem',
  1.5:   '0.375rem',
  2:     '0.5rem',
  2.5:   '0.625rem',
  3:     '0.75rem',
  3.5:   '0.875rem',
  4:     '1rem',
  5:     '1.25rem',
  6:     '1.5rem',
  7:     '1.75rem',
  8:     '2rem',
  9:     '2.25rem',
  10:    '2.5rem',
  11:    '2.75rem',
  12:    '3rem',
  14:    '3.5rem',
  16:    '4rem',
  18:    '4.5rem',
  20:    '5rem',
  24:    '6rem',
  28:    '7rem',
  32:    '8rem',
  36:    '9rem',
  40:    '10rem',
  44:    '11rem',
  48:    '12rem',
  56:    '14rem',
  64:    '16rem',
  72:    '18rem',
  80:    '20rem',
  96:    '24rem',
}

// ─── Border radius ────────────────────────────────────────────────────────────

const borderRadius = {
  none: '0',
  xs:   '0.1875rem',
  sm:   '0.375rem',    // tags & pills — 6px
  md:   '0.5rem',      // buttons & inputs — 8px
  lg:   '0.75rem',     // standard cards — 12px
  xl:   '1rem',        // featured cards — 16px
  '2xl':'1.5rem',
  '3xl':'2rem',
  full: '9999px',      // avatars & full pills
}

// ─── Shadows — warm-tinted (v5: rgba(14,13,11,...)) ──────────────────────────

const boxShadow = {
  none: 'none',
  xs:   '0 1px 2px 0 rgba(14, 13, 11, 0.05)',
  sm:   '0 1px 3px 0 rgba(14, 13, 11, 0.07), 0 1px 2px -1px rgba(14, 13, 11, 0.05)',
  md:   '0 4px 6px -1px rgba(14, 13, 11, 0.08), 0 2px 4px -2px rgba(14, 13, 11, 0.06)',
  lg:   '0 10px 15px -3px rgba(14, 13, 11, 0.08), 0 4px 6px -4px rgba(14, 13, 11, 0.05)',
  xl:   '0 20px 25px -5px rgba(14, 13, 11, 0.08), 0 8px 10px -6px rgba(14, 13, 11, 0.05)',
  '2xl':'0 25px 50px -12px rgba(14, 13, 11, 0.18)',
  inner:'inset 0 2px 4px 0 rgba(14, 13, 11, 0.06)',
  // Semantic aliases — use these in components
  card:     '0 1px 4px rgba(14, 13, 11, 0.07), 0 1px 2px rgba(14, 13, 11, 0.05)',
  elevated: '0 8px 32px rgba(14, 13, 11, 0.12), 0 2px 8px rgba(14, 13, 11, 0.07)',
}

// ─── Transitions ──────────────────────────────────────────────────────────────

const transitionDuration = {
  fast:    '100ms',
  base:    '150ms',
  slow:    '250ms',
  slower:  '350ms',
}

const transitionTimingFunction = {
  base:    'cubic-bezier(0.4, 0, 0.2, 1)',
  in:      'cubic-bezier(0.4, 0, 1, 1)',
  out:     'cubic-bezier(0, 0, 0.2, 1)',
  spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

// ─── Z-index ──────────────────────────────────────────────────────────────────

const zIndex = {
  base:    '0',
  raised:  '10',
  overlay: '20',
  modal:   '30',
  popover: '40',
  toast:   '50',
  nav:     '60',
}

// ─── Opacity ──────────────────────────────────────────────────────────────────

const opacity = {
  0:    '0',
  5:    '0.05',
  10:   '0.10',
  20:   '0.20',
  30:   '0.30',
  40:   '0.40',
  50:   '0.50',
  60:   '0.60',
  70:   '0.70',
  80:   '0.80',
  90:   '0.90',
  95:   '0.95',
  100:  '1',
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  sage,
  warm,
  gold,
  status,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  boxShadow,
  transitionDuration,
  transitionTimingFunction,
  zIndex,
  opacity,

  // Tailwind-ready theme extension
  tailwind: {
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      white:       warm[0],
      black:       warm[900],
      sage,
      warm,
      gold,
      // Semantic aliases used in components.
      // Note: brand.text has been REMOVED — use text.brand (class: text-text-brand) instead.
      // See DD-001 in DESIGN_DECISIONS.md.
      brand: {
        ultra:   gold.ultra,     // eyebrow pill bg tint
        light:   gold.ultra,     // backward compat alias
        muted:   gold.light,
        subtle:  gold.mid,
        default: gold.default,   // primary gold accent (v5: #B8935A)
        hover:   gold.dark,
        pressed: '#9E7A42',
      },
      surface: {
        base:             warm[25],   // #F8F6F2
        raised:           warm[50],   // #F2EFE9  (cards)
        sunken:           warm[100],  // #EAE6DE
        muted:            warm[100],
        // Inverse surfaces — dark shell
        inverse:          warm[900],  // #0E0D0B  obsidian shell bg (sidebar.bg)
        dark:             warm[800],  // #1A1917  dark card (sidebar.bgHover)
        'inverse-raised': warm[800],  // alias — kept for backward compat
      },
      border: {
        default: warm[200],   // #DDD9D1
        muted:   warm[100],
        strong:  warm[300],   // #C4BFB6
        inverse: warm[700],   // #2A2825  border on dark surfaces
      },
      text: {
        primary:      warm[900],      // #0E0D0B  — obsidian ink (v5)
        secondary:    warm[600],      // #4A4945  — prose
        muted:        warm[500],      // #8A8880
        placeholder:  warm[400],      // #A09B91
        inverted:     warm[0],        // #FDFCFA  — text on dark surfaces
        brand:        gold.default,   // #B8935A  — gold accent text (v5)
        'on-inverse': warm[500],      // #8A8880  — muted text on dark surfaces
      },
      overlay: {
        scrim: 'rgba(14,13,11,0.5)',  // modal backdrop — warm obsidian tint (v5)
      },
      // Sidebar tokens — semantic names for admin dark shell chrome.
      sidebar: {
        bg:          warm[900],   // #0E0D0B  main sidebar background
        bgHover:     warm[800],   // #1A1917  active link / hover state
        border:      warm[800],   // #1A1917  divider lines
        text:        warm[100],   // #EAE6DE  primary nav text
        textMuted:   warm[400],   // #A09B91  secondary / inactive nav text
        textActive:  sage[300],   // #6B9878  active / selected link highlight
      },
      status,
    },
    fontFamily,
    fontSize,
    fontWeight,
    spacing,
    borderRadius,
    boxShadow,
    transitionDuration: {
      DEFAULT: transitionDuration.base,
      fast:    transitionDuration.fast,
      slow:    transitionDuration.slow,
      slower:  transitionDuration.slower,
    },
    transitionTimingFunction: {
      DEFAULT: transitionTimingFunction.base,
      in:      transitionTimingFunction.in,
      out:     transitionTimingFunction.out,
      spring:  transitionTimingFunction.spring,
    },
    zIndex,
    opacity,
  },
}
