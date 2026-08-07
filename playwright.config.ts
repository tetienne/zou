import { defineConfig, devices } from '@playwright/test';

// These tests drive the built site, not the dev server: the worker URL and the
// `.wasm` path are rewritten at build time, and getting them wrong is exactly
// the kind of breakage a browser test is here to catch.
// GitHub Pages serves the site under /<repository-name>/, so the tests build and
// serve it under a sub-path too: a worker URL or a `.wasm` path that only
// resolves at the root would pass at the root and break once deployed.
const BASE = '/zou/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    // Trailing slash and page names without a leading one: `goto('photos.html')`
    // has to resolve inside the sub-path, not next to it.
    baseURL: `http://127.0.0.1:4173${BASE}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `--host 127.0.0.1` rather than the default `localhost`, which resolves to
    // ::1 first on some machines while Playwright polls the v4 address.
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_BASE: BASE },
    // Without this, a server that fails to come up says nothing at all.
    stdout: 'pipe',
    stderr: 'pipe',
    url: `http://127.0.0.1:4173${BASE}index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
