# AI adoption workshop: working with agents in JetBrains Air

A write-up for the team: how we used Air and AI agents to go from an issue to a merged pull request, and what we would reuse on our own projects.

Repository: [eugeniastrelkova/ai-workshop-start](https://github.com/eugeniastrelkova/ai-workshop-start)

## 1. The short version

The workshop project, **Skill Atlas**, is a small tool that lists the agent skills (`SKILL.md` files) in a GitHub repository, with a CLI and a local web page. The product itself doesn't matter. It was a practice target for learning how to work with Air.

What we practised is a **spec-driven loop**: a person writes the spec and the instructions, agents turn issues into pull requests, other agents review and test them, and a person decides what merges.

## 2. How the repository is prepared for agents

Agents get their instructions from files in the repo, not from chat messages. Anyone, or any agent, who opens the repo gets the same rules.

| File | Purpose |
| --- | --- |
| [AGENTS.md](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/AGENTS.md) | 20 lines: read the spec first and update it with the code, an integration test for every case in the spec, and a definition of done (tests pass, CI green, a UI e2e test and video for anything a user can see) |
| [spec/](https://github.com/eugeniastrelkova/ai-workshop-start/tree/main/spec) | What the product does, as short decision lists, so an agent can turn each bullet into a test |
| [.agents/skills/](https://github.com/eugeniastrelkova/ai-workshop-start/tree/main/.agents/skills) | One playbook per role (below), each a versioned `SKILL.md` |
| [.air/cloud/startup.sh](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.air/cloud/startup.sh) | Startup script for Air's cloud environment: checks the Node version, installs dependencies, and in warm-up runs the typecheck, tests and a CLI smoke test, so a new environment is known to be good |
| [ci.yml](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.github/workflows/ci.yml) | The check an agent has to turn green: typecheck, tests, smoke tests and UI e2e tests |

## 3. The roles: one skill each

Some roles run inside an interactive Air session. Others run as scheduled **Air automations**.

| Skill | Role | Runs as | What it does |
| --- | --- | --- | --- |
| [issue-to-pr](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/issue-to-pr/SKILL.md) | Builder | Session | Issue → **spec → tests → code → green CI → pull request**, in that order. If the issue is ambiguous it asks a person in Slack and waits. It watches its PR for the first hour, then hands over |
| [address-review](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/address-review/SKILL.md) | Maintainer | Automation, every 15 min | Answers review comments and fixes red CI on open PRs, updating the existing branch. Hidden markers in each reply stop two agents from answering the same comment, and decide who owns the PR |
| [code-review](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/code-review/SKILL.md) | Reviewer | Session | A short review: only defects it can reproduce, as inline comments with the steps to reproduce. It also lists what *not* to report |
| [red-agent](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/red-agent/SKILL.md) | Tester | Automation | Attacks the web page against the spec, then exploratory. A bug must reproduce twice. It files one issue per bug, labelled `Delegated to AI`, with steps and a video, as the Air GitHub app bot |
| [demo-video](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/demo-video/SKILL.md) | Evidence | Session / CI | Playwright UI tests that record themselves as demo videos for the PR |
| [status-update](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/status-update/SKILL.md) | Reporter | Session | One Slack message listing what was merged and resolved since a given time |

### The loop

```text
 red-agent finds a bug ──► GitHub issue labelled "Delegated to AI"
                                   │
                                   ▼
                    issue-to-pr (Air session): spec → tests → code → CI
                                   │
                                   ▼
        pull request ◄── address-review (Air automation) answers comments, fixes CI
                                   │         ▲
                                   ▼         │
                          code-review ───────┘
                                   │
                                   ▼
                         a person merges ──► status-update posts to Slack
```

Evidence it ran end to end:

- `red-agent` filed three real bugs: [#37](https://github.com/eugeniastrelkova/ai-workshop-start/issues/37) (a server crash), [#38](https://github.com/eugeniastrelkova/ai-workshop-start/issues/38) (a 500 on a YAML alias) and [#39](https://github.com/eugeniastrelkova/ai-workshop-start/issues/39) (one unreadable directory loses all skills).
- The Air agent opened PRs with matching titles: [#44](https://github.com/eugeniastrelkova/ai-workshop-start/pull/44), [#41](https://github.com/eugeniastrelkova/ai-workshop-start/pull/41), [#43](https://github.com/eugeniastrelkova/ai-workshop-start/pull/43).
- Features such as the organization scan ([#19](https://github.com/eugeniastrelkova/ai-workshop-start/pull/19)) were opened by the Air agent from issues carrying the `Delegated to AI` label.

## 4. Guardrails that make agent work trustworthy

- **Order is fixed:** spec, then tests, then code. "A spec case without a test is not done" is written into the skill.
- **Tests run offline.** GitHub answers are recorded, and an unrecorded URL throws instead of reaching the network. An agent can iterate without flakiness or rate limits.
- **A fixture repository** has one directory per edge case, with a README mapping each path to the case it covers.
- **UI e2e tests double as demos.** They record a video and compare screenshots pixel by pixel inside a pinned Docker image, so local runs and CI look identical. The video is attached to the PR as proof.
- **Humans stay in the loop.** Ambiguous issues go to a Slack thread. The agent waits for an answer rather than guessing, and a person merges.
- **Agents are told what to leave out.** `code-review` lists what not to report, and `red-agent` lists what is not a bug.
- **Ownership is explicit.** The session owns a PR for its first hour, then posts a handoff marker and the automation takes over. If a check stays red after three pushes, the agent stops and asks a person.
- **Bot identity is separate.** Only the automation posts to GitHub as the Air app bot. In a session, the agent hunts and reports but doesn't post as a person.

## 5. Lessons worth taking back to the team

1. **Put the process in the repo.** `AGENTS.md` plus skills mean the rules are versioned, reviewable and shared. Changing how the team works is a PR to a markdown file.
2. **Write specs an agent can check.** Short, concrete bullets became tests almost one to one.
3. **Split the work by role.** A builder, a reviewer, a tester and a maintainer, each with its own narrow skill, behaved better than one agent asked to do everything.
4. **Use automations for work that waits on something.** Review comments and CI results arrive later, so a scheduled automation covers them. Comments don't trigger GitHub events in Air, so the automation polls on a schedule.
5. **Make "green" cheap and deterministic.** Fast offline tests and a pinned e2e image meant a green check could be trusted.
6. **Keep decisions with people.** Agents ask in Slack when it's ambiguous, and people merge.
7. **Expect to tune the workflow.** The repo history shows the skills were adjusted several times. Budget time for that.

## 6. Try it yourself

```console
$ npm ci
$ npm test                              # offline, about 1 s
$ npm run typecheck
$ ./skill-atlas scan ./fixture          # the CLI on the fixture repository
$ ./skill-atlas serve                   # the page, http://127.0.0.1:4321/
$ npm run e2e                           # UI e2e tests in Docker; DEMO=docs/demo keeps the videos
```

Suggested reading order: [AGENTS.md](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/AGENTS.md) → [issue-to-pr](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/issue-to-pr/SKILL.md) → [address-review](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/address-review/SKILL.md) → [red-agent](https://github.com/eugeniastrelkova/ai-workshop-start/blob/main/.agents/skills/red-agent/SKILL.md).

## 7. What you need to set up for your own project

- Air connected to the GitHub repository, with the Air GitHub app installed (it is the bot identity for automations).
- A startup script for Air's cloud environment, like `.air/cloud/startup.sh`.
- An `AGENTS.md` and a `spec/` folder, and a skills folder with the roles you want.
- A CI workflow that is the definition of "done".
- Automations configured in the Air web view: for `address-review`, a schedule every 15 minutes, updating the source branch rather than opening a new PR.
- A Slack bot token and a channel, if agents should ask questions or post status updates.
- A `Delegated to AI` label, so it is clear which issues are for agents.
