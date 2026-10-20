# Command line
`./skill-atlas scan <GitHub URL | directory> [<word>...]`
Prints the result **at once**; *nothing is stored*.
`GITHUB_TOKEN`, optional: a higher GitHub rate limit.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- Sorted by **name**; the description's *first sentence*
- `also in <paths>` for copies; warnings go to *stderr*
## Filter by words
- **Words** after the repository: only the skills whose *name or description* contains **every** word
- A word matches *anywhere*, case-insensitive: `commit` matches `commits`
- The count shows both: `fixture · 2 of 4 skills`; no match → `fixture · 0 of 4 skills`, exit code 0
- Warnings: all of them, filtered or not
