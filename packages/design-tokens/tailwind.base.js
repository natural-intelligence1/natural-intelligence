/**
 * Natural Intelligence — Shared Tailwind Base Configuration
 *
 * All apps import and spread this object into their tailwind.config.ts.
 * App-specific `content` paths are added per-app — do not define them here.
 *
 * Font: Inter is loaded via next/font/google in each app layout, which
 * exposes the CSS variable --font-inter. The fontFamily override here
 * prepends that variable so next/font takes priority, with the string
 * 'Inter' as a graceful fallback if the variable is unavailable.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('./tokens')

const baseConfig = {
  theme: {
    colors: tokens.tailwind.colors,
    fontFamily: {
      ...tokens.tailwind.fontFamily,
      // Prepend CSS variable from next/font; 'Inter' string is the fallback
      sans: ['var(--font-inter)', ...tokens.tailwind.fontFamily.sans],
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
