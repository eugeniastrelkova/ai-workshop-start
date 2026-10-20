---
name: code-review
description: How to review a change in Skill Atlas — a short review, reported as inline comments, each one anchored to a line and carrying the steps that reproduce it.
---

# Code review

A review is short. Report only defects you can reproduce, and say where each one lives and how to
reproduce it.

## What to report

Correctness bugs in the lines the change touches: wrong output, a crash, a case the pipeline
(fetch → find → parse) drops, or behaviour that contradicts [spec/](../../../spec/). A change that
alters printed text without updating the expected strings in `tests/scan.test.ts` is a finding.

Leave out: style, naming, comment wording, missing tests (this project does not add tests during
review — if the expectations are wrong, say which string is wrong), and anything the architecture
already states on purpose — `sortSkills` comparing with `<`/`>` instead of `localeCompare`,
`Skill.copies` never being filled in, warnings on malformed front matter or a missing file instead
of an error.

Prefer a review with two findings you have confirmed over one with eight you suspect. No findings is
a normal result: say so in one line and stop.

## How to report

Use the `ReportFindings` tool, most severe first, and do not print the findings as prose as well.
Each finding is one inline comment:

- `file` + `line` — the repo-relative path and the 1-indexed line the bug is on, not the file it
  shows up in. Anchor to the code that is wrong.
- `summary` — one sentence naming the defect.
- `failure_scenario` — the reproduction: the command, the input, the output you get, the output you
  expected. Use this project's own commands and inputs, so the reader can paste them:

  ```console
  ./skill-atlas scan ./fixture
  ./skill-atlas scan https://github.com/JetBrains/kotlin
  node --test --test-name-pattern '<name>' tests/scan.test.ts
  npm run typecheck
  ```

  Reach for [fixture/](../../../fixture/README.md) for a local repository — its directories are the
  edge cases, and its README maps each path to the case it covers. For a GitHub scan, use a URL
  already recorded in `tests/helpers.ts:EXAMPLE`; an unrecorded URL does not reach the network, it
  throws. If the bug needs a fixture directory or a recording that does not exist yet, say which one
  in the repro instead of inventing output.

Run the repro before reporting. If it does not fail the way you predicted, drop the finding.
