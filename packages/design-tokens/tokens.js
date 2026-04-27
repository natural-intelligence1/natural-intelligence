/**
 * Natural Intelligence — Design Token System
 *
 * Cardinal Rule: every value used in the UI traces back to this file.
 * No raw hex, no raw px, no inline font strings anywhere in components.
 * Import this file into tailwind.config.ts and extend from it.
 */

// ─── Primitive palette ────────────────────────────────────────────────────────

const sage = {
  25:  '#f6faf7',
  50:  '#ecf5ee',
  100: '#d1e8d5',
  200: '#a5d1ac',
  300: '#6db47a',
  400: '#469754',
  500: '#347d41',   // primary action
  600: '#286433',
  700: '#1e4d27',
  800: '#14361b',
  900: '#0a1f0f',
}

const warm = {
  0:   '#ffffff',
  25:  '#fafaf8',   // page background
  50:  '#f4f3ef',   // surface
  100: '#eceae5',   // muted surface
  200: '#dedad3',   // border default
  300: '#c8c4bb',   // border strong
  400: '#a09b91',   // text placeholder
  500: '#7a7570',   // text muted
  600: '#5c5852',   // text secondary
  700: '#3f3c37',   // text primary-light
  800: '#28261f',   // text primary
  900: '#131109',   // text inverted-bg
}

const status = {
  successBg:    '#f0faf2',
  successText:  '#1d5e2a',
  successBorder:'#a5d1ac',
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

const fontFamily = {
  sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
  sm:   '0.375rem',
  md:   '0.5rem',
  lg:   '0.75rem',
  xl:   '1rem',
  '2xl':'1.5rem',
  '3xl':'2rem',
  full: '9999px',
}

// ─── Shadows ──────────────────────────────────────────────────────────────────

const boxShadow = {
  none: 'none',
  xs:   '0 1px 2px 0 rgba(19, 17, 9, 0.05)',
  sm:   '0 1px 3px 0 rgba(19, 17, 9, 0.08), 0 1px 2px -1px rgba(19, 17, 9, 0.06)',
  md:   '0 4px 6px -1px rgba(19, 17, 9, 0.08), 0 2px 4px -2px rgba(19, 17, 9, 0.06)',
  lg:   '0 10px 15px -3px rgba(19, 17, 9, 0.08), 0 4px 6px -4px rgba(19, 17, 9, 0.05)',
  xl:   '0 20px 25px -5px rgba(19, 17, 9, 0.08), 0 8px 10px -6px rgba(19, 17, 9, 0.05)',
  '2xl':'0 25px 50px -12px rgba(19, 17, 9, 0.18)',
  inner:'inset 0 2px 4px 0 rgba(19, 17, 9, 0.06)',
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
      // Semantic aliases used in components
      brand: {
        light:   sage[50],
        muted:   sage[100],
        subtle:  sage[200],
        default: sage[500],
        hover:   sage[600],
        pressed: sage[700],
        text:    sage[600],
      },
      surface: {
        base:             warm[25],
        raised:           warm[0],
        sunken:           warm[50],
        muted:            warm[100],
        // Inverse surfaces — admin dark shell (architecturally intentional)
        inverse:          warm[900],  // main dark shell background
        'inverse-raised': warm[800],  // elevated dark: active nav, hover state
      },
      border: {
        default: warm[200],
        muted:   warm[100],
        strong:  warm[300],
        inverse: warm[700],           // border on dark inverse surfaces
      },
      text: {
        primary:      warm[800],
        secondary:    warm[600],
        muted:        warm[500],
        placeholder:  warm[400],
        inverted:     warm[0],        // white — primary text on dark surfaces
        brand:        sage[600],
        'on-inverse': warm[400],      // secondary/muted text on dark surfaces
      },
      overlay: {
        scrim: 'rgba(17,17,17,0.5)',  // modal backdrop — warm-tinted, not pure black
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
