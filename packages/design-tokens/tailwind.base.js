/**
 * Natural Intelligence — Shared Tailwind Base Configuration
 *
 * All apps import and spread this object into their tailwind.config.ts.
 * App-specific `content` paths are added per-app — do not define them here.
 *
 * Fonts:
 *   Each layout loads its fonts via next/font/google and exposes CSS variables:
 *     --font-dm-sans   (web + admin + care)
 *     --font-display   (web only — Playfair Display)
 *     --font-mono      (web only — JetBrains Mono)
 *   The CSS variable is prepended here so next/font takes priority;
 *   the string fallback ('DM Sans' etc.) activates when the variable is absent.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('./tokens')

const baseConfig = {
  theme: {
    colors: tokens.tailwind.colors,
    fontFamily: {
      sans:    ['var(--font-dm-sans)',  ...tokens.tailwind.fontFamily.sans],
      display: ['var(--font-display)',  ...tokens.tailwind.fontFamily.display],
      mono:    ['var(--font-mono)',     ...tokens.tailwind.fontFamily.mono],
    },
    fontSize:                tokens.tailwind.fontSize,
    fontWeight:              tokens.tailwind.fontWeight,
    spacing:                 tokens.tailwind.spacing,
    borderRadius:            tokens.tailwind.borderRadius,
    boxShadow:               tokens.tailwind.boxShadow,
    transitionDuration:      tokens.tailwind.transitionDuration,
    transitionTimingFunction:tokens.tailwind.transitionTimingFunction,
    zIndex:                  tokens.tailwind.zIndex,
    opacity:                 tokens.tailwind.opacity,
    extend: {},
  },
  plugins: [],
}

module.exports = baseConfig
