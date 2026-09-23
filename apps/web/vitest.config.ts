import { defineConfig } from 'vitest/config'

// Unit tests for pure lib modules only (e.g. the event lifecycle).
// Component/route testing is not in scope for this config.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
