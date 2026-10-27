# AI adoption workshop: results

Workshop week: **20–21 October 2026**. Repository: [Skill Atlas](../README.md), a CLI and web page
that lists every agent skill (`SKILL.md`) in a repository or organization.

The product was a vehicle. The point of the workshop was to see how far a team can hand the whole
delivery loop to agents (issue, spec, tests, code, review, CI, status report, even bug hunting) and
what has to be written down for that to work.

In two days: **~30 pull requests** (21 merged, the rest open or closed experiments), **6 agent
skills**, **2 demo videos recorded by e2e tests** with pixel-exact screenshots in CI, and **3 bugs
found by an agent and fixed by an agent** (fixes awaiting human review).

## The loop we built

```
 red-agent ──files bug──▶ GitHub issue ──▶ issue-to-pr ──▶ pull request
     ▲                    (label: Delegated to AI)             │
     │                                                         ▼
     └──────────── tests the page ◀── merge ◀── address-review + code-review + CI
                                                   │
                                                   ▼
                                            status-update ──▶ Slack
```

Everything an agent needs to know lives in the repo, not in anyone's head: [AGENTS.md](../AGENTS.md)
(definition of done), [spec/](../spec/) (what the product does) and `.agents/skills/` (how each job
is done).

## Principles that made agents effective

1. **Spec first, in the repo.** `AGENTS.md` says "read `spec/` first, update it with the code". Every
   PR changes the spec, so the spec stays true and the reviewer reads decisions, not diffs.
2. **A test for every spec case.** Integration tests through the command a user runs, asserting on the
   exact printed text. "Done" is checkable by the agent itself.
3. **Definition of done is explicit and mechanical.** Tests pass, CI is green, and a user-visible
   change comes with a UI e2e test and a video.
4. **Skills are runbooks.** Each recurring job is a `SKILL.md` with exact commands, exact formats and
   an explicit list of what *not* to do (see "Not a bug" in `red-agent`).
5. **Tell agents where humans stay in the loop.** Open decisions go to Slack, not into a guess.
6. **Agents act under their own identity.** Bot-authored issues and PRs show as `jetbrains-air[bot]`,
   so the team can always tell who did what.

## The six agent skills

All in [.agents/skills/](../.agents/skills/).

### issue-to-pr ([#7](https://github.com/eugeniastrelkova/ai-workshop-start/pull/7))
Turns a GitHub issue into a pull request in one fixed order: **read the issue, spec, tests, code,
everything green, PR**.
- Restates the issue as *cases* (input and the output a user sees). Issues in this workshop were often
  only a title ("scan the organization"); the agent's reading is written into the spec so the
  reviewer sees it.
- Branches from an up-to-date `main`, never commits to it.
- When the issue leaves a real decision open, **asks in Slack `#ai-test-channel`**, keeps the whole
  conversation in one thread, and waits ([#30](https://github.com/eugeniastrelkova/ai-workshop-start/pull/30),
  [#32](https://github.com/eugeniastrelkova/ai-workshop-start/pull/32)).
- After opening the PR it **watches CI and review comments every ~5 minutes**, fixes red checks and
  answers comments, until green or merged ([#20](https://github.com/eugeniastrelkova/ai-workshop-start/pull/20)).

Results: filter by words ([#18](https://github.com/eugeniastrelkova/ai-workshop-start/pull/18)),
organization scan ([#19](https://github.com/eugeniastrelkova/ai-workshop-start/pull/19)), rate-limit
message ([#22](https://github.com/eugeniastrelkova/ai-workshop-start/pull/22)): all authored by the agent
from a title-only issue.

### code-review ([#5](https://github.com/eugeniastrelkova/ai-workshop-start/pull/5))
A deliberately *short* review: only defects the agent can **reproduce**, each an inline comment
anchored to a line with a paste-able repro (`./skill-atlas scan ./fixture`, a single `node --test`).
- Explicit non-goals: style, naming, missing tests, and things the architecture does on purpose.
- Rule: run the repro before reporting; if it does not fail as predicted, drop the finding.
- "Two confirmed findings beat eight suspected ones"; *no findings* is a valid result.

### address-review ([#23](https://github.com/eugeniastrelkova/ai-workshop-start/pull/23))
Handles review comments and red CI **after the opening session is gone**. The interesting part is the
coordination protocol between two agents:
- The opening session owns the PR for its first hour, then posts `<!-- atlas:handoff -->`. After that
  an **Air automation** on a schedule owns it (or takes over after 2 h if the session died).
- Every reply carries a hidden `<!-- atlas:answered <kind>/<id> -->` marker, so no comment is answered
  twice, by either agent or by a later run.
- Only the owner pushes or replies, so two agents never fight over a branch.

### demo-video ([#27](https://github.com/eugeniastrelkova/ai-workshop-start/pull/27), [#28](https://github.com/eugeniastrelkova/ai-workshop-start/pull/28), [#36](https://github.com/eugeniastrelkova/ai-workshop-start/pull/36))
A change a user can see must come with a short video. The video is not filmed: a **Playwright UI e2e
test records itself**, so a demo is also a regression test.
- Tests assert on what the user sees, with captions and pacing helpers (`demo.caption`, `demo.type`).
- Key moments are **pixel-exact screenshots**: one changed pixel fails the build.
- Runs in a Docker image so the cloud, CI and a laptop render identically.
- CI runs it on every push and keeps the `e2e-recordings` artifact (videos, traces, diffs).
- The videos are in [docs/demo/](demo/README.md): filter by words, and an organization scan.

### red-agent ([#35](https://github.com/eugeniastrelkova/ai-workshop-start/pull/35))
The counterweight: the other skills build, this one **breaks**. It runs as a scheduled automation and
tests the web page, `spec/web.md` case by case, then exploratory.
- A bug is reported only if it **reproduces twice from a fresh server**.
- One issue per bug, filed as `jetbrains-air[bot]`, labelled `bug` and `Delegated to AI`, with
  steps, the spec line it violates, actual vs expected, a video, and a folded repro test that
  `issue-to-pr` can reuse as the first failing test.
- In an interactive session, where `gh` holds a person's token, it hunts but **posts nothing**.

### status-update ([#40](https://github.com/eugeniastrelkova/ai-workshop-start/pull/40))
Posts one Slack message to `#ai-test-channel`: PRs merged and issues resolved since a given time
(closed as completed only, not "not planned"). Has an anonymous `curl` fallback when `gh` is missing.

## The loop closing: red-agent found real bugs

red-agent filed three issues; `issue-to-pr` picked each one up and opened a fix with spec and tests.

| Issue (filed by the bot) | What was wrong | Fix PR |
| --- | --- | --- |
| [#37](https://github.com/eugeniastrelkova/ai-workshop-start/issues/37) | Opening `//` crashed the server, every later page was gone | [#44](https://github.com/eugeniastrelkova/ai-workshop-start/pull/44) |
| [#38](https://github.com/eugeniastrelkova/ai-workshop-start/issues/38) | A YAML alias in one `SKILL.md` failed the whole scan with a 500 | [#41](https://github.com/eugeniastrelkova/ai-workshop-start/pull/41) |
| [#39](https://github.com/eugeniastrelkova/ai-workshop-start/issues/39) | One unreadable directory lost all of a local repo's skills | [#43](https://github.com/eugeniastrelkova/ai-workshop-start/pull/43) |

The fix PRs are still open, awaiting human review. That is the intended checkpoint: agents file,
fix and verify, a person decides to merge.

## Timeline

| When (UTC) | What | PRs |
| --- | --- | --- |
| 20 Oct, morning | Cloud startup script, web view, code-review skill, issue-to-pr skill | [#3](https://github.com/eugeniastrelkova/ai-workshop-start/pull/3), [#4](https://github.com/eugeniastrelkova/ai-workshop-start/pull/4), [#5](https://github.com/eugeniastrelkova/ai-workshop-start/pull/5), [#7](https://github.com/eugeniastrelkova/ai-workshop-start/pull/7) |
| 20 Oct, midday | Agent fixes a failing test; filter by words; organization scan (from title-only issues) | [#12](https://github.com/eugeniastrelkova/ai-workshop-start/pull/12), [#18](https://github.com/eugeniastrelkova/ai-workshop-start/pull/18), [#19](https://github.com/eugeniastrelkova/ai-workshop-start/pull/19) |
| 20 Oct, afternoon | Agent keeps checking PR until CI is green; rate-limit message; handoff to address-review automation; UI e2e tests that record demos | [#20](https://github.com/eugeniastrelkova/ai-workshop-start/pull/20), [#22](https://github.com/eugeniastrelkova/ai-workshop-start/pull/22), [#23](https://github.com/eugeniastrelkova/ai-workshop-start/pull/23), [#27](https://github.com/eugeniastrelkova/ai-workshop-start/pull/27) |
| 21 Oct, morning | Anonymous GitHub access (no token); Slack questions; recorded e2e with pixel-exact screenshots in CI | [#28](https://github.com/eugeniastrelkova/ai-workshop-start/pull/28), [#29](https://github.com/eugeniastrelkova/ai-workshop-start/pull/29), [#30](https://github.com/eugeniastrelkova/ai-workshop-start/pull/30), [#32](https://github.com/eugeniastrelkova/ai-workshop-start/pull/32) |
| 21 Oct, midday | red-agent; org e2e test on a stable org; status-update; scan cache by commit | [#35](https://github.com/eugeniastrelkova/ai-workshop-start/pull/35), [#36](https://github.com/eugeniastrelkova/ai-workshop-start/pull/36), [#40](https://github.com/eugeniastrelkova/ai-workshop-start/pull/40), [#45](https://github.com/eugeniastrelkova/ai-workshop-start/pull/45) |

## Still open

- Bot fixes awaiting review: [#41](https://github.com/eugeniastrelkova/ai-workshop-start/pull/41),
  [#43](https://github.com/eugeniastrelkova/ai-workshop-start/pull/43),
  [#44](https://github.com/eugeniastrelkova/ai-workshop-start/pull/44).
- [#42](https://github.com/eugeniastrelkova/ai-workshop-start/pull/42): retry the e2e Docker image
  downloads (CI flakiness).
- [#34](https://github.com/eugeniastrelkova/ai-workshop-start/pull/34): ask issue-to-pr questions in
  Slack only, never on the issue.
- Several early closed PRs were throwaway experiments (failing-test PRs, a duplicate "filter" PR) used
  to try the automations.

## What we learned

- **Title-only issues work** when the agent must write its reading into the spec: ambiguity becomes
  a reviewable artifact instead of a silent guess.
- **Rate limits and flaky CI are agent problems too.** The anonymous-GitHub decision (#29), the
  early scan abort (#22) and the e2e retry (#42) all came from agents hitting real limits.
- **Two agents on one PR need a protocol.** Markers and an ownership rule were enough.
- **Visual proof beats prose.** Videos and pixel-exact screenshots let a reviewer verify a UI
  change in seconds.
- **Adversarial and constructive agents complement each other.** The bugs red-agent found were ones
  the builder's tests did not cover.
- **Humans moved up a level:** deciding open questions in Slack, reviewing specs, and merging.
