// UI e2e tests: the web view in Chromium, against `./skill-atlas serve`. `npm run e2e`, in the image of
// tests/e2e/Dockerfile (scripts/e2e.sh), in the cloud and on CI alike.
// Every test is recorded; `DEMO=docs/demo npm run e2e` also keeps each video there (tests/e2e/demo.ts).
// Screenshots of the key moments (demo.screenshot) must match tests/e2e/screenshots/ to the pixel;
// `npm run e2e -- --update-snapshots` draws them again.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  // On CI, also an HTML report: a failed screenshot side by side with its baseline, and the difference.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: 'tests/e2e/screenshots/{testFileName}/{arg}{ext}',
  expect: {
    // One changed pixel fails.
    toHaveScreenshot: { maxDiffPixels: 0, threshold: 0, animations: 'disabled', caret: 'hide' },
  },
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
