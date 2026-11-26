// Where the focus goes when the Edit Drawer closes (ADR 0041), for any module: its page marks the
// control that stands for each entry and its drawer reports what it created. The page here keeps
// its rows in a list of the story's own, which the story changes as a reload after a save would,
// at the moment it chooses: before or after the drawer has closed.

import { Select } from "@mantine/core";
import type { Meta } from "@storybook/react-vite";
import { closed, settled } from "@self-engine/ui/story-surfaces";
import { useState, useSyncExternalStore } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { FOCUS_HOLD_MS } from "./edit-drawer-focus.ts";
import {
  editDrawerEntries,
  type EditDrawerProps,
  Shell,
  type ShellContribution,
  type ShellProps,
  useUnsavedChanges,
  useWriteViewSearch,
} from "./index.ts";
import {
  drawerOverlay,
  ENTRIES,
  pressEscape,
  shellMeta,
  type Story,
  storyRouting,
} from "./shell-story-helpers.tsx";
import { answer } from "./story-interactions.ts";

const meta = {
  ...shellMeta,
  title: "Shell/Edit drawer focus",
  component: Shell,
} satisfies Meta<ShellProps>;
export default meta;

/** The rows of the page, which the story changes as the View's Query would after a save. */
function rowsOfTheStory(initial: readonly string[]) {
  let rows = initial;
  const listeners = new Set<() => void>();
  const set = (next: readonly string[]) => {
    rows = next;
    for (const listener of listeners) listener();
  };
  return {
    rows: () => rows,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add: (row: string) => set([...rows, row]),
    remove: (row: string) => set(rows.filter((each) => each !== row)),
  };
}

let list = rowsOfTheStory([]);

const storyEntries = editDrawerEntries<string>();

/** A View with a control above its rows, as most Views have: the fixed place. */
function Page() {
  const rows = useSyncExternalStore(list.subscribe, list.rows);
  const write = useWriteViewSearch();
  return (
    <>
      <button>Filter</button>
      <button onClick={() => write((search) => ({ ...search, edit: "new" }))}>New entry</button>
      <ul>
        {rows.map((row) => (
          <li key={row}>
            <button
              {...storyEntries.control(row)}
              onClick={() => write((search) => ({ ...search, edit: row }))}
            >
              Entry {row}
            </button>
          </li>
        ))}
      </ul>
      <button>After the list</button>
    </>
  );
}

/** A form that creates "created" or saves the entry it edits, and holds a draft. */
function Editor({ id, onCancel, onDone, onCreated }: EditDrawerProps<string>) {
  const [draft, setDraft] = useState("");
  useUnsavedChanges(() => draft !== "");
  return (
    <>
      <input aria-label="Draft" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <button onClick={onCancel}>Cancel</button>
      {id === "new" ? (
        <button onClick={() => onCreated("created")}>Create</button>
      ) : (
        <button onClick={onDone}>Save</button>
      )}
    </>
  );
}

const MODULE: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({ default: Editor }),
};

interface Run {
  readonly routing: ReturnType<typeof storyRouting>;
}

/** A routing and rows of their own for each run, so that a replay starts as the first run did. */
const focusStory = (
  play: (run: Run) => Promise<void>,
  { rows = ["a", "b"], edit }: { readonly rows?: readonly string[]; readonly edit?: string } = {},
): Story => ({
  args: { activeModule: MODULE, children: <Page /> },
  loaders: [
    (): Run => {
      list = rowsOfTheStory(rows);
      return { routing: storyRouting(edit === undefined ? {} : { edit }) };
    },
  ],
  render: (args, { loaded }) => <Shell {...args} routing={(loaded as Run).routing} />,
  play: ({ loaded }) => play(loaded as Run),
});

const drawer = async () => within(await settled(screen.findByRole("dialog", { name: "Time" })));
const drawerGone = () => closed(() => screen.queryByRole("dialog", { name: "Time" }));
const row = (name: string) => screen.findByRole("button", { name: `Entry ${name}` });
const fixedPlace = () => screen.getByRole("button", { name: "Filter" });

/** What has the focus, as a person would name it, for a failure that says where it went. */
function focused(): string {
  const element = document.activeElement;
  if (element === null || element === document.body) return "the page";
  return `${element.tagName.toLowerCase()} "${element.textContent}"`;
}

/** Until `element` has the focus, and still has it once the drawer has left. */
async function focusIsOn(element: HTMLElement) {
  await waitFor(() => expect(element, `the focus is on ${focused()}`).toHaveFocus());
  await drawerGone();
  await expect(element, `the focus is on ${focused()}`).toHaveFocus();
}

const opensFromItsRow = async () => {
  const opener = await row("b");
  await userEvent.click(opener);
  return { opener, drawer: await drawer() };
};

/** One way out of the drawer, from inside it. */
type Exit = (opened: Awaited<ReturnType<typeof drawer>>) => Promise<void>;

const backToTheRow = (exit: Exit) =>
  focusStory(async () => {
    const { opener, drawer: opened } = await opensFromItsRow();
    await exit(opened);
    await focusIsOn(opener);
  });

export const EscReturnsTheFocusToTheRowThatOpenedTheDrawer = backToTheRow(pressEscape);
export const CancelReturnsTheFocusToTheRowThatOpenedTheDrawer = backToTheRow((opened) =>
  userEvent.click(opened.getByRole("button", { name: "Cancel" })),
);
export const TheCloseButtonReturnsTheFocusToTheRowThatOpenedTheDrawer = backToTheRow((opened) =>
  userEvent.click(opened.getByRole("button", { name: "Close editor" })),
);
export const AClickOnTheOverlayReturnsTheFocusToTheRowThatOpenedTheDrawer = backToTheRow(() =>
  userEvent.click(drawerOverlay()),
);
export const ASaveReturnsTheFocusToTheRowThatOpenedTheDrawer = backToTheRow((opened) =>
  userEvent.click(opened.getByRole("button", { name: "Save" })),
);
export const DiscardReturnsTheFocusToTheRowThatOpenedTheDrawer = backToTheRow(async (opened) => {
  await userEvent.type(opened.getByRole("textbox", { name: "Draft" }), "typed");
  await pressEscape();
  await answer("Discard");
});

/** No control opened it: the focus goes to the entry's row. */
export const AnEntryOpenedByItsAddressGivesTheFocusToItsRow = focusStory(
  async () => {
    await drawer();
    await pressEscape();
    await focusIsOn(await row("b"));
  },
  { edit: "b" },
);

/**
 * The row of a new entry appears only when the View's Query has reloaded, here after the drawer
 * left: the focus waits on the View's first control meanwhile, then moves to the row, and Tab goes
 * on from there.
 */
export const ACreatedEntryTakesTheFocusOnceItsRowAppears = focusStory(async () => {
  await userEvent.click(screen.getByRole("button", { name: "New entry" }));
  await userEvent.click((await drawer()).getByRole("button", { name: "Create" }));
  await focusIsOn(fixedPlace());
  list.add("created");
  await waitFor(async () => expect(await row("created")).toHaveFocus());
  await userEvent.tab();
  await expect(screen.getByRole("button", { name: "After the list" })).toHaveFocus();
});

/** A row already there when the drawer closes takes the focus at once. */
export const ACreatedEntryListedBeforeTheDrawerClosesTakesTheFocus = focusStory(async () => {
  await userEvent.click(screen.getByRole("button", { name: "New entry" }));
  const create = (await drawer()).getByRole("button", { name: "Create" });
  list.add("created");
  await userEvent.click(create);
  await focusIsOn(await row("created"));
});

/** A View that never shows the new entry, such as one whose filter hides it, keeps the fixed place. */
export const ACreatedEntryTheViewDoesNotShowLeavesTheFocusOnTheFirstControl = focusStory(
  async () => {
    await userEvent.click(screen.getByRole("button", { name: "New entry" }));
    await userEvent.click((await drawer()).getByRole("button", { name: "Create" }));
    await focusIsOn(fixedPlace());
    // After the wait has ended, a row that appears no longer takes the focus.
    await new Promise((resolve) => setTimeout(resolve, FOCUS_HOLD_MS));
    list.add("created");
    await row("created");
    await expect(fixedPlace()).toHaveFocus();
  },
);

/** The Shell never takes the focus back from where the person moved it. */
export const ARowThatAppearsAfterThePersonMovedTheFocusLeavesItThere = focusStory(async () => {
  await userEvent.click(screen.getByRole("button", { name: "New entry" }));
  await userEvent.click((await drawer()).getByRole("button", { name: "Create" }));
  await focusIsOn(fixedPlace());
  await userEvent.tab();
  const moved = screen.getByRole("button", { name: "New entry" });
  await expect(moved).toHaveFocus();
  list.add("created");
  await row("created");
  await expect(moved).toHaveFocus();
});

/**
 * The entry left the View, as after a delete or an archive, once the drawer had closed: the
 * focus leaves its row for the View's first control.
 */
export const AnEntryThatLeavesTheViewLeavesTheFocusOnTheFirstControl = focusStory(async () => {
  const { opener, drawer: opened } = await opensFromItsRow();
  await userEvent.click(opened.getByRole("button", { name: "Save" }));
  await focusIsOn(opener);
  list.remove("b");
  await waitFor(() => expect(fixedPlace()).toHaveFocus());
});

/** The same when the row is gone already as the drawer closes. */
export const AnEntryGoneBeforeTheDrawerClosesLeavesTheFocusOnTheFirstControl = focusStory(
  async () => {
    const { drawer: opened } = await opensFromItsRow();
    list.remove("b");
    await userEvent.click(opened.getByRole("button", { name: "Save" }));
    await focusIsOn(fixedPlace());
  },
);

/**
 * The control that opened the drawer was disabled while the drawer was open, and it is the
 * entry's own control as well: neither can take the focus, so the View's first control does.
 */
export const ADisabledOpenerIsPassedOver = focusStory(async () => {
  const { opener } = await opensFromItsRow();
  opener.setAttribute("disabled", "");
  await pressEscape();
  await focusIsOn(fixedPlace());
});

/** A disabled control is not the fixed place, whatever its `tabindex`: the next control is. */
export const ADisabledFirstControlIsPassedOver = focusStory(async () => {
  const { drawer: opened } = await opensFromItsRow();
  const first = fixedPlace();
  first.setAttribute("disabled", "");
  first.setAttribute("tabindex", "0");
  list.remove("b");
  await userEvent.click(opened.getByRole("button", { name: "Save" }));
  await focusIsOn(screen.getByRole("button", { name: "New entry" }));
});

function PageWithAFilterFirst() {
  return (
    <>
      <Select aria-label="Filter by project" data={["All", "Website"]} searchable value="All" />
      <button>Next week</button>
    </>
  );
}

/**
 * A field that opens its list as soon as it takes the focus is not the fixed place: the next
 * control is, and no list opens over the page.
 */
export const AFieldThatOpensItsListOnFocusIsPassedOver: Story = {
  args: { activeModule: MODULE, children: <PageWithAFilterFirst /> },
  loaders: [(): Run => ({ routing: storyRouting({ edit: "b" }) })],
  render: (args, { loaded }) => <Shell {...args} routing={(loaded as Run).routing} />,
  play: async () => {
    await drawer();
    await pressEscape();
    await focusIsOn(screen.getByRole("button", { name: "Next week" }));
    await expect(screen.queryByRole("listbox")).toBeNull();
    // The field itself opens its list on the focus, which is what the Shell avoids.
    screen.getByRole("combobox", { name: "Filter by project" }).focus();
    await expect(await screen.findByRole("listbox")).toBeVisible();
  },
};

function PageWithoutControls() {
  return <p>Nothing to do here</p>;
}

/** A View without any control takes the focus itself, until the focus leaves it. */
export const AViewWithoutAControlTakesTheFocusItself: Story = {
  args: { activeModule: MODULE, children: <PageWithoutControls /> },
  loaders: [(): Run => ({ routing: storyRouting({ edit: "b" }) })],
  render: (args, { loaded }) => <Shell {...args} routing={(loaded as Run).routing} />,
  play: async () => {
    await drawer();
    await pressEscape();
    const view = screen.getByText("Nothing to do here").parentElement!;
    await focusIsOn(view);
    await userEvent.tab();
    await expect(view).not.toHaveFocus();
    await expect(view).not.toHaveAttribute("tabindex");
  },
};

/** Something outside the drawer that has the focus as it closes keeps it. */
export const AControlOutsideTheDrawerKeepsTheFocus = focusStory(async ({ routing }) => {
  await opensFromItsRow();
  const outside = screen.getByRole("button", { name: "After the list" });
  outside.focus();
  routing.address.writeSearch(({ edit: _edit, ...search }) => search);
  await drawerGone();
  await expect(outside).toHaveFocus();
});
