---
name: status-update
description: How to post a status update for Skill Atlas — the pull requests merged and the issues resolved since a date and time, as one message in the private Slack channel #ai-test-channel.
---

# Status update

One message, in `#ai-test-channel`: every pull request merged and every issue resolved since a date
and time. Nothing else goes in it, and it is never split across messages.

## Since when

The update starts from a date and time. Write it as ISO 8601 in UTC — `2026-10-14T09:00:00Z` — and
use that one value everywhere below as `<since>`. A date with no time means 00:00 UTC. No date at
all: ask, do not guess.

## Merged pull requests

Merged only: a pull request closed without merging is not in the update.

```console
gh pr list --repo eugeniastrelkova/ai-workshop-start --state merged \
  --search "merged:>=<since>" --json number,title,url,author,mergedAt --limit 200
```

Without `gh`:

```console
curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/search/issues?q=repo:eugeniastrelkova/ai-workshop-start+is:pr+is:merged+merged:>=<since>&sort=created&order=asc&per_page=100"
```

## Resolved issues

Closed as completed only: an issue closed as *not planned* or as a duplicate is not resolved.

```console
gh issue list --repo eugeniastrelkova/ai-workshop-start --state closed \
  --search "closed:>=<since> reason:completed" --json number,title,url,closedAt --limit 200
```

Without `gh`:

```console
curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/search/issues?q=repo:eugeniastrelkova/ai-workshop-start+is:issue+is:closed+reason:completed+closed:>=<since>&per_page=100"
```

In the search API the `+` between qualifiers stands for a space; the `:` and `>=` can stay as they
are. A `total_count` above 100 means another page: add `&page=2`. With no `GITHUB_TOKEN`, leave the
`Authorization` header out: the search works anonymously, at a lower rate limit.

## The message

Slack mrkdwn, oldest first in each section, a section with nothing in it reads `none`:

```
*Skill Atlas — since <since>*

*Merged pull requests (<N>)*
• <<url>|#<number> <title>> — @<author>

*Resolved issues (<M>)*
• <<url>|#<number> <title>>
```

In a title, write `&` as `&amp;`, `<` as `&lt;` and `>` as `&gt;`, or Slack reads them as markup.

## Posting

Build the JSON with `node` (there is no `jq` here), so quotes and newlines in titles cannot break
it, then post it:

```console
payload=$(TEXT="$text" node -p 'JSON.stringify({channel: "#ai-test-channel", text: process.env.TEXT, unfurl_links: false})')
curl -fsS -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H "Content-Type: application/json; charset=utf-8" \
  -d "$payload" https://slack.com/api/chat.postMessage
```

Slack answers HTTP 200 even when it fails: the post worked only if the reply has `"ok": true`.

`#ai-test-channel` is private, so the bot sees it only as a member. `not_in_channel` or
`channel_not_found` means it is not one: ask a person to `/invite` the bot there, and do not retry
or post to another channel. If the name itself is refused, look the channel up by name and post to
its ID instead:

```console
curl -fsS -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.list?types=private_channel&limit=1000"
```

## Done

Report in one line: the two counts and the link to the message, the `permalink` in the reply to

```console
curl -fsS -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/chat.getPermalink?channel=<channel>&message_ts=<ts>"
```

with `channel` and `ts` from the reply to `chat.postMessage`.
