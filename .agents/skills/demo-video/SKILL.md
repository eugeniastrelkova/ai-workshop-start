---
name: demo-video
description: How to record a short demo video of Skill Atlas — a real terminal and the web view, driven by Playwright from prepared cases — into docs/demo/, for a pull request that changes what a user sees.
---

# Demo video

A pull request that changes what a user sees (what `scan` prints, the page) gets a short video of
it working, in [docs/demo/](../../../docs/demo/README.md), linked in the pull request body. Each
video is recorded by [scripts/demo.ts](../../../scripts/demo.ts) from **cases** in
[cases/](cases/): what to type, what to wait for. Nothing is filmed by hand.

## How it records

- A **real terminal**: `ttyd` serves `bash` as a page; Playwright types the commands, key by key.
- The **web view**: `./skill-atlas serve`, on port 4321; Playwright fills the fields and submits.
- One headless Chromium page, the cases one after another, so the cases give **one** `.webm`
  (1280×720). A caption bar at the bottom says what each part shows.
- A `wait` that never sees its text fails the run: exit code 1, *no video*, and a screenshot
  `<out>.failed.png` of the screen at that moment. A broken demo is never saved as if it worked.

## Once per machine

```console
npm ci
npx playwright install chromium         # or the manual way below
which ttyd                              # apt-get install ttyd
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
GITHUB_TOKEN=$(gh auth token) node scripts/demo.ts filter-cli filter-web org-cli \
  --out docs/demo/filter-and-org-scan.webm
```

- `GITHUB_TOKEN` for a case on real GitHub: an organization scan without it lists every
  repository and runs out of the 60 requests an hour.
- Behind an HTTP proxy, Node's `fetch` needs `NODE_USE_ENV_PROXY=1`; the recorder sets it for the
  servers it starts. `EAI_AGAIN` from `./skill-atlas` by hand means that is missing.
- Under a minute, a few MB. Record one case alone first; it is quicker to fix.

## Check it, then link it

Do not link a video you have not looked at. Take a few frames and look at each one:

```console
ffprobe -v error -show_entries format=duration -of csv=p=0 docs/demo/<name>.webm
ffmpeg -v error -ss 12 -i docs/demo/<name>.webm -frames:v 1 /tmp/frame-12.png
```

Then add a line for it to [docs/demo/README.md](../../../docs/demo/README.md): what it shows and
the command that recorded it. In the pull request body, link the file on the branch:
`https://github.com/<owner>/<repo>/blob/<branch>/docs/demo/<name>.webm`.

## Cases

| Case | Shows |
| --- | --- |
| `filter-cli` | `scan ./fixture`, then `commit` (`3 of 4`), then `commit kotlin` (`2 of 4`) |
| `filter-web` | the page: `./fixture` and `commit`, then one SKILL.md unfolded |
| `org-cli` | `scan https://github.com/JetBrains`, its repositories, then filtered by `kotlin` |
| `org-web` | the page: JetBrains, filtered by `kotlin` |
| `broken` | waits for text that never appears: run it to see the failure path, exit code 1 |

A case is a JSON list of steps, run in order:

- `{ "caption": "…" }`: the caption bar from here on; `""` hides it
- `{ "open": "terminal:" }`, `{ "open": "web:" }`, or any URL
- `{ "type": "<command>" }`: on a cleared terminal, key by key, then Enter
- `{ "wait": "<text>", "timeout": 30000 }`: until the text appears *after* the last action
- `{ "fill": "<selector>", "text": "…" }`, `{ "click": "<selector>" }`, `{ "press": "Enter" }`
- `{ "pause": <ms> }`: time to read; about 1.5 s after each result

Wait for text that does not move: on real GitHub the counts change from one run to the next (`104
skills`, then `92`), so wait for ` skills in `, not for a number. Keep output to one screen: the
terminal shows only what fits, and `2>/dev/null | grep ' · '` keeps an organization to its
headings — say so in the caption when warnings are hidden.
