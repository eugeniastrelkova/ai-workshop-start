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
in Chromium against `./skill-atlas serve` on port 4321, which the config starts. `npm run e2e` runs
them in a Docker image, [tests/e2e/Dockerfile](../../../tests/e2e/Dockerfile), through
[scripts/e2e.sh](../../../scripts/e2e.sh): in the cloud and on CI the same Linux, fonts and Chromium,
the checkout always at `/skill-atlas`. Every test is recorded (`video: 'on'`); each one is a demo
and a test at once:

- **Assertions** on what a user sees, as in `tests/web.test.ts`: the heading text
  (`fixture · 3 of 4 skills`), the skill names, the URL. A test that does not assert is not a demo.
- **Pace**, from `test` and `demo` in [tests/e2e/demo.ts](../../../tests/e2e/demo.ts):
  `demo.caption('…')` (a bar at the bottom saying what is shown; it stays across a submit),
  `demo.type(selector, text)` (key by key, at the end of the field), `demo.pause(ms)` (time to
  read; about 1.5 s after each result).
- **Screenshots** of the key moments: `demo.screenshot('words-commit')`, after the assertion,
  against `tests/e2e/screenshots/<file>/<name>.png`. One changed pixel fails (see Screenshots).
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
```

and Docker. The first `npm run e2e` builds the image (a few minutes), tagged with the Playwright,
Chromium and ffmpeg versions of `node_modules/playwright-core/browsers.json` and a hash of the
Dockerfile: a Playwright update or an edit to the Dockerfile builds it again. Its two `FROM` bases
are pinned by digest and its packages come from one Ubuntu snapshot (`APT::Snapshot`), so a rebuild
gives the same image until someone changes a digest or the snapshot date on purpose.
Chromium comes straight from Chrome for Testing, which the Playwright CDN mirrors (the CDN is
blocked in some clouds: `403 Blocked by network policy`); ffmpeg, from Ubuntu.

## Record

```console
DEMO=docs/demo npm run e2e                     # all of them
DEMO=docs/demo npm run e2e -- filter.spec.ts   # one
```

- `DEMO=<directory>`: each **passing** test's video saved there as `<title>.webm`. A failing
  test saves none there; its video and a trace of the error stay in `test-results/`, to see why.
- Without `DEMO`, the videos stay in `test-results/` only (ignored by git).
- A test on real GitHub asks it anonymously, as `scan` does: 60 requests an hour. An organization
  scan can run out of them; wait for the hour, the message on the page says until when.
- Behind an HTTP proxy, Node's `fetch` needs `NODE_USE_ENV_PROXY=1`; the config sets it for the
  server. `EAI_AGAIN` in the page means that is missing.
- On CI, the `e2e` job of `.github/workflows/ci.yml` runs `npm run e2e` on every push and pull
  request and keeps the recordings, pass or fail: the `e2e-recordings` artifact of the run
  (`test-results/`: each test's video, and of a failure its trace and screenshot diffs;
  `playwright-report/`: the HTML report). `gh run download <run-id> -n e2e-recordings`.
  `org.spec.ts` is skipped there: on real GitHub, anonymously, the runner's 60 requests an hour are
  shared with every other job on its address.

## Screenshots

`demo.screenshot(name)` compares the page with its baseline to the pixel (`maxDiffPixels: 0`,
`threshold: 0`, in [playwright.config.ts](../../../playwright.config.ts)). The baselines are drawn in
the cloud, in the image, the same one CI runs:

```console
npm run e2e -- filter.spec.ts --update-snapshots
```

Look at each new or changed PNG in `tests/e2e/screenshots/` before committing it: it is what the
check will hold the page to. A change to the page needs new baselines in the same pull request.
Only pages that stay the same from run to run: a fixture, not real GitHub (`org.spec.ts` has none).
A failure on CI: the expected, actual and diff PNGs are in the `e2e-recordings` artifact.

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
