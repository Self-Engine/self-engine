# Use a module’s port in its Views

Use this guide when a module’s Views, drawers or Commands read or change its data. It starts
where [the port guide](port-pattern.md) ends: the module has a Contract, a Storage with
`reads` on every Query, and is mounted in the app contract and in the desktop app’s module
list. [ADR 0021](../adr/0021-the-page-reloads-a-query-after-a-table-change-through-one-building-block.md)
records the binding parts. The template is
[`placeholder-alpha`](../../packages/placeholder-alpha/src/): `port.ts` builds its hooks,
`entries.tsx` is a list, `edit-drawer.tsx` a form, `delete-with-undo.tsx` delete with undo,
`add-sample-entry.ts` a Command, `testing/` its Fixed Answers and `port.test.ts` its end-to-end
test.

The terms are the glossary’s: a _Query_ reads, an _Operation_ changes data, a _Table Change_
says which tables a commit changed, and a _Fixed Answer_ is what an entry returns in a story.

## 1. Build the hooks in one file

All hooks come from `portHooks` in `@self-engine/data-client/react`, the building block. It is
the only code that imports the query library; the boundary check
`query-library-only-through-building-block` rejects `@tanstack/react-query` anywhere else.
Add `@self-engine/data-client` to the module’s `package.json` and `"data-client"` to its entry in
`ALLOWED_IMPORTS` in `.dependency-cruiser.ts`.

Write one line per hook, in one file next to the Views
([`port.ts`](../../packages/placeholder-alpha/src/port.ts)):

```ts
import { msg } from "@lingui/core/macro";
import { portHooks } from "@self-engine/data-client/react";
import type { z } from "zod";
import type { entrySchema, placeholderAlphaContract } from "./contracts/index.ts";

const alphaPort = portHooks<typeof placeholderAlphaContract>("placeholderAlpha");

export type Entry = z.output<typeof entrySchema>;

const nameTaken = {
  conflicts: {
    name_taken: { text: msg`An entry with this name already exists.`, field: "name" },
  },
} as const;

export const useEntries = alphaPort.query("list");
export const useCreateEntry = alphaPort.operation("create", nameTaken);
export const useRenameEntry = alphaPort.operation("rename", nameTaken);
export const useDeleteEntry = alphaPort.operation("delete");
export const createEntry = alphaPort.run("create", nameTaken); // for Commands, step 5
```

- **Import the Contract as a type only** (`import type`). Its schemas then never load in the
  app; only story and test code loads them (step 6).
- **The string is the mount name**: the module’s key in the app contract and in
  `apps/desktop/src/data-modules.ts`, the same as `name` in `defineStorageModule`.
- **Entry names, inputs and answers are typed from the Contract.** A misspelled entry or a
  wrong input does not compile.
- **Name no tables.** Which tables a Query reads comes from its `reads` on the data side (port
  guide, step 3). The Data Process sends the list of every Query’s tables when the page
  connects, and the building block takes it from there.
- **Pick the right kind.** `query` for a Query entry, `operation` for an Operation entry. A
  Query hook on an Operation entry is reported once in the dev build’s console: “The Query hook
  for placeholderAlpha.create points at an Operation; use an Operation hook.”
- **Keep the hooks inside the module.** Export them from `port.ts` to the module’s own files
  only. Add a React entry to the package’s `exports` only when another module needs one of the
  hooks.

The hooks need a `DataProvider` above them. The app mounts one around the router
(`apps/web/src/main.tsx`) with the access `startPageData` returns: in the desktop app the real
connection’s (`portAccessOf(dataConnection)`). The web app has no Data Process yet: its
connection stops at startup, the page shows that the data cannot be reached, without a retry,
and its access is `NO_DATA_PROCESS`, whose every call fails at once (D263). A module never
mounts a provider itself, except in a story or test.

Every Notice of the building block goes through one seam, the provider’s `notify`: by default
the feedback system shows it, translated while it is on screen; a story or test passes its own
to collect them.

## 2. Read with a Query hook

A Query hook takes the entry’s input and returns the state of its answer:

| `status`       | Fields                     | Meaning                                                           |
| -------------- | -------------------------- | ----------------------------------------------------------------- |
| `loading`      | none                       | The first answer has not arrived.                                 |
| `loadFailed`   | `error`, `retry()`         | The first call failed.                                            |
| `content`      | `data`                     | The answer. It stays valid until a Table Change names its tables. |
| `reloading`    | `data`                     | A reload is running; the previous answer stays until the new one. |
| `reloadFailed` | `data`, `error`, `retry()` | The reload failed; the previous answer stays.                     |

Hand the state to `QueryStateBlock` from `@self-engine/ui` and draw the answer in its child
function ([`entries.tsx`](../../packages/placeholder-alpha/src/entries.tsx)):

```tsx
export default function Entries() {
  return (
    <QueryStateBlock state={useEntries(ALL_ENTRIES)}>
      {(entries) => <EntryList entries={entries} />}
    </QueryStateBlock>
  );
}
```

`QueryStateBlock` shows the same thing in every View: during the first load the existing
loading state, but only after its 200 ms delay, so a fast answer flashes nothing; after a failed
first load the error state with “Try again” and no Notice; once an answer is there, always the
answer, with no loading display during a reload. When a reload fails, the building block shows a
Notice once that what the user sees may be outdated. Draw the empty case inside the child
function, as `EntryList` does with `EmptyState`.

What reloads, and when, is the building block’s job, the same for every module:

- After a commit the Data Process sends a Table Change. A Query on screen whose declared tables
  meet the changed tables reloads at once. One off screen is only marked and reloads when it is
  shown again, showing its previous answer meanwhile.
- After the connection to the Data Process is lost and comes back, every answer is marked.
- A Table Change or reconnect that arrives during a Query's first load makes it read once more
  after that load: the first answer may predate the change.
- Window focus, the network state and elapsed time reload nothing. An answer no View shows is
  dropped after 5 minutes.
- Answers are kept by module, entry and input. Two Views that call the same hook with equal
  input share one answer: the edit drawer finds its entry in the list’s answer instead of
  reading a `get` entry.
- After a reload, every row that did not change is still the same object as before (step 4
  depends on it).

Never reload by hand after an Operation, and never write a table name in the page. If a list
shows old data after a change, a table is missing from the Query’s `reads`; the contract kit
should have caught it (port guide, step 6).

## 3. Change data with an Operation hook

An Operation hook returns `{ run, running }`. `run(input)` resolves with a result and never
rejects:

| `status`     | Fields                    | The building block’s Notice                                   |
| ------------ | ------------------------- | ------------------------------------------------------------- |
| `success`    | `data`                    | none                                                          |
| `conflict`   | `reason`, `field`, `text` | none: show `text` at `field`; `text` when `field` is `null`   |
| `notFound`   | none                      | “This entry no longer exists.”, unless the module replaces it |
| `unexpected` | `error`                   | “Something went wrong, and the change was not saved.”         |

`running` is true while any call of this hook instance waits for its result; use it to lock the
submit button and the fields, since what is typed during a save is lost when the drawer closes.
A call through the same entry in another component does not set it. After
`success`, do nothing about the lists: the Table Change of the commit reloads them.

**Conflict texts.** For each conflict reason the Contract entry declares, the hook needs a
translated text (a `msg` descriptor) and the input field it belongs to. The types demand
exactly one per reason: a missing or an extra reason does not compile, nor does leaving out the
handling for an entry with a conflict, nor a `field` that is not a key of the input, nor leaving
out `field`. An entry without a conflict takes no handling (`alphaPort.operation("delete")`). A
conflict reason arriving without a text counts as unexpected.

**A form** shows the conflict at its field and keeps the drawer open
([`edit-drawer.tsx`](../../packages/placeholder-alpha/src/edit-drawer.tsx)):

```tsx
const { t, i18n } = useLingui();
const rename = useRenameEntry();
const [conflict, setConflict] = useState<MessageDescriptor>();
const save = async () => {
  const result = await rename.run({ id: entry.id, name: draft });
  if (result.status === "success" || result.status === "notFound") onDone();
  else if (result.status === "conflict") setConflict(result.text);
  // unexpected: the Notice is shown, the drawer stays open with the input
};
// <TextInput error={conflict && i18n._(conflict)} readOnly={rename.running} … />
// <Button disabled={draft === ""} loading={rename.running} onClick={() => void save()}>
```

Translate the text where it is shown (`i18n._(text)`), so it follows a language switch.
`onDone` after a save that ends once the person has left this entry closes nothing, so it never
closes another entry's drawer.

**A conflict without a field.** Where no field can show it, as for undo or a Command without a
form, state `field: null` (D264). The building block then shows the text as an error Notice
itself, once, and the result still says `conflict`, with `field: null`:

```ts
export const useRestoreEntry = alphaPort.operation("restore", {
  conflicts: {
    name_taken: {
      text: msg`The entry could not come back: another entry has its name now.`,
      field: null,
    },
  },
});
```

Never show a Notice from the module yourself: what the building block lacks is added there.

**Replacing “not found”.** Pass `notFound: (input) => { … }` in the handling to run instead of
the default Notice, where the module knows better. The caller still receives
`{ status: "notFound" }`.

Input checks before saving are up to the form for now; there is no shared form helper yet. The
Data Process checks every input, so an input the Contract rejects comes back as `unexpected`.
The template disables Save while the name is empty for that reason.

## 4. Draw a list so that one changed row redraws one row

A list that writes its rows inline in its `map` draws every row again on each reload: renaming
one of 1,000 entries drew 10,003 components. With these rules it draws the list and the one
changed row ([`entries.tsx`](../../packages/placeholder-alpha/src/entries.tsx)):

1. **A row is its own component, wrapped in `memo`.** A row component without `memo` still runs
   once per row on every list render.
2. **It receives its row object whole**, as the Query hook delivered it: `entry={entry}`, not
   fields picked out, and not a copy made in the list (`{ ...entry }` or a `map` over the answer
   during render). Only the Query hook keeps unchanged rows as the same objects; a copy is new
   on every render.
3. **Every other prop is the same value on every list render**: no inline callbacks and no
   object or array literals. A row may call hooks that hand back stable values, as `EntryRow`
   calls `useWriteViewSearch`. An Operation the row triggers comes from the list as one stable
   function, not from Operation hooks inside each row: each Operation hook observes its
   Operation, so hooks per row would mean two observers per row, 2,000 at 1,000 rows. In the
   template, `useDeleteWithUndo` builds that function once in the list from the `run` of two
   Operation hooks, which stay the same functions.
4. **The key is the row’s id.**

```tsx
<Stack>
  {entries.map((entry) => (
    <EntryRow entry={entry} key={entry.id} onDelete={remove} />
  ))}
</Stack>;

const EntryRow = memo(function EntryRow({ entry, onDelete }: { … }) { … });
```

The gate holds this for the template: the story
`apps/web/src/placeholder-alpha-render-count.stories.tsx` renames one of 1,000 entries and
expects exactly `{ EntryList: 1, EntryRow: 1 }`. It does not check other modules’ lists; measure
yours with `pnpm renders` ([performance checks](performance.md#compare-component-redraws)).

## 5. Call an Operation from a Command

A Command runs outside React and cannot use a hook. Every Command, of every kind, gets in its
context as `data` what the app gives `DataProvider`: the Port access and the notice seam
(`{ access, notify }`, from `useDataAccess()`). Build the Operation’s function form next to its
hook with `run` instead of `operation`; it takes the same handling and returns the same result,
with the same default Notices through the same seam:

```ts
// port.ts: no form to show a taken name at, so the building block shows it (step 3)
export const createSampleEntry = alphaPort.run("create", {
  conflicts: { name_taken: { text: nameTaken.conflicts.name_taken.text, field: null } },
});

// add-sample-entry.ts
export default defineOpenCommand({
  description: "Adds a sample entry. The name is optional.",
  schema: z.object({ name: z.string().min(1).default("Sample entry") }),
  run: ({ name }, { data }) => createSampleEntry(data, { name }),
});
```

A Command for a later agent returns the result as its value, conflict and field included
([`create-named-entry.ts`](../../packages/placeholder-alpha/src/create-named-entry.ts) with
`createEntry`). A story or test that gives a Command its own `data` collects its Notices too.

## 6. Show each state in a story with Fixed Answers

Stories and component tests run without a Data Process. `fixedAnswers` from
`@self-engine/data-client/testing` builds a Port access in which each entry returns what the
story fixes for it:

| Answer              | What the View gets                                                     |
| ------------------- | ---------------------------------------------------------------------- |
| `{ data }`          | The data, checked against the entry’s output schema.                   |
| `"loading"`         | No answer, ever: the story holds the loading state as long as it runs. |
| `"unexpected"`      | A failed call.                                                         |
| `{ conflict: "…" }` | The entry’s conflict with that reason.                                 |
| `"notFound"`        | The entry’s “not found”.                                               |

Each answer is checked when `fixedAnswers` is called, and the story fails naming the entry and,
for data, the field: data the output schema rejects, a reason the entry does not declare,
“not found” for an entry that does not declare it, or an entry the Contract lacks. A View that
calls an entry without an answer fails the story with “No Fixed Answer for …”. Write `data` as
the schema’s input: ids and timestamps are plain strings.

Give the module a `./testing` entry that holds its Contract values, sample rows and one helper,
as [`placeholder-alpha/src/testing/index.ts`](../../packages/placeholder-alpha/src/testing/index.ts)
does:

```ts
const contracts = { placeholderAlpha: placeholderAlphaContract }; // values: schemas load here

export function placeholderAlphaAnswers(answers: PlaceholderAlphaAnswers = {}, options?) {
  return fixedAnswers(contracts, { placeholderAlpha: { ...SUCCEEDING, ...answers } }, options);
}
```

The boundary check `testing-entries-only-in-tests-and-stories` lets only `*.test.*` and
`*.stories.*` files and other `src/testing/` folders import a `./testing` entry, so the schemas
never reach the app. A story of the whole app passes the access to `AppAt`; a story of one View
wraps it in `<DataProvider access={access}>`:

```tsx
export const ATakenNameIsShownAtTheFieldAndTheDrawerStaysOpen: Story = {
  args: { access: placeholderAlphaAnswers({ rename: { conflict: "name_taken" } }) },
  play: async () => {
    /* rename, then the field shows "An entry with this name already exists." */
  },
};
```

Cover each state the View has: rows, empty, slow loading (`"loading"` plus
`holdTimers(LOADER_DELAY_MS)` from `@self-engine/ui/story-timers`), a failed load with retry,
each conflict at its field, and an entry gone while editing
([`placeholder-alpha-entries.stories.tsx`](../../apps/web/src/placeholder-alpha-entries.stories.tsx)).

A Fixed Answer never changes: an Operation returns its answer and changes nothing, and no Table
Change follows. Stories show states, not flows. The one exception is a story that measures what a
change redraws: `changingAnswers(first, queries)` from the same entry switches to the next Fixed
Answers and delivers their Table Change in one step, as the render-count gate does (step 4).
Where no call is meant to reach a Port, pass `NO_DATA_PROCESS` from
`@self-engine/data-client/react`; do not write an inert access of your own.

## 7. Test the flow over the real Data Process

That the list follows an Operation is shown by one test over the real client, building block
and test Data Process, with no fake answers and no clock
([`port.test.ts`](../../packages/placeholder-alpha/src/port.test.ts)):

```ts
const process = await startTestDataProcess({ modules: { placeholderAlpha } });
const connection = createDataConnection();
connection.connect(process.openPort());
// wait until connection.getState().status is "ready", then:
const access = portAccessOf(connection);
const data = { access, notify: (notice) => notices.push(notice) }; // what a Command gets
// render the hooks under <DataProvider access={access} notify={data.notify}>, run each
// Operation, and wait for the render whose Query answer shows the change.
```

A module may not import `data-process` from its code. Add it as a devDependency and to the
module’s entry in `TEST_ONLY_IMPORTS` in `.dependency-cruiser.ts`, which allows it in test and
story files only. That closes no cycle between packages, because the Data Process core knows no
module; the app passes its module list in. Hook tests run under `// @vitest-environment happy-dom`.

Done when the Views read and write only through the module’s hooks, every state has a story,
the flow test passes, and `pnpm verify` ends with `VERIFY: PASS`.
