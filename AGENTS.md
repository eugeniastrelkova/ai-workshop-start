# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally
- The CI build is green: `.github/workflows/ci.yml` (typecheck, tests, smoke test)
- A change a user can see (what `scan` prints, the page): a UI e2e test in `tests/e2e/`, and its video in
  [docs/demo/](docs/demo/README.md), linked in the pull request. How: the [demo-video](.agents/skills/demo-video/SKILL.md) skill

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run e2e`: the UI e2e tests, recorded; `DEMO=docs/demo npm run e2e` keeps the videos
