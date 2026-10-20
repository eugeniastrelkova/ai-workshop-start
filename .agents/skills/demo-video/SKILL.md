---
name: demo-video
description: How to record a demo video of Skill Atlas for a pull request — the UI e2e tests in tests/e2e/ (Playwright, the web view) record themselves; keep the videos of the ones that show the change in docs/demo/.
---

# Demo video

A pull request that changes what a user sees gets a short video of it working, in
[docs/demo/](../../../docs/demo/README.md), linked in the pull request body. The video is not
filmed by hand: it is a **UI e2e test** recording itself. Only the UI e2e tests are recorded, never
the terminal; a change to what `scan` prints is shown through the page, which prints the same.

## The UI e2e tests

[tests/e2e/](../../../tests/e2e/), run by Playwright ([playwright.config.ts](../../../playwright.config.ts))
in Chromium against `./skill-atlas serve` on port 4321, which the config starts. Every test is
recorded (`video: 'on'`); each one is a demo and a test at once:

- **Assertions** on what a user sees, as in `tests/web.test.ts`: the heading text
  (`fixture · 3 of 4 skills`), the skill names, the URL. A test that does not assert is not a demo.
- **Pace**, from `test` and `demo` in [tests/e2e/demo.ts](../../../tests/e2e/demo.ts):
  `demo.caption('…')` (a bar at the bottom saying what is shown; it stays across a submit),
  `demo.type(selector, text)` (key by key, at the end of the field), `demo.pause(ms)` (time to
  read; about 1.5 s after each result).
- One test, one video, under about 30 s. The **title** is the file name: `filter by words` →
  `docs/demo/filter-by-words.webm`.

| Test | Shows |
| --- | --- |
| `filter.spec.ts` › `filter by words` | `./fixture`: 4 skills, then `commit` (3 of 4), `commit kotlin` (2 of 4), one SKILL.md unfolded |
| `org.spec.ts` › `organization scan` | JetBrains, each repository with skills, then filtered by `kotlin` |

For a new change, extend the test that covers it or add one beside them.

## Once per machine

```console
npm ci
npx playwright install chromium
```

Where the Playwright CDN is blocked (`403 Blocked by network policy`), install the same build by
hand. The revision and version are in `node_modules/playwright-core/browsers.json`
(`chromium` 1248 = 156.0.8078.4, `ffmpeg` 1013 here):

```console
C=~/.cache/ms-playwright B=https://storage.googleapis.com/chrome-for-testing-public/156.0.8078.4/linux64
curl -fsSLo /tmp/chrome.zip $B/chrome-linux64.zip && python3 -m zipfile -e /tmp/chrome.zip $C/chromium-1248
curl -fsSLo /tmp/shell.zip $B/chrome-headless-shell-linux64.zip && python3 -m zipfile -e /tmp/shell.zip $C/chromium_headless_shell-1248
sudo apt-get install -y ffmpeg && mkdir -p $C/ffmpeg-1013 && ln -sf /usr/bin/ffmpeg $C/ffmpeg-1013/ffmpeg-linux
chmod -R +x $C/chromium-1248 $C/chromium_headless_shell-1248
touch $C/chromium-1248/INSTALLATION_COMPLETE $C/chromium_headless_shell-1248/INSTALLATION_COMPLETE $C/ffmpeg-1013/INSTALLATION_COMPLETE
sudo env PATH="$PATH" npx playwright install-deps chromium      # the libraries Chromium needs
```

## Record

```console
GITHUB_TOKEN=$(gh auth token) DEMO=docs/demo npm run e2e                     # all of them
GITHUB_TOKEN=$(gh auth token) DEMO=docs/demo npm run e2e -- filter.spec.ts   # one
```

- `DEMO=<directory>`: each **passing** test's video saved there as `<title>.webm`. A failing
  test saves none there; its video and a trace of the error stay in `test-results/`, to see why.
- Without `DEMO`, the videos stay in `test-results/` only (ignored by git).
- `GITHUB_TOKEN` for a test on real GitHub: an organization scan without it lists every repository
  and runs out of the 60 requests an hour.
- Behind an HTTP proxy, Node's `fetch` needs `NODE_USE_ENV_PROXY=1`; the config sets it for the
  server. `EAI_AGAIN` in the page means that is missing.
- Not in CI, for now: CI runs `npm test`, not `npm run e2e`.

## Check it, then link it

Do not link a video you have not looked at. Take a few frames and look at each one:

```console
ffprobe -v error -show_entries format=duration -of csv=p=0 docs/demo/<name>.webm
ffmpeg -v error -ss 5 -i docs/demo/<name>.webm -frames:v 1 /tmp/frame-5.png
ffmpeg -v error -sseof -1 -i docs/demo/<name>.webm -frames:v 1 /tmp/frame-end.png
```

Commit only the videos the change needs, and add a line for each to
[docs/demo/README.md](../../../docs/demo/README.md). In the pull request body, link the file on the
branch: `https://github.com/<owner>/<repo>/blob/<branch>/docs/demo/<name>.webm`.

## On real GitHub

The counts move from one run to the next (JetBrains: `104 skills`, then `92`, then `103`): assert
on the shape, `/^JetBrains · \d+ skills in \d+ repositories$/`, and on a repository that stays, not
on a number. Wait for it with `{ timeout: 60_000 }`: an organization takes 10–20 s.
