import type { Config } from 'tailwindcss'
const tokens = require('@natural-intelligence/design-tokens')

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    colors:       tokens.tailwind.colors,
    fontFamily:   tokens.tailwind.fontFamily,
    fontSize:     tokens.tailwind.fontSize,
    fontWeight:   tokens.tailwind.fontWeight,
    spacing:      tokens.tailwind.spacing,
    borderRadius: tokens.tailwind.borderRadius,
    boxShadow:    tokens.tailwind.boxShadow,
    extend: {},
  },
  plugins: [],
}
export default config
