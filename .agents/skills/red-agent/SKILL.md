---
name: red-agent
description: How to attack the Skill Atlas web view as a tester — spec/web.md case by case, then exploratory — and file one GitHub issue per bug it reproduces, as the red agent's GitHub App (a bot), labelled "Delegated to AI", with the steps and a video.
---

# Red agent

The other skills build ([issue-to-pr](../issue-to-pr/SKILL.md)); this one breaks. It tests **the web
view only** — `./skill-atlas serve`, the page at `http://127.0.0.1:4321/` — and for each bug it
can reproduce, opens **one issue**: labelled `Delegated to AI`, with the steps and a video of the
bug. Those issues are what `issue-to-pr` picks up next.

Everything it posts on GitHub is posted **as a bot**: its GitHub App, shown as `<app>[bot]`, never
as the user whose `gh` is logged in. No App token, no issue: report the bugs instead.

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

A bug with an open issue gets no new issue. One whose issue was closed as fixed, and that
reproduces again, gets a new one that links the old. Bugs with one cause are one issue: list both
steps in it.

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
  // Enter, then the new page loaded: a caption or a click on the old one throws.
  const submit = () => Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
  await page.goto('/');
  await demo.caption('<what the user does>');
  await demo.type('input[name=repo]', './fixture');
  await demo.type('input[name=words]', '<words>');
  await submit();
  await demo.pause();
  await demo.caption('Expected: <the spec> — but <what happens>');
  await demo.pause(2500);
  await expect(page.locator('h2').first()).toHaveText('<what the spec says>');
});
```

Pause and caption **before** the failing assertion: the test ends at it, and so does the video.
Submit with `submit()`, never a bare `Enter`: a caption or a click before the new page has loaded
throws `Execution context was destroyed`. `waitForURL` is not enough — the old URL often matches
already (`words=` is there, empty).

A temp directory for a case must be inside the checkout (the image sees only `/skill-atlas`):
`test-results/red-agent/repos/<slug>/`, ignored by git, typed into the field as
`./test-results/red-agent/repos/<slug>`.

Record it, and see **why** it failed: `test.fail()` takes any failure as the expected one, so a test
that throws early on a step, not on the bug, still passes, with a video cut short.

```console
DEMO=test-results/red-agent scripts/e2e.sh red-<slug>.spec.ts --reporter=json 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const r = JSON.parse(s).suites[0].specs[0].tests[0].results[0];
    console.log(r.status, r.error?.message.split("\n").slice(0, 4).join("\n"));
  })'                                  # → test-results/red-agent/red-<slug>.webm
```

It must say `failed` and name the last `expect`, with the spec's text as expected and the bug as
received. Anything else — another step, a locator that is not there — and the test does not show
the bug: fix the test, not the expectation. It says `passed`: the bug did not happen.

Then look at the video before using it, as demo-video's "Check it" says: the length (under about
30 s), a frame at 2 s and the last one, and look at each: the caption and the bug on screen.
`ffmpeg` may be only in the image:

```console
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/w" -w /w "$(scripts/e2e.sh --tag)" sh -c '
  v=test-results/red-agent/red-<slug>.webm
  ffprobe -v error -show_entries format=duration -of csv=p=0 $v
  ffmpeg -v error -y -ss 2 -i $v -frames:v 1 test-results/red-agent/<slug>-2s.png
  ffmpeg -v error -y -sseof -1 -i $v -frames:v 1 test-results/red-agent/<slug>-end.png'
```

## The bot

A GitHub App, made once by the repository's owner: **Settings → Developer settings → GitHub Apps →
New GitHub App**, named for the bot (`skill-atlas-red-agent`), no webhook, repository permissions
**Issues: Read and write** and **Contents: Read and write** (the videos), installed on this
repository only. Its **App ID**, and a **private key** generated on its page (a `.pem`), go to the
session or the automation as secrets:

```console
export RED_AGENT_APP_ID=<App ID>
export RED_AGENT_APP_KEY="$(cat skill-atlas-red-agent.private-key.pem)"
```

[app-token.ts](app-token.ts) trades them for an installation token, valid for an hour. Every `gh`
call that writes runs with it, so GitHub shows the bot; the user's own login is only for reading:

```console
export NODE_USE_ENV_PROXY=1                                   # behind a proxy, as for the server
BOT=$(node .agents/skills/red-agent/app-token.ts)
GH_TOKEN=$BOT gh api /installation/repositories -q '.repositories[].full_name'   # the check: this repository
```

A run longer than the hour mints a new one. The key is a secret: never print it, commit it, or
write it under the checkout.

## Put the video on the media branch

A bot cannot attach a file to an issue: GitHub only uploads attachments from its editor, for a
logged-in person, and has no API for them. So the videos live on one branch of their own,
**`red-agent-media`** (never merged, never branched from), and the issue shows them from there: an
animated **GIF**, which GitHub plays inline, and a link to the **`.webm`**, the full recording.

The GIF, from the video, in the image (under 5 MB, or GitHub does not show it inline; if it is
larger, lower `fps` to 6, then the width to 640):

```console
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/w" -w /w "$(scripts/e2e.sh --tag)" \
  ffmpeg -v error -y -i test-results/red-agent/red-<slug>.webm \
  -vf 'fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse' \
  test-results/red-agent/red-<slug>.gif
```

Both files go up through the contents API, as the bot, with `[skip ci]` so CI does not run for the
branch. The first run makes the branch, as an empty commit with nothing of `main` in it:

```console
R=repos/eugeniastrelkova/ai-workshop-start
GH_TOKEN=$BOT gh api $R/git/ref/heads/red-agent-media >/dev/null 2>&1 || {
  tree=$(echo '{"tree":[{"path":"README.md","mode":"100644","type":"blob",
    "content":"Videos of the bugs the red agent filed. Never merged.\n"}]}' |
    GH_TOKEN=$BOT gh api $R/git/trees --input - -q .sha)
  commit=$(GH_TOKEN=$BOT gh api $R/git/commits -f message='Media of the red agent [skip ci]' -f tree=$tree -q .sha)
  GH_TOKEN=$BOT gh api $R/git/refs -f ref=refs/heads/red-agent-media -f sha=$commit
}
for f in red-<slug>.gif red-<slug>.webm; do
  base64 -w0 test-results/red-agent/$f > test-results/red-agent/$f.b64
  GH_TOKEN=$BOT gh api -X PUT $R/contents/$f -f branch=red-agent-media \
    -f message="Video of <slug> [skip ci]" -F content=@test-results/red-agent/$f.b64 -q .content.path
done
```

A file of that name already there (a slug used before): pick a new slug, never overwrite it — an
older issue shows it. Then check that both open:

```console
curl -fsSI https://github.com/eugeniastrelkova/ai-workshop-start/raw/red-agent-media/red-<slug>.gif | head -1
```

## File the issue

One issue per bug, from a body file, as the bot:

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

### Video
![<title>](https://github.com/eugeniastrelkova/ai-workshop-start/raw/red-agent-media/red-<slug>.gif)

[The recording, full size (.webm)](https://github.com/eugeniastrelkova/ai-workshop-start/blob/red-agent-media/red-<slug>.webm)

### Environment
Commit `<git rev-parse --short HEAD>`, Node `<node -v>`, Chromium in the e2e image.

<details><summary>Repro test: <code>tests/e2e/red-&lt;slug&gt;.spec.ts</code></summary>

```ts
<the test above, as it ran>
```
</details>

<!-- atlas:red-agent <slug> -->
````

```console
GH_TOKEN=$BOT gh issue create --repo eugeniastrelkova/ai-workshop-start \
  --label "Delegated to AI" --label bug \
  --title "<page: what goes wrong>" --body-file test-results/red-agent/<slug>.md
GH_TOKEN=$BOT gh issue view <number> --json author -q .author.login   # the check: <app>[bot]
```

The repro test goes in the body so that `issue-to-pr` can drop it into `tests/e2e/` as the first
failing test; the `atlas:red-agent` marker is how a later run knows it is filed. An issue that shows
anyone but the bot as its author was filed wrong: close it, and file it again with `GH_TOKEN=$BOT`.

A bug the page cannot show in a video (a hang, a header): the issue says so under **Video**, and
nothing goes on the media branch.

## Clean up and report

```console
kill %1                                   # the server
git switch main && git branch -D red-agent/<yyyy-mm-dd>
rm -rf tests/e2e/red-*.spec.ts test-results/red-agent
```

The repro tests live on in their issues, the videos on `red-agent-media`. Then report, in one
table: each issue filed (number, title, with a video or not), each bug left out as already filed
(with its issue), and the parts of the page tested with nothing found. No bug found is a normal
result: say so in one line.
