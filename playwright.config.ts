import { defineConfig } from '@playwright/test'

// Electron end-to-end smoke tests. These launch the built app, so run
// `electron-vite build` first (the `test:e2e` script does this for you).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']]
})
