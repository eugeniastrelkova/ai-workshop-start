---
name: red-agent
description: How to attack the Skill Atlas web view as a tester — spec/web.md case by case, then exploratory — and file one GitHub issue per bug it reproduces, labelled "Delegated to AI", with the steps and a video attached.
---

# Red agent

The other skills build ([issue-to-pr](../issue-to-pr/SKILL.md)); this one breaks. It tests **the web
view only** — `./skill-atlas serve`, the page at `http://127.0.0.1:4321/` — and for each bug it
can reproduce, opens **one issue**: labelled `Delegated to AI`, with the steps and a video of the
bug, attached to the issue. Those issues are what `issue-to-pr` picks up next.

Nothing from a run is merged: work on a scratch branch, `git switch -c red-agent/<yyyy-mm-dd>`,
and never commit to `main`.

## What is a bug

- The page contradicting [spec/web.md](../../../spec/web.md), or the parts of
  [spec/analysis.md](../../../spec/analysis.md) and [spec/cli.md](../../../spec/cli.md) it shows (the
  counts, the order, the filter, `also in`, the warnings, the messages).
- Where the spec is silent, something clearly broken: a status 500, a stack trace on the page, a
  hang, a skill lost, text from a SKILL.md rendered as HTML, a field that loses what was typed, a
  shared link that does not give the same page.

Not a bug: what [code-review](../code-review/SKILL.md) already lists as on purpose (`sortSkills`
with `<`/`>`, `Skill.copies` never filled in, a warning rather than an error on malformed front
matter), styling, wording, a missing feature, anything only `scan` shows (an exit code, stderr).

A bug is reported only once it **reproduces twice** from a fresh server. Prefer local directories
(`./fixture`, a temp directory) to real GitHub: it is asked anonymously, 60 requests an hour.

## Hunt

```console
npm ci
./skill-atlas serve &                                   # http://127.0.0.1:4321/
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:4321/?repo=./fixture&words=commit'
curl -s 'http://127.0.0.1:4321/?repo=./fixture' | grep -o '<h2>[^<]*</h2>'
```

First the **spec pass**: every bullet of `spec/web.md` — the two fields, the submitted URL, the
heading `N skills` / `N of M skills`, the order, the first sentence, the link, `also in`, the folded
SKILL.md, the warnings, status 400 with `scan`'s message, 404 for any other path, `--port`, listening
on 127.0.0.1 only.

Then **exploratory**, with temp directories built for the case:

- Repositories: a symlinked `SKILL.md`, one under `node_modules` or `.git`, copies in two agents'
  folders, empty or garbage front matter, no description, a name in unicode or 300 characters long,
  spaces and `#`, `&`, `%` in a path, a description of `<script>` or `<b>`.
- Fields: empty, only spaces, regex characters (`.*`, `(`), mixed case, many words, a word
  repeated; the repo field with a trailing slash, `.git`, `/tree/main`, a file instead of a
  directory, `~`.
- URLs: `repo` or `words` missing, given twice, percent-encoded oddly; the back button after a
  submit; a shared link opened in a new page.

Keep a list as you go: a slug (`words-regex-crash`), a one-line title, the shortest steps, the
expected (the spec line it breaks, quoted), the actual (exact text, status code).

## Already filed?

```console
gh issue list --state all --label "Delegated to AI" --search "<keywords> in:title,body" --limit 50
gh issue list --state all --search "atlas:red-agent <slug> in:body"
```

A bug with an open issue, or a closed one that does not hold anymore, gets no new issue. Bugs with
one cause are one issue: list both steps in it.

## A video, one per bug

The video is a **UI e2e test recording itself**, as in [demo-video](../demo-video/SKILL.md): a repro
test, `tests/e2e/red-<slug>.spec.ts`, beside [filter.spec.ts](../../../tests/e2e/filter.spec.ts) and
written like it — `test`, `demo.caption`, `demo.type`, `demo.pause` from
[demo.ts](../../../tests/e2e/demo.ts). It asserts what **the spec says** and is marked
`test.fail()`: the bug makes it fail as expected, so the run passes and `demo.ts` keeps the video.
No `demo.screenshot` — there is no baseline for a bug.

```ts
// Bug: <title>. spec/web.md: "<the line it breaks>"
import { expect, test } from './demo.ts';

test('red <slug>', async ({ page, demo }) => {
  test.fail(); // passes once the bug is fixed: then drop this line and keep the test
  await page.goto('/');
  await demo.caption('<what the user does>');
  await demo.type('input[name=repo]', './fixture');
  await demo.type('input[name=words]', '<words>');
  await page.keyboard.press('Enter');
  await demo.pause();
  await demo.caption('Expected: <the spec> — but <what happens>');
  await demo.pause(2500);
  await expect(page.locator('h2').first()).toHaveText('<what the spec says>');
});
```

Pause and caption **before** the failing assertion: the test ends at it, and so does the video.

```console
DEMO=test-results/red-agent npm run e2e -- red-<slug>.spec.ts   # → test-results/red-agent/red-<slug>.webm
```

A temp directory for a case must be inside the checkout (the image sees only `/skill-atlas`):
`test-results/red-agent/repos/<slug>/`, ignored by git, typed into the field as
`./test-results/red-agent/repos/<slug>`.

If the run fails instead (`1 failed`, "Expected to fail, but passed"), the test does not show the
bug: fix the test, not the expectation. Then look at the video before using it, as demo-video's
"Check it" says: the length (under about 30 s, under 10 MB), a frame at 2 s and the last one, and
look at each: the caption and the bug on screen. `ffmpeg` may be only in the image:

```console
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/w" -w /w "$(scripts/e2e.sh --tag)" sh -c '
  v=test-results/red-agent/red-<slug>.webm
  ffprobe -v error -show_entries format=duration -of csv=p=0 $v
  ffmpeg -v error -y -ss 2 -i $v -frames:v 1 test-results/red-agent/<slug>-2s.png
  ffmpeg -v error -y -sseof -1 -i $v -frames:v 1 test-results/red-agent/<slug>-end.png'
```

## File the issue

One issue per bug, from a body file:

````markdown
<one sentence: what goes wrong, on the page>

### Steps
1. `./skill-atlas serve`
2. Open http://127.0.0.1:4321/?repo=./fixture&words=%28
3. …

### Expected
<what should be shown>, as [spec/web.md](../blob/main/spec/web.md) says: "<the line>"

### Actual
<exact text on the page, the status code>

### Environment
Commit `<git rev-parse --short HEAD>`, Node `<node -v>`, Chromium in the e2e image.

### Video
<!-- attached below -->

<details><summary>Repro test: <code>tests/e2e/red-&lt;slug&gt;.spec.ts</code></summary>

```ts
<the test above, as it ran>
```
</details>

<!-- atlas:red-agent <slug> -->
````

```console
gh issue create --label "Delegated to AI" --label bug \
  --title "<page: what goes wrong>" --body-file test-results/red-agent/<slug>.md
```

The repro test goes in the body so that `issue-to-pr` can drop it into `tests/e2e/` as the first
failing test; the `atlas:red-agent` marker is how a later run knows it is filed.

## Attach the video

GitHub has no API for attachments: only the editor on github.com uploads one, to
`https://github.com/user-attachments/assets/<id>`, for a logged-in user. So the attachment goes
through the browser, in the e2e image, with a session the user saved once:

```console
npx playwright codegen github.com/login --save-storage="$HOME/.github-session.json"   # log in, close
export GITHUB_STORAGE_STATE="$HOME/.github-session.json"
```

That file is a login: never commit it, never print it, never copy it into the checkout for longer
than the run below.

```console
cat > test-results/red-agent/attach.mjs <<'EOF'
// node attach.mjs <issue URL> <video.webm>: a comment on the issue with the video attached.
import { chromium } from '@playwright/test';
const [url, video] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ storageState: '/session.json' });
await page.goto(url);
const box = page.locator('textarea').last();
await box.click();
await page.locator('input[type=file]').last().setInputFiles(video);
await page.waitForFunction(
  (el) => /user-attachments\/assets\//.test(el.value) && !/Uploading/.test(el.value),
  await box.elementHandle(), { timeout: 120_000 });
await box.evaluate((el) => (el.value = 'Video of the bug:\n\n' + el.value));
await box.dispatchEvent('input');
await page.getByRole('button', { name: /^comment$/i }).last().click();
await page.waitForLoadState('networkidle');
await browser.close();
EOF
docker run --rm --init --ipc=host --network host -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/skill-atlas" -w /skill-atlas -v "$GITHUB_STORAGE_STATE:/session.json:ro" \
  -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY -e https_proxy -e http_proxy -e no_proxy \
  "$(scripts/e2e.sh --tag)" node test-results/red-agent/attach.mjs <issue URL> test-results/red-agent/red-<slug>.webm
gh issue view <number> --comments | grep -o 'https://github.com/user-attachments/assets/[^ )"]*'
```

It is done when the last line prints the asset URL. GitHub's markup changes: if a locator misses,
take `page.screenshot()` of the issue, look at it, and fix the locator, not the check.

No `GITHUB_STORAGE_STATE`, or the session logged out (the page shows "Sign in"): leave the issue
without a video, do not link one from elsewhere instead, and say so in the report with the
`codegen` line above.

## Clean up and report

```console
kill %1                                   # the server
git switch main && git branch -D red-agent/<yyyy-mm-dd>
rm -rf tests/e2e/red-*.spec.ts test-results/red-agent
```

The repro tests live on in their issues. Then report, in one table: each issue filed (number, title,
video attached or not), each bug left out as already filed (with its issue), and the parts of the
page tested with nothing found. No bug found is a normal result: say so in one line.
