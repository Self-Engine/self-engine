# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in **`Self-Engine/self-engine`**. Use the `gh` CLI; inside a clone it finds the repo by itself.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json title,body,labels,comments`. `--comments` and `--json` cannot be combined.
- **List issues**: `gh issue list --state open --json number,title,labels`, with `--label` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`, with the labels of [`triage-labels.md`](triage-labels.md).
- **Close**: a pull request body ending in `Closes #<number>` closes the issue on merge. Without a pull request: `gh issue close <number> --comment "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.** `/triage` reads this flag. The repo takes no pull requests from others ([`CONTRIBUTING.md`](../../CONTRIBUTING.md)).

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --json title,body,labels,comments`.

## Wayfinding operations

Used by `/wayfinder`, for [a large effort](workflow.md#mapping-a-large-effort).

- **Map**: one issue labelled `wayfinder:map`, holding the Destination, Notes, Decisions so far, Not yet specified and Out of scope. `gh issue create --label wayfinder:map`.
- **Ticket**: a sub-issue of the map (`gh api` on the sub-issues endpoint), labelled `wayfinder:<type>` (`research`, `prototype`, `grilling` or `task`).
- **Blocking**: GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric database id (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), which differs from its `#number` and its `node_id`. A ticket is unblocked when every blocker is closed: `issue_dependencies_summary.blocked_by` counts the open ones.
- **Frontier**: the map's open sub-issues that have no open blocker and no assignee. The first in map order is next.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then one line with the gist and the link in the map's Decisions so far.
