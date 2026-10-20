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
- **Rate limit** → when it resets, from GitHub's answer: `GitHub rate limit reached; set GITHUB_TOKEN, or try again after 13:45 UTC`
  - With `GITHUB_TOKEN`: `GitHub rate limit reached; try again after 13:45 UTC`
  - No reset in the answer (a secondary limit): `…; set GITHUB_TOKEN`, with a token `…; try again in a minute`
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
- With `GITHUB_TOKEN`: one code search over the owner; only repositories with a project skill are opened
- Without: the owner's public repositories, listed; each one through its tree
- **Not** scanned: forks, empty repositories
- More than 1000 files for the code search → only the first 1000, with a warning
- A repository that fails → a *warning* naming it, the scan goes on
- Rate limit, a rejected token → the scan ends, exit code 1
- **Too few requests left** for the repositories found, *at least 2* each → the scan ends *before it starts*, exit code 1
  - `GitHub rate limit too low: 812 repositories need at least 1624 requests, 51 left until 13:45 UTC; set GITHUB_TOKEN`
  - With `GITHUB_TOKEN`: without `; set GITHUB_TOKEN`. GitHub not saying what is left → no check
- Unknown owner → a clear message, exit code 1
## Listing
- GitHub, with `GITHUB_TOKEN`: code search over the whole default branch
- GitHub, without: the tree; too large for one answer → *only the top-level agents' folders*, with a warning
- Local directory: links are `file://` URLs, no commit
