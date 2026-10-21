# Repository analysis
## Input
A **GitHub repository** URL, a **GitHub organization** URL, or a local directory
## Output
Every *project skill* (below): **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI and web view: *thin clients*.
Skill: id = `repo:path`, name, description, commit, text (the whole SKILL.md)
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
- **GitHub is asked anonymously**: no token, ever; only public repositories are reachable
- **Rate limit** → when it resets, from GitHub's answer: `GitHub rate limit reached; try again after 13:45 UTC`
  - No reset in the answer (a secondary limit): `GitHub rate limit reached; try again in a minute`
## Project skill
`<subproject>/<agents' folder>/<name>/SKILL.md`; the subproject is optional
- Agents' folders, in this order: `.agents/skills`, `.claude/skills`, `.github/skills`, `agent/skills`
- Exactly `SKILL.md`; *regular files only*, a symbolic link is not a skill
- **Not** a project skill: any other `SKILL.md`
  - Outside the agents' folders (`SKILL.md` at the root, `testData/x/SKILL.md`)
  - Deeper in a skill (`.claude/skills/x/examples/SKILL.md`): part of `x`
  - Under `.git` or `node_modules`, on GitHub as well
- **Copies**: the same name, paths that differ *only in the agents' folder* → one skill
  - Linked to the first folder in the order, `also in` the others; the contents may differ
  - The same name elsewhere (`a/.claude/skills/x`, `b/.claude/skills/x`) → two skills
## Organization
`https://github.com/<owner>`: an organization or a user; *each of its repositories* scanned as above
- The owner's public repositories, listed; each one through its tree
- **Not** scanned: forks, empty repositories
- A repository that fails → a *warning* naming it, the scan goes on
- Rate limit → the scan ends, exit code 1
- **Too few requests left** for the repositories listed, *at least 2* each → the scan ends *before it starts*, exit code 1
  - `GitHub rate limit too low: 812 repositories need at least 1624 requests, 51 left until 13:45 UTC`
  - GitHub not saying what is left → no check
- Unknown owner → a clear message, exit code 1
## Listing
- GitHub: the tree; too large for one answer → *only the top-level agents' folders*, with a warning
- Local directory: links are `file://` URLs, no commit
