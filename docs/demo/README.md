# Demos

Short videos of Skill Atlas at work: the UI e2e tests in [tests/e2e/](../../tests/e2e/), each one
recording itself. How: the [demo-video](../../.agents/skills/demo-video/SKILL.md) skill.
CI records them on every run too: the `e2e-recordings` artifact of the `e2e` job.

| Video | Shows | Recorded with |
| --- | --- | --- |
| [filter-by-words.webm](filter-by-words.webm) | Filter by words on the page: `./fixture`, then `commit`, then `commit kotlin`; one SKILL.md unfolded | `DEMO=docs/demo npm run e2e -- filter.spec.ts` |
| [organization-scan.webm](organization-scan.webm) | An organization scan of JetBrains on the page, then filtered by `kotlin` | `GITHUB_TOKEN=… DEMO=docs/demo npm run e2e -- org.spec.ts` |
