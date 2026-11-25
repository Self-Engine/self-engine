# Workflow

A work package takes one path: layer, work package, slice, pull request. A change that raises no question [for the owner](#sorting-the-questions), such as a fix or a correction to a document, goes straight into a pull request. A **work package** is an issue that is grilled and built as a whole. A **slice** is a sub-issue of a work package, with a `## Parent` section naming it. A **layer spec** holds a layer's work packages as sub-issues and carries neither build label; those packages name it as their parent.

Named skills are the tools for a step; where a skill is missing, the step and its completion criterion still apply. The owner starts a skill written with a slash, such as `/to-spec`, by typing it. When a step is yours and the owner has not typed its command, read that skill's `SKILL.md` in your skills folder, follow it, and say so.

## The path

1. **Grill the layer** (`grill`), opening with [the sort](#sorting-the-questions). Done when every question on the owner's list has its answer in the layer spec, an issue (`/to-spec`).
2. **Cut work packages** (`/to-tickets`). Done when each package is an issue with `layer:<n>`, a label from [Who may build](#who-may-build), and blockers with smaller numbers only. Plan to split a package that would exceed roughly 4,500 new lines.
3. **Grill the package** (`grill`), when it has `needs-grilling`. Done when no question on the owner's list is open and every answer stands in a comment on the package issue.
4. **Write the spec** (`/to-spec`) into the package issue. Done when the body holds the spec, with its `Problem Statement` and the questions left for later, each with its proposed answer.
5. **Cut slices** (`/to-tickets`). Done when each slice is a sub-issue with `## Parent`, `layer:<n>` and `ready-for-agent`, and the package has swapped `needs-grilling` for `ready-for-agent`.
6. **Build** (`/implement-spec`) on one integration branch for the package, with one branch per slice. Write the package's ADRs and glossary entries here, since they state what the code does. Done when every slice is merged into the integration branch and `pnpm verify` prints `VERIFY: PASS`.
7. **Open one pull request per package** (`pr-convention`), closing the package and its slices. Done when both checks are green, the [large pull request](#large-pull-requests) steps are done, it is merged and [the overview](#the-overview) is refreshed.

Build work packages in number order unless the owner picks another. A slice may have a higher number than a later package, because that package depends on the slice's parent.

## Where a decision lives

A decision stands in one place at a time. While nothing is built, that place is the issue it belongs to: the spec, a comment with a grilling's answers, or a ticket's resolution comment. When the build lands, it is the ADR. A code comment that needs a decision names its ADR.

The D-numbered log in [`docs/plan/`](../plan/00-decisions.md) is closed. Code comments and ADRs still name its numbers, so it stays as the place to look up a reason. When your decision replaces one of its entries, name that entry in the issue; the log itself is left as it is.

## Mapping a large effort

An effort too large for one grilling, whose late questions nobody can phrase yet, replaces steps 1 and 2 with a **map** (`/wayfinder`). The map is an issue labelled `wayfinder:map`. Its **tickets** are sub-issues that each hold one question, with a `wayfinder:<type>` label and no label from [Who may build](#who-may-build). [Wayfinding operations](issue-tracker.md#wayfinding-operations) names the commands.

- **One session resolves one ticket.** Take the first open ticket that has no open blocker and no assignee, unless the owner names another. A grilling ticket uses `grill`. A ticket holds only questions that belong [with the owner](#sorting-the-questions), so it needs no sort.
- **The decision lives in the ticket.** Record it as the resolution comment, close the ticket, and add one line to the map.
- **Research that several tickets need** goes into [`docs/research/`](../research/), in English, with its date. It is a snapshot and is not kept current. Delete it when the map is closed.
- **The map ends** when its last ticket has cut the work packages, as step 2 describes. Each package then continues at step 3.

Maps so far: [time tracking beyond layer 4](https://github.com/Self-Engine/self-engine/issues/396).

## Large pull requests

A pull request is **large** when it closes a work package or carries `size:XXL`. The `PR size` workflow gives every pull request one `size:*` label from the lines it changes, without tests, documents, lockfiles and translation catalogs (`scripts/pr-size.ts` counts); `size:XXL` starts CodeRabbit's review (`.coderabbit.yaml`). Before you report a large pull request as ready to merge:

1. **Review.** Once CodeRabbit's walkthrough comment appears, the review runs. If none appears within five minutes of the push, or the pull request is a package below `size:XXL`, comment `@coderabbitai review`.
2. **App check.** While the review runs, a subagent checks the app with the [`verify-desktop`](../../.agents/skills/verify-desktop/SKILL.md) skill, with its window hidden. Put the screenshots that show the change into the body's Evidence. A pull request that changes no code the app runs skips this step and says so.
3. **Findings.** Answer every CodeRabbit comment in its thread: fix it, or say why not. After a fix, run `pnpm verify` again and push; CodeRabbit reviews the new commits itself.

Done when the review has no unanswered comment and the app check passed. Report both to the owner, with the screenshots.

## Sorting the questions

A grilling of a layer or a work package opens with the sort: before the first question, show the owner every design question you see, in two lists.

- **With the owner:** a stored data format, an interface between packages, a pattern other modules will copy, a recorded decision you would change (each is a [working assumption](../../AGENTS.md#decisions)), and anything the correctness of the domain rests on, such as time or money.
- **Later, with a proposal:** every other question, each with the answer you would choose.

The owner moves questions between the lists. Then grill the first list in full depth. The second list goes into the spec: a package grilling sorts it again, and a builder may choose differently from a proposal and says so in the package's pull request.

## Who may build

`ready-for-agent` means an agent may build the issue now. A package gets it without a grilling only if both hold:

- It has checkable acceptance criteria.
- It leaves no question open that belongs [with the owner](#sorting-the-questions).

Every other package gets `needs-grilling`. Slices cut from a spec are always `ready-for-agent`.

If you find a design question while building that belongs [with the owner](#sorting-the-questions), stop, write the question as a comment on the issue, and swap the label to `needs-grilling`. Decide every other question yourself and name it in the package's pull request.

## The overview

The [overview page](https://claude.ai/artifact/W1AwNvTBPy7Se9Bc2bNA4q) (artifact `eadf2537-2bc0-463a-8042-be244bd96fea`) shows the status of every ticket in the plan. The status is read from GitHub, never kept by hand: `statusOf` in `scripts/plan-overview.ts` holds the rules. Its work tree shows who acts next on each open issue (`actorOf`) and in which wave it can start, from the open blockers and slices (`dependencyGraph`).

Refresh the page after merging a package's pull request, and when the owner asks: run `pnpm plan:overview`, then publish `.temp/plan-overview.html` to that artifact. Layers without issues come from `docs/plan/roadmap.json`; update it when a layer gets its name. A map and its tickets are left out, because they hold decisions and nothing to build; the layer's entry in `roadmap.json` names the map.

When you cannot publish, state in your report that the overview is behind.
