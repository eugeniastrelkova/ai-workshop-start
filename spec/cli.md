# Command line
`./skill-atlas scan <GitHub URL | directory> [<word>...]`: a repository, or an organization
Prints the result **at once**; *nothing is stored*.
No configuration, no token: GitHub is asked anonymously.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- Sorted by **name**; the description's *first sentence*
- `also in <paths>` for copies; warnings go to *stderr*
## Organization
```
JetBrains · 7 skills in 2 repositories

JetBrains/intellij-community · 1 skill
…

JetBrains/kotlin · 6 skills
…
```
- `N skills in M repositories`: only the repositories *with skills*, sorted by `owner/repo`
- Each one as above, after a blank line
- Warnings name the repository: `warning: JetBrains/kotlin: …`
## Filter by words
- **Words** after the repository: only the skills whose *name or description* contains **every** word
- A word matches *anywhere*, case-insensitive: `commit` matches `commits`
- The count shows both: `fixture · 2 of 4 skills`; no match → `fixture · 0 of 4 skills`, exit code 0
- An organization: only the repositories *with a match*, each `N of M skills`; `JetBrains · 2 of 7 skills in 1 repository`
- Warnings: all of them, filtered or not
