// UI e2e tests: the web view in Chromium, against `./skill-atlas serve`. `npm run e2e`.
// Every test is recorded; `DEMO=docs/demo npm run e2e` also keeps each video there (tests/e2e/demo.ts).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
  },
  webServer: {
    command: './skill-atlas serve --port 4321',
    url: 'http://127.0.0.1:4321/',
    reuseExistingServer: false,
    // Node's fetch goes through HTTPS_PROXY only when asked to; without a proxy, nothing changes.
    env: { NODE_USE_ENV_PROXY: '1' },
  },
});
