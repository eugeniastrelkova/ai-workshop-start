# Web view
`./skill-atlas serve [--port <port>]`: a page at `http://127.0.0.1:<port>/`, port **4321** by default.
Local only: it listens on *127.0.0.1*, since it reads local directories.
## Page
- A **field** for the repository: a GitHub URL, of a repository or an organization, or a local directory, as in `scan`
- Submitted: `/?repo=<input>`; a link to a scan is shareable
- Each request scans **afresh**; *nothing is stored*
## Result
- `<owner>/<repo> · N skills`; skills in the order of `scan`
- Each skill: **name**, the description's *first sentence*, the **link**, `also in` for copies
- Its **SKILL.md**: the whole file, as text, *folded* until opened
- Warnings: listed under the skills
- An organization: `<owner> · N skills in M repositories`, then each repository with skills as above; warnings at the end
## Errors
- Unreachable repository, rate limit: the message of `scan`, on the page, status **400**
- Any other path: status 404
