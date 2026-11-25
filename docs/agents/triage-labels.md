# Triage Labels

The skills name five triage roles. In this repo the role name is the label. The labels on this page are all the tracker has: apply these.

| Label             | Meaning                                  |
| ----------------- | ---------------------------------------- |
| `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human` | Requires human implementation            |
| `wontfix`         | Will not be actioned                     |

## Adjacent labels

- `layer:<n>`: the build layer the issue belongs to (`layer:0` = repo foundation). Create the label for a new layer when its issues are filed.
- `needs-grilling`: the issue is a work package that needs a grilling and a spec before an agent may build it. It replaces `ready-for-agent` until the spec exists. `ready-for-agent` means only that an agent may build the issue now.
- `bug`: built behaviour that is wrong, next to the issue's other labels.
- `wayfinder:map` and `wayfinder:<type>` (`grilling`, `research`, `prototype`, `task`): the map of a large effort and its decision tickets ([Mapping a large effort](workflow.md#mapping-a-large-effort)). They carry no other label, because they hold a question and nothing to build.
- `size:*`: the size of a pull request, set by the `PR size` workflow from the lines it changes, without tests, documents, lockfiles and translation catalogs. Each pull request carries one: `size:XS` (0-9), `size:S` (10-29), `size:M` (30-99), `size:L` (100-499), `size:XL` (500-999), `size:XXL` (1,000+). `size:XXL` requires a CodeRabbit review and an app check before the merge ([Large pull requests](workflow.md#large-pull-requests)).
