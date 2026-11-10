# Workflow

Every piece of work takes one path: layer, work package, slice, pull request. A **work package** is an issue without a `## Parent` section. A **slice** is an issue with one. Named skills are the tools for a step; where a skill is missing, the step and its completion criterion still apply.

Finish every step below by [refreshing the overview](#the-overview).

## The path

1. **Grill the layer** (`grilling`). Done when every question of the layer has a decision in `docs/plan/00-decisions.md` and the layer has its document in `docs/plan/`.
2. **Cut work packages** (`to-spec`, `to-tickets`). Done when each package is an issue with `layer:<n>`, a label from [Who may build](#who-may-build), and blockers with smaller numbers only. A layer spec holding the packages as sub-issues carries neither build label. Plan to split a package that would exceed roughly 4,500 new lines.
3. **Grill the package** (`grilling`), when it has `needs-grilling`. Done when no design question of the package is open and each answer is recorded under the next free D number. Read the highest number from `main`: another branch may have taken yours.
4. **Land the decisions.** Open a docs pull request right after the grilling, ahead of the build, so the next grilling can see them. Done when it is merged.
5. **Write the spec** (`to-spec`) into the package issue. Done when the body holds the spec, with its `Problem Statement`.
6. **Cut slices** (`to-tickets`). Done when each slice is a sub-issue with `## Parent`, `layer:<n>` and `ready-for-agent`, and the package has swapped `needs-grilling` for `ready-for-agent`.
7. **Build** (`implement-spec`) on one integration branch for the package, with one branch per slice. Add the package's ADRs and glossary entries here, since they state what the code does. Done when every slice is merged into the integration branch and `pnpm verify` prints `VERIFY: PASS`.
8. **Open one pull request per package** (`pr-convention`), closing the package and its slices. Done when both checks are green and it is merged.

Build work packages in number order. A slice may have a higher number than a later package, because that package depends on the slice's parent.

## Who may build

`ready-for-agent` means an agent may build the issue now. A package gets it without a grilling only if all three hold:

- It has checkable acceptance criteria.
- It sets no pattern other modules follow.
- It leaves no design question open.

Every other package gets `needs-grilling`. Slices cut from a spec are always `ready-for-agent`.

If you find an open design question while building, stop, write the question as a comment on the issue, and swap the label to `needs-grilling`.

## Status

A ticket's status is read from GitHub, first match wins:

| Check                          | Status         |
| ------------------------------ | -------------- |
| Issue is closed                | Built          |
| An open pull request closes it | In review      |
| Has slices                     | Cut            |
| Body has a `Problem Statement` | Specified      |
| Label `needs-grilling`         | Needs grilling |
| Label `ready-for-agent`        | Buildable      |
| None of these                  | Needs triage   |

## The overview

The [overview page](https://claude.ai/artifact/W1AwNvTBPy7Se9Bc2bNA4q) (artifact `eadf2537-2bc0-463a-8042-be244bd96fea`) shows this status for the whole plan. Regenerate it completely from GitHub and publish the result, so that a step someone forgot corrects itself. Merging a pull request counts as a step.

The generator script is not built yet (D156). Until it is, and whenever you cannot publish, state in your report that the overview is behind.
