import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include:     ['src/practitioners/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['src/practitioners/__test-helpers__/loadEnv.ts'],
  },
})
