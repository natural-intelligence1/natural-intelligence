import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include:     ['scripts/**/*.ts'],
    environment: 'node',
    testTimeout: 30_000,  // real network calls need more time
  },
})
