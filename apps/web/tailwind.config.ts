import type { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('@natural-intelligence/design-tokens')

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors:                  tokens.tailwind.colors,
    fontFamily:              tokens.tailwind.fontFamily,
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

export default config
