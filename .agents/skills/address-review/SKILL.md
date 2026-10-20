---
name: address-review
description: How to answer review comments and fix red CI on an open Skill Atlas pull request — run by the Air automation once the opening session has handed the pull request over, with a marker on every reply so no comment is answered twice.
---

# Address review

Two agents look after a pull request, never at once. The session that opened it watches it for the
first hour ([issue-to-pr](../issue-to-pr/SKILL.md)), then hands over. After that, an Air automation
runs this skill on a schedule. Both answer comments by the rules below, so a comment answered by one
is never answered again by the other, or by a later run of the same one.

## The markers

Every comment the agent posts carries a hidden marker, and only these two:

- `<!-- atlas:answered <kind>/<id> -->` — in the reply to a comment. `<kind>` is `review-comment`
  (an inline comment on a line), `review` (the body of a review) or `issue-comment` (a comment in
  the conversation), because the three are numbered separately.
- `<!-- atlas:handoff -->` — in the comment the session posts when it stops watching.

A comment with an `atlas:` marker is the agent's own: never answer it. A comment whose
`<kind>/<id>` appears in some `atlas:answered` marker is done: never answer it again.

## Who owns the pull request

- **The session** owns it from `gh pr create` until it posts the handoff.
- **The automation** owns it once the handoff is there, or once the pull request is more than
  2 hours old with no handoff (the session died). Before that, it skips the pull request.

Only the owner pushes or replies. That keeps the two from working on the same comment at the same
time; the markers keep them from answering it twice across runs.

## One pass

Read everything, then work out what is waiting:

```console
gh api repos/eugeniastrelkova/ai-workshop-start/pulls/<number>/comments     # review-comment
gh api repos/eugeniastrelkova/ai-workshop-start/pulls/<number>/reviews      # review
gh api repos/eugeniastrelkova/ai-workshop-start/issues/<number>/comments    # issue-comment
gh pr checks <number>
```

Without `gh`, the same paths work with `curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN"
https://api.github.com/<path>`. A review with an empty body is not a comment.

Waiting: every comment that has no `atlas:` marker in it and whose `<kind>/<id>` is in no
`atlas:answered` marker, oldest first, plus a red check.

For each one, on the pull request's branch:

1. Make the change it asks for the way [issue-to-pr](../issue-to-pr/SKILL.md) makes any change —
   spec, then tests, then code, then the checks in its **Done** section — or decide not to, with
   a reason.
2. Commit and push, if anything changed.
3. Only then reply, so a reply always means the work is on the branch. An inline comment gets a
   reply in its thread; a review or a conversation comment gets a conversation comment that quotes
   it:

   ```console
   gh api -X POST repos/eugeniastrelkova/ai-workshop-start/pulls/<number>/comments/<id>/replies \
     -f body=$'Done in <sha>: <what changed>.\n<!-- atlas:answered review-comment/<id> -->'
   gh pr comment <number> --body $'> <quoted line>\n\nDone in <sha>: <what changed>.\n<!-- atlas:answered review/<id> -->'
   ```

A red check gets fixed the same way, with no reply. After three pushes that leave the same check
red, stop and leave one comment for a person instead.

## The automation

In the Air web view, for this repository:

- **Trigger:** a schedule, every 15 minutes. Comments do not fire GitHub triggers in Air.
- **Changes:** update the source branch, never a new pull request.
- **Prompt:** *For every open pull request in this repository, follow
  `.agents/skills/address-review/SKILL.md`: skip the ones you do not own yet, and do one pass on
  the rest. Report what you answered and pushed.*

A run that finds nothing waiting says so in one line and ends.
