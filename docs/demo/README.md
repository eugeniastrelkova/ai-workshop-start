# Demos

Short videos of Skill Atlas at work: the UI e2e tests in [tests/e2e/](../../tests/e2e/), each one
recording itself. How: the [demo-video](../../.agents/skills/demo-video/SKILL.md) skill.
CI records them on every run too: the `e2e-recordings` artifact of the `e2e` job.

| Video | Shows | Recorded with |
| --- | --- | --- |
| [filter-by-words.webm](filter-by-words.webm) | Filter by words on the page: `./fixture`, then `commit`, then `commit kotlin`; one SKILL.md unfolded | `DEMO=docs/demo npm run e2e -- filter.spec.ts` |
| [organization-scan.webm](organization-scan.webm) | An organization scan of cvoya-com on the page, then filtered by `triage` | `DEMO=docs/demo npm run e2e -- org.spec.ts` |
| [unreadable-directory.webm](unreadable-directory.webm) | A local repository with one folder no one may read: its skill on the page, the folder a warning under it | `DEMO=docs/demo npm run e2e -- unreadable.spec.ts` |
