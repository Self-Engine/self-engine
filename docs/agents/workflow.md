# Workflow

A work package takes one path: layer, work package, slice, pull request. A change that raises no question [for the owner](#sorting-the-questions), such as a fix or a correction to a document, goes straight into a pull request. A **work package** is an issue that is grilled and built as a whole. A **slice** is a sub-issue of a work package, with a `## Parent` section naming it. A **layer spec** holds a layer's work packages as sub-issues and carries neither build label; those packages name it as their parent. Named skills are the tools for a step; where a skill is missing, the step and its completion criterion still apply.

## The path

1. **Grill the layer** (`grilling`), opening with [the sort](#sorting-the-questions). Done when every question on the owner's list has a decision in the [decision log](../plan/00-decisions.md) and the layer has its document in `docs/plan/`.
2. **Cut work packages** (`to-spec`, `to-tickets`). Done when each package is an issue with `layer:<n>`, a label from [Who may build](#who-may-build), and blockers with smaller numbers only. A layer spec holding the packages as sub-issues carries neither build label. Plan to split a package that would exceed roughly 4,500 new lines.
3. **Grill the package** (`grilling`), when it has `needs-grilling`. Read from the [decision log](../plan/00-decisions.md) only the rounds that touch the package, then open with [the sort](#sorting-the-questions). Done when no question on the owner's list is open and the answers are recorded as a new round, as the log describes.
4. **Land the decisions.** Open a docs pull request right after the grilling, ahead of the build, so the next grilling can see them. Done when it is merged.
5. **Write the spec** (`to-spec`) into the package issue. Done when the body holds the spec, with its `Problem Statement` and the questions left for later, each with its proposed answer.
6. **Cut slices** (`to-tickets`). Done when each slice is a sub-issue with `## Parent`, `layer:<n>` and `ready-for-agent`, and the package has swapped `needs-grilling` for `ready-for-agent`.
7. **Build** (`implement-spec`) on one integration branch for the package, with one branch per slice. Add the package's ADRs and glossary entries here, since they state what the code does. Done when every slice is merged into the integration branch and `pnpm verify` prints `VERIFY: PASS`.
8. **Open one pull request per package** (`pr-convention`), closing the package and its slices. Done when both checks are green, it is merged and [the overview](#the-overview) is refreshed.

Build work packages in number order unless the owner picks another. A slice may have a higher number than a later package, because that package depends on the slice's parent.

## Sorting the questions

Every grilling opens with the sort: before the first question, show the owner every design question you see, in two lists.

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

The [overview page](https://claude.ai/artifact/W1AwNvTBPy7Se9Bc2bNA4q) (artifact `eadf2537-2bc0-463a-8042-be244bd96fea`) shows the status of every ticket in the plan. The status is read from GitHub, never kept by hand: `statusOf` in `scripts/plan-overview.ts` holds the rules.

Refresh the page after merging a package's pull request, and when the owner asks: run `pnpm plan:overview`, then publish `.temp/plan-overview.html` to that artifact. Layers without issues come from `docs/plan/roadmap.json`; update it when a layer gets its name or decisions.

When you cannot publish, state in your report that the overview is behind.
