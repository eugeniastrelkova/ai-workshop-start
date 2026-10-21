# Web view
`./skill-atlas serve [--port <port>]`: a page at `http://127.0.0.1:<port>/`, port **4321** by default.
Local only: it listens on *127.0.0.1*, since it reads local directories.
## Page
- A **field** for the repository: a GitHub URL, of a repository or an organization, or a local directory, as in `scan`
- A second **field** for words, filtering as in `scan`; empty: every skill
- Submitted: `/?repo=<input>&words=<words>`; a link to a scan is shareable
- A GitHub repository's result is kept *in memory* by its **commit**: the same commit is not scanned again, a new commit is
- A local directory is scanned **afresh** on each request; *nothing is written to disk*
## Result
- `<owner>/<repo> · N skills`, filtered `N of M skills`; skills in the order of `scan`
- Each skill: **name**, the description's *first sentence*, the **link**, `also in` for copies
- Its **SKILL.md**: the whole file, as text, *folded* until opened
- Warnings: listed under the skills
- An organization: `<owner> · N skills in M repositories`, then each repository with skills as above (filtered: with a match); warnings at the end
## Errors
- Unreachable repository, rate limit: the message of `scan`, on the page, status **400**
- Any other path: status 404
