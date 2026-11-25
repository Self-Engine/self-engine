# Triage Labels

The skills speak in terms of five canonical triage roles. This repo uses the canonical label strings unchanged: the role name _is_ the label. All five exist in `Self-Engine/self-engine`; apply them, never create variants.

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

- `wayfinder:map` and `wayfinder:<type>` (`grilling`, `research`, `prototype`, `task`): the map of a large effort and its decision tickets ([Mapping a large effort](workflow.md#mapping-a-large-effort)). They carry no other label, because they hold a question and nothing to build.

- `size:*`: the size of a pull request, set by the `PR size` workflow from the lines it changes, without tests, lockfiles and translation catalogs. Each pull request carries one: `size:XS` (0-9), `size:S` (10-29), `size:M` (30-99), `size:L` (100-499), `size:XL` (500-999), `size:XXL` (1,000+). `size:XXL` starts CodeRabbit's review and requires an app check before the merge ([Large pull requests](workflow.md#large-pull-requests)).

There are no `agent:*`, `area:*` or `risk:*` labels yet. An agent marks work in progress with an issue comment instead of a label. Add such labels only when the issue volume calls for them, and record them here.
