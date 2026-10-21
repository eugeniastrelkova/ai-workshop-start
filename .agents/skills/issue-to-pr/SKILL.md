---
name: issue-to-pr
description: How to turn a GitHub issue into a pull request in Skill Atlas — the spec first, then a test for every case it adds, then the code, then a green CI.
---

# Issue to pull request

One order, and it does not change: **read the issue → spec → tests → code → everything green → the
pull request**. A pull request that changes behaviour without a line in [spec/](../../../spec/), or
a spec case without a test, is not done.

## Read the issue

```console
gh issue view <number>                     # if gh is installed
curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/eugeniastrelkova/ai-workshop-start/issues/<number>
```

Restate it as the **cases** it adds — the inputs and the output a user would see. When the issue
leaves a decision open — two readings would mean two different implementations — ask in the Slack
channel `#ai-test-channel`, not in the session, then wait for the answer and go on with it.
Otherwise write your reading into the spec, where the reviewer can see it.

```console
curl -fsS -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"channel":"#ai-test-channel","text":"<issue link> — <the question, with the options>"}' \
  https://slack.com/api/chat.postMessage            # keep "channel" and "ts" from the reply
curl -fsS -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.replies?channel=<channel>&ts=<ts>"   # every few minutes
```

The answer is the first reply in that thread. Do not branch or write the spec until it comes.

Then branch off an up-to-date `main`: `git switch -c spec/<short-name>`. Never commit to `main`.

## The spec, first

Decide where the case belongs: [spec/analysis.md](../../../spec/analysis.md) for what counts as a
skill and for the pipeline, [spec/cli.md](../../../spec/cli.md) for what `scan` prints,
[spec/web.md](../../../spec/web.md) for the page. Write it in the voice already there — a line or
two of decisions, bold for the terms, not paragraphs — and delete what the issue makes untrue
instead of adding beside it.

## A test for every case

Integration tests, through the command a user runs, asserting on the exact text it prints:
`tests/scan.test.ts` for the CLI (`atlas()` from `tests/helpers.ts`), `tests/web.test.ts` for the
server. Do not reach into `core/` to assert on internals when the printed output shows the case.

- A new edge case about where skills live → a directory under [fixture/](../../../fixture/README.md)
  and a row in its README saying which case it covers. The counts in the expected output
  (`fixture · 4 skills`) move with it.
- A new GitHub response → add the URL to `EXAMPLE` in `tests/helpers.ts`. An unrecorded URL throws
  rather than reaching the network, and some tests rely on that.

Write the test before the code and watch it fail for the right reason.

## The code

`src/core/` is the program and knows nothing about Node: `find.ts` decides what counts as a skill,
`parse.ts` reads front matter, `scan.ts` drives fetch → find → parse. A new entry point supplies a
`Context`, a new repository kind supplies a `Source` — neither adds logic to `core/`. Output text
and formatting live in `commands.ts`, in one place, so the CLI and the page stay in step.

Partial failure is normal: a malformed file or a missing path adds a warning on stderr and the scan
goes on. Only an `AtlasError` ends a run, with its message shown and exit code 1.

TypeScript runs directly on Node 24 — no build step, and imports keep the `.ts` extension.

## Done

All of these, locally, before the pull request:

```console
npm test
npm run typecheck
./skill-atlas help && ./skill-atlas scan ./fixture     # the smoke test in CI
```

If the change touches the page, run the `serve` smoke test from
[.github/workflows/ci.yml](../../../.github/workflows/ci.yml) too. Fix failures; never adjust an
expectation to match a result you did not intend.

## The pull request

Commit with a short imperative subject, as the log already reads (`Add code-review skill`). Push,
then `gh pr create`, or `POST /repos/eugeniastrelkova/ai-workshop-start/pulls` with `curl` and
`$GITHUB_TOKEN` when `gh` is missing. The body is three short parts — what the issue asked, what
the spec now says, which tests cover it — and ends with `Closes #<number>`. A change a user can see
gets a UI e2e test and its video too, recorded with [demo-video](../demo-video/SKILL.md) and linked in the body. Opening it is not the
end: watch it, as below.

## After the pull request

Do not stop at the link: this session owns the pull request for its first hour. Every few minutes
(about 5), do one pass of [address-review](../address-review/SKILL.md) — fix a red check, answer
each comment that is waiting, with its `atlas:answered` marker. Finish what is in progress, but
start nothing new after the hour.

Then hand over, even if everything is green, so the automation knows it owns the pull request now:

```console
gh pr comment <number> --body $'Stopped watching; the address-review automation takes over.\n<!-- atlas:handoff -->'
```

Stop sooner, without the handoff, if the pull request is merged or closed. Report the state it
ended in.
