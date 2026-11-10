# Triage Labels

The skills speak in terms of five canonical triage roles. This repo uses the canonical label strings unchanged: the role name _is_ the label. All five exist in `Self-Engine/self-engine-next`; apply them, never create variants.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Adjacent labels

- `layer:<n>`: the build layer the issue belongs to (`layer:0` = repo foundation). Create the label for a new layer when its issues are filed.
- `needs-grilling`: the issue is a work package that needs a grilling and a spec before an agent may build it. It replaces `ready-for-agent` until the spec exists. `ready-for-agent` means only that an agent may build the issue now.

There are no `agent:*`, `area:*`, `size:*` or `risk:*` labels yet. An agent marks work in progress with an issue comment instead of a label. Add such labels only when the issue volume calls for them, and record them here.
