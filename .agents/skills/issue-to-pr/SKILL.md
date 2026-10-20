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

Restate it as the **cases** it adds — the inputs and the output a user would see. Ask before
starting only when two readings would mean two different implementations; otherwise write your
reading into the spec, where the reviewer can see it.

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
the spec now says, which tests cover it — and ends with `Closes #<number>`. Opening it is not the
end: watch it, as below.

## After the pull request

Do not stop at the link. Check the pull request every few minutes (about 5) until CI is green and
no review comment is waiting on you:

```console
gh pr checks <number>                      # CI status
gh pr view <number> --comments             # reviews and comments
curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/eugeniastrelkova/ai-workshop-start/commits/<sha>/check-runs
```

A red check → read its log, fix it locally the same way (test first), push to the same branch. A
review comment → make the change it asks for in spec, tests and code, or reply with why not. Stop
when everything is green and nothing is waiting on you, or when the pull request is merged or
closed, and report the state it ended in.
