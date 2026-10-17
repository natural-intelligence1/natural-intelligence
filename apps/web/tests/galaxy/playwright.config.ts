import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  retries: 0,
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 },
    // headless CI machines usually have no GPU: SwiftShader gives WebGL in software
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
});
