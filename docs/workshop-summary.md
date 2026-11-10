# Skill Atlas: what we built in the AI adoption workshop

A write-up for the team: what the project is, how it was built with AI agents, and what we would reuse.
Facts below come from the repository, its pull requests and its issues.

## 1. The short version

**Skill Atlas** is a small tool that finds every agent skill (`SKILL.md`) in a GitHub repository, a GitHub
organization, or a local directory, and prints each one's name, description and link. It has a CLI and a
local web page.

The product is only the vehicle. The point of the workshop was the **way of working**: a spec-driven loop in
which AI agents take an issue to a merged pull request, other agents review and test the result, and humans
stay in charge of the specs, the skills (instructions) and the merge button.

- ~860 lines of TypeScript in `src/` (Node 24, no build step, one dependency: `yaml`), ~660 lines of integration
  tests and test helpers.
- 35 tests, all passing locally (`npm test`, about 1 s, no network: GitHub answers are replayed).

## 2. The product

```console
$ ./skill-atlas scan https://github.com/JetBrains/kotlin          # one repository
$ ./skill-atlas scan https://github.com/JetBrains                 # every repository of an organization
$ ./skill-atlas scan ./fixture kotlin                             # a local directory, filtered by words
$ ./skill-atlas serve                                             # the same as a page, http://127.0.0.1:4321/
```

| Feature | Behaviour |
| --- | --- |
| What is a skill | `<subproject>/<agents' folder>/<name>/SKILL.md`, where the folder is `.agents/skills`, `.claude/skills`, `.github/skills` or `agent/skills`. Symlinks, `node_modules`, `.git` and stray `SKILL.md` files don't count |
| Copies | The same skill in several agents' folders is one skill, linked to the first folder, with `also in …` |
| Links | Pinned to the scanned commit, so they never go stale |
| Filter | Words after the repository keep skills whose name or description contains *every* word (`fixture · 2 of 4 skills`) |
| Organizations | Scans each non-fork, non-empty repository; a failing repository is a warning, not a stop |
| Rate limits | GitHub is asked **anonymously** (no token, 60 requests/hour). The message says when the limit resets, and an organization scan refuses to start if it cannot finish |
| Web view | Same scan as a page; GitHub results cached in memory by commit; local directories always rescanned; nothing written to disk |
| Failure style | Partial failure is normal: bad front matter or a missing file is a warning on stderr and the scan goes on. Only an `AtlasError` ends a run (exit code 1) |

### Architecture

```text
src/core/   the program; knows nothing about Node
  find.ts     what counts as a skill (path rules)
  parse.ts    YAML front matter, tolerant of malformed input
  scan.ts     fetch → find → parse, copy merging, per-commit cache, organization scan
  github.ts   GitHub API client: trees, rate-limit handling, no clone
  model.ts    Repository / Skill types, link building, sort order
  replay.ts   a fetch that answers from recorded GitHub responses (for tests)
src/commands.ts   CLI commands and output text, shared by every client
src/cli.ts        Node entry point
src/web.ts        the page (a thin client over the same core)
src/local.ts      a local directory as a `Source`
```

Design rule: **fetch → find → parse** in the core; CLI and web are thin clients. A new entry point supplies a
`Context`, a new kind of repository supplies a `Source`; neither adds logic to `core/`.

## 3. How it was built: the AI-driven workflow

### 3.1 The repository is the prompt

Agents get their instructions from files checked into the repo, not from chat:

- [AGENTS.md](../AGENTS.md): 20 lines. Read the spec first and update it with the code; an integration test for
  every case in the spec; the definition of done (tests pass, CI green, UI e2e test + video for anything a
  user can see).
- [spec/](../spec/): `analysis.md` (what counts as a skill, the pipeline), `cli.md` (what `scan` prints),
  `web.md` (the page). Written as terse decision lists, in one voice, so an agent can turn each bullet into a test.
- [.agents/skills/](../.agents/skills/): the team's playbooks, written as skills (see 3.2).

### 3.2 The skills: one per role

| Skill | Role | What it does |
| --- | --- | --- |
| [issue-to-pr](../.agents/skills/issue-to-pr/SKILL.md) | Builder | Issue → **spec → tests → code → green CI → PR**, in that order. Asks a human in Slack (`#ai-test-channel`) when an issue is ambiguous. Watches its PR for the first hour, then hands over |
| [address-review](../.agents/skills/address-review/SKILL.md) | Maintainer | Scheduled Air automation (every 15 min). Answers review comments and fixes red CI on open PRs. Hidden `atlas:answered` / `atlas:handoff` markers prevent double answers and decide who owns a PR |
| [code-review](../.agents/skills/code-review/SKILL.md) | Reviewer | Short review: only defects it can reproduce, as inline comments with repro steps. Explicitly lists what *not* to report (style, intentional design choices) |
| [red-agent](../.agents/skills/red-agent/SKILL.md) | Tester | Attacks the web view against `spec/web.md`, then exploratory. A bug must reproduce twice; files **one issue per bug**, labelled `Delegated to AI`, with steps and a video, posted as the bot |
| [demo-video](../.agents/skills/demo-video/SKILL.md) | Evidence | Playwright UI tests that record themselves as demo videos (see 3.4) |
| [status-update](../.agents/skills/status-update/SKILL.md) | Reporter | One Slack message: PRs merged and issues resolved since a given time |

### 3.3 The loop

```text
 red-agent finds a bug ──► GitHub issue ("Delegated to AI")
                                   │
                                   ▼
                      issue-to-pr: spec → tests → code → CI
                                   │
                                   ▼
        pull request ◄── address-review (scheduled) answers comments, fixes CI
                                   │         ▲
                                   ▼         │
                          code-review ───────┘
                                   │
                                   ▼
                         human merges ──► status-update posts to Slack
```

Concrete evidence it ran end to end:

- `red-agent` filed bugs [#37](https://github.com/eugeniastrelkova/ai-workshop-start/issues/37) (`//` crashes the
  server), [#38](https://github.com/eugeniastrelkova/ai-workshop-start/issues/38) (YAML alias gives a 500) and
  [#39](https://github.com/eugeniastrelkova/ai-workshop-start/issues/39) (one unreadable directory loses all skills).
- The Air agent then opened PRs whose titles match them: #44, #41, #43 (still open at the time of writing).
- Organization scan (#19), filter by words (#18) and rate-limit messages (#22) were opened by the Air agent; the
  issues #17, #16 and #21 carry the same topics and the `Delegated to AI` label.

### 3.4 Evidence, not claims

- **Integration tests through the command a user runs**, asserting on exact printed text. The tests do not
  poke at internals. GitHub is never called in tests: `tests/helpers.ts` holds recorded answers, and an
  unrecorded URL throws instead of reaching the network.
- **A fixture repository** ([fixture/](../fixture/README.md)): one directory per edge case (copies, same name
  elsewhere, other agent folders, malformed front matter), with a README mapping path → case.
- **UI e2e tests that double as demos** ([tests/e2e/](../tests/e2e/)): Playwright drives the page with captions
  and human-paced typing, records a video, and compares screenshots **to the pixel** inside a pinned Docker
  image so fonts and Chromium are identical locally and on CI. Videos live in
  [docs/demo/](demo/README.md) and are attached to PRs.
- **CI** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)): typecheck, tests, CLI smoke test, web smoke
  test, and the e2e job (Docker image cached by tag; recordings uploaded as an artifact for 14 days).

## 4. Lessons worth taking back to the team

1. **Spec first, tests second, code third.** Specs written as short bullets gave agents something checkable.
   The rule is enforced in the skill ("a spec case without a test is not done"), not left to goodwill.
2. **Put process in skills, not in prompts.** Each recurring job (build, review, test, report) is one
   versioned `SKILL.md`. Changing the team's process is a PR to a markdown file.
3. **Tell agents what to leave out.** `code-review` lists what *not* to report, and `red-agent` lists what is
   not a bug. This keeps reviews short and stops agents re-filing intentional design choices.
4. **Define ownership and idempotency for automation.** Handoff markers mean two agents never answer the same
   comment, and an agent stops after three failed attempts on the same red check and asks a person.
5. **Make verification cheap and deterministic.** Replayed network answers, a fixture repo, and a pinned Docker
   image for screenshots mean "green" is trustworthy and an agent can iterate without flakiness.
6. **Humans keep the decisions.** Ambiguous issues go to a Slack thread for a person; the skill tells the agent
   to wait for the answer rather than guess. Agents open and update PRs; a person decides what merges.
7. **Agents can find bugs for each other.** The red agent's three bug reports (a server crash, a 500 on a YAML
   alias, a lost directory) each has a PR with a matching title.
8. **Expect iterations on the workflow itself.** The repo history shows the agent workflow itself was tuned by
   trial and error. Budget for that.

## 5. Try it yourself

```console
$ npm ci
$ npm test                              # 35 tests, ~1 s, no network
$ npm run typecheck
$ ./skill-atlas scan ./fixture          # 4 skills, plus a warning for the malformed one
$ ./skill-atlas scan ./fixture commit   # filter by words
$ ./skill-atlas serve                   # open http://127.0.0.1:4321/
$ npm run e2e                           # UI e2e tests in Docker; DEMO=docs/demo keeps the videos
```

Then read, in this order: [AGENTS.md](../AGENTS.md) → [spec/web.md](../spec/web.md) →
[issue-to-pr](../.agents/skills/issue-to-pr/SKILL.md) → a merged agent PR such as #19.

## 6. Known gaps and open items

- Open PRs awaiting review: #44 (`//` crash), #43 (unreadable directory), #41 (YAML alias), #42 (e2e image
  retries), #34 (Slack questions), #6 (web test refactor).
- Open issues #8, #9 and #33 ("Make the skill list nicer") look like workshop experiments rather than planned work.
- Only public repositories can be scanned and only 60 GitHub requests an hour are available, by design (anonymous access).
- The web view is local-only (it binds to 127.0.0.1 because it reads local directories).
- The e2e Docker image is slow to build cold (about 11 minutes); CI caches it.
- Bots need setup outside the repo: the `jetbrains-air[bot]` GitHub app, `SLACK_BOT_TOKEN`, and the
  Air automation for `address-review` configured in the Air web view.
