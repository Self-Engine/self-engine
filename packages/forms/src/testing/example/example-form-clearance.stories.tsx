import {
  type ClearanceQuery,
  DataProvider,
  clearanceQueryFor,
  type PortAccess,
} from "@self-engine/data-client/react";
import { changingAnswers, fixedAnswers } from "@self-engine/data-client/testing";
import { referenced } from "@self-engine/db/schema";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useSyncExternalStore } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { ClearanceAction, EditDrawerForm, TextField, useOperationForm } from "../../index.ts";
import { exampleContract } from "./contract.ts";
import { loadStoryShell, StoryDrawer } from "./drawer-story.tsx";
import { useUpdateExample } from "./port.ts";
import { CREATED, type PortCall } from "./story-port.ts";
import type { ExampleTables } from "./tables.ts";

const table = "example_entries";
const query = clearanceQueryFor<ExampleTables>();
const clearance = query({ table, rows: [CREATED.id], writes: ["delete", "archive"] });
/** The Clearance Query of one row, as the edit form takes it. */
type StoryQuery = ClearanceQuery & { readonly rows: readonly [string] };

type Answer = "blocked" | "free" | "failed";

function portForStory(answer: Answer = "blocked") {
  const fixed = fixedAnswers(
    {},
    {},
    {
      reasons: [referenced],
      clearance: [
        {
          table,
          row: CREATED.id,
          writes: {
            delete:
              answer === "blocked"
                ? {
                    state: "blocked",
                    reasons: [
                      {
                        code: "referenced",
                        table,
                        row: CREATED.id,
                        details: { tables: [{ table: "example_links", count: 2 }] },
                      },
                    ],
                  }
                : { state: "free" },
            archive: { state: "free" },
          },
        },
      ],
    },
  );
  const port = changingAnswers(fixed, {});
  const calls: PortCall[] = [];
  const held = Promise.withResolvers<void>();
  const access: PortAccess = {
    ...port.access,
    async clearance(request, signal) {
      calls.push({ entry: "clearance", input: request });
      await held.promise;
      if (answer === "failed") throw new Error("The Clearance did not answer");
      return port.access.clearance(request, signal);
    },
  };
  return {
    access,
    calls,
    release: () => held.resolve(),
    change: () => port.change(fixed, [table]),
  };
}

/** The Clearance Query the form is given now; a story gives it another, as a drawer may. */
function querySwitch(first: StoryQuery) {
  let current = first;
  const listeners = new Set<() => void>();
  return {
    current: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    change: (next: StoryQuery) => {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

/** Whether the form asks the Clearance; a story turns it off to compare with a form without. */
function clearanceSwitch() {
  let on = true;
  const listeners = new Set<() => void>();
  return {
    on: () => on,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    turnOff: () => {
      on = false;
      for (const listener of listeners) listener();
    },
  };
}

function EntryForm({
  onCancel,
  onArchive,
  onDelete,
  queries,
  asks,
}: {
  readonly onCancel: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
  readonly queries: ReturnType<typeof querySwitch>;
  readonly asks: ReturnType<typeof clearanceSwitch>;
}) {
  const withClearance = useSyncExternalStore(asks.subscribe, asks.on);
  const query = useSyncExternalStore(queries.subscribe, queries.current);
  const form = useOperationForm({
    entry: exampleContract.update,
    operation: useUpdateExample(),
    draft: CREATED,
    edit: { identity: { id: CREATED.id } },
  });
  return (
    <EditDrawerForm
      form={form}
      onCancel={onCancel}
      {...(withClearance && { clearance: query })}
      actions={
        <>
          <ClearanceAction write="archive" onClick={onArchive} variant="subtle">
            Archive
          </ClearanceAction>
          <ClearanceAction write="delete" onClick={onDelete} variant="subtle">
            Delete
          </ClearanceAction>
        </>
      }
    >
      <TextField form={form} label="Title" name="title" />
    </EditDrawerForm>
  );
}

interface Loaded {
  readonly port: ReturnType<typeof portForStory>;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
  readonly queries: ReturnType<typeof querySwitch>;
  readonly asks: ReturnType<typeof clearanceSwitch>;
}
const loadAnswer =
  (answer: Answer, query: StoryQuery = clearance) =>
  (): Loaded => ({
    port: portForStory(answer),
    onArchive: fn(),
    onDelete: fn(),
    queries: querySwitch(query),
    asks: clearanceSwitch(),
  });

const meta = {
  title: "Forms/Example form/Clearance",
  loaders: [loadStoryShell, loadAnswer("blocked")],
  render: (_args, { loaded }) => {
    const { port, onArchive, onDelete, queries, asks } = loaded as Loaded;
    return (
      <DataProvider access={port.access}>
        <StoryDrawer>
          {({ onCancel }) => (
            <EntryForm
              onCancel={onCancel}
              onArchive={onArchive}
              onDelete={onDelete}
              queries={queries}
              asks={asks}
            />
          )}
        </StoryDrawer>
      </DataProvider>
    );
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Where these elements are, relative to the animated drawer so its transition is outside it. */
function layoutOf(drawer: HTMLElement, elements: readonly HTMLElement[]) {
  const drawerX = drawer.getBoundingClientRect().x;
  return elements.map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return [x - drawerX, y, width, height];
  });
}

/** The open drawer's form and its two actions, once they are drawn. */
async function drawnForm() {
  const drawer = await screen.findByRole("dialog", { name: "Example" });
  const canvas = within(drawer);
  const title = await canvas.findByRole("textbox", { name: "Title" });
  return {
    drawer,
    title,
    archive: canvas.getByRole("button", { name: "Archive" }),
    remove: canvas.getByRole("button", { name: "Delete" }),
    live: canvas.getByRole("status"),
  };
}

export const ABlockedDeleteExplainsWhy: Story = {
  play: async ({ loaded, globals }) => {
    const { port, onArchive, onDelete } = loaded as Loaded;
    const drawer = await screen.findByRole("dialog", { name: "Example" });
    const canvas = within(drawer);
    const title = await canvas.findByRole("textbox", { name: "Title" });
    const remove = canvas.getByRole("button", { name: "Delete" });
    const archive = canvas.getByRole("button", { name: "Archive" });
    const live = canvas.getByRole("status");
    await expect(live).toBeEmptyDOMElement();
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(remove);
    await expect(onDelete).not.toHaveBeenCalled();
    await userEvent.type(title, " extension");
    await expect(title).toHaveValue("Kitchen extension");
    await expect(port.calls).toEqual([{ entry: "clearance", input: clearance }]);

    // Nothing is reserved while nothing is blocked: the live region is there, without height.
    await expect(live.getBoundingClientRect().height).toBe(0);
    const before = layoutOf(drawer, [title, archive, remove]);
    port.release();
    const reason =
      globals.language === "de"
        ? "Lässt sich nicht löschen: 2 Einträge verweisen darauf."
        : "Cannot be deleted: 2 entries refer to it.";
    await waitFor(() => expect(live).toHaveTextContent(reason));
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAccessibleDescription(reason);
    await expect(archive).toBeEnabled();
    // The text takes its room from the free space above the footer: fields and footer stay.
    await expect(layoutOf(drawer, [title, archive, remove])).toEqual(before);
    await expect(live.getBoundingClientRect().height).toBeGreaterThan(0);
    await userEvent.click(archive);
    await expect(onArchive).toHaveBeenCalledOnce();
    port.change();
    await userEvent.type(title, "!");
    await expect(port.calls).toEqual([{ entry: "clearance", input: clearance }]);
  },
};

export const ABlockedDeleteInGerman: Story = {
  ...ABlockedDeleteExplainsWhy,
  globals: { language: "de" },
};

export const NothingBlockedLooksAsWithoutClearance: Story = {
  loaders: [loadStoryShell, loadAnswer("free")],
  play: async ({ loaded }) => {
    const { port, asks } = loaded as Loaded;
    const { drawer, title, archive, remove, live } = await drawnForm();
    const before = layoutOf(drawer, [title, archive, remove, live]);
    port.release();
    await waitFor(() => expect(remove).not.toHaveAttribute("aria-disabled"));

    await expect(remove).toBeEnabled();
    await expect(layoutOf(drawer, [title, archive, remove, live])).toEqual(before);
    await expect(live).toBeEmptyDOMElement();
    await expect(live.getBoundingClientRect().height).toBe(0);

    // The same form without a Clearance: its fields and actions stand where they stood.
    const free = layoutOf(drawer, [title, archive, remove]);
    asks.turnOff();
    const canvas = within(drawer);
    await waitFor(() => expect(canvas.queryByRole("status")).toBeNull());
    await expect(
      layoutOf(drawer, [
        canvas.getByRole("textbox", { name: "Title" }),
        canvas.getByRole("button", { name: "Archive" }),
        canvas.getByRole("button", { name: "Delete" }),
      ]),
    ).toEqual(free);
  },
};

export const AWriteAskedTwiceIsExplainedOnce: Story = {
  loaders: [
    loadStoryShell,
    loadAnswer("blocked", query({ table, rows: [CREATED.id], writes: ["delete", "delete"] })),
  ],
  play: async ({ loaded }) => {
    const { port } = loaded as Loaded;
    const { remove, live } = await drawnForm();
    port.release();
    await waitFor(() => expect(remove).toBeDisabled());

    await expect(live.childElementCount).toBe(1);
    await expect(live).toHaveTextContent(/^Cannot be deleted: 2 entries refer to it\.$/);
  },
};

export const AFailedClearanceLeavesTheActionsToTheWrite: Story = {
  loaders: [loadStoryShell, loadAnswer("failed")],
  play: async ({ loaded }) => {
    const { port, onDelete } = loaded as Loaded;
    const { remove } = await drawnForm();
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    port.release();

    // The write still asks the rules: a failed Clearance locks nothing.
    await waitFor(() => expect(remove).not.toHaveAttribute("aria-disabled"));
    await expect(remove).toBeEnabled();
    await userEvent.click(remove);
    await expect(onDelete).toHaveBeenCalledOnce();
  },
};

const deleteOnly = query({ table, rows: [CREATED.id], writes: ["delete"] });

export const AnActionTheOpeningDidNotAskAboutIsUsableWhileTheAnswerWaits: Story = {
  loaders: [loadStoryShell, loadAnswer("blocked", deleteOnly)],
  play: async ({ loaded }) => {
    const { port, onArchive, onDelete, queries } = loaded as Loaded;
    const { archive, remove, live } = await drawnForm();
    // The drawer now presents a write its opening did not ask about, such as after a change.
    queries.change(clearance);
    await expect(port.calls).toEqual([{ entry: "clearance", input: deleteOnly }]);

    await userEvent.click(archive);
    await expect(onArchive).toHaveBeenCalledOnce();
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(remove);
    await expect(onDelete).not.toHaveBeenCalled();

    // The answer explains only what the opening asked.
    port.release();
    await waitFor(() => expect(remove).toBeDisabled());
    await expect(archive).toBeEnabled();
    await expect(live).toHaveTextContent(/^Cannot be deleted: 2 entries refer to it\.$/);
  },
};
