# Skill Atlas

Every agent skill in a repository: `./skill-atlas scan` finds each `SKILL.md` and prints its name,
description and link.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

`./skill-atlas scan https://github.com/JetBrains` scans each repository of an organization (or a
user) and prints those with skills.

Words after the repository keep only the skills whose name or description contains every one:
`./skill-atlas scan ./fixture kotlin`.

`./skill-atlas serve` opens the same scan as a page at http://127.0.0.1:4321/: a field for the
repository, then its skills, each with its whole `SKILL.md`.

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `npm test` runs the tests; `npm run e2e`, the UI e2e tests in a browser, in
Docker: recorded, and their screenshots compared to the pixel with `tests/e2e/screenshots/`.

- [spec/](spec/): what it does. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
- [docs/demo/](docs/demo/README.md): videos of the filter and the organization scan, recorded by the UI e2e tests.
