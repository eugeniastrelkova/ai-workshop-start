# Command line
`./skill-atlas scan <GitHub URL | directory>`: a repository, or an organization
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
