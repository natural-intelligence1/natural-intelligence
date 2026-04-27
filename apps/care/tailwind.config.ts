import type { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require('@natural-intelligence/design-tokens/tailwind.base')

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  ...base,
}

export default config
