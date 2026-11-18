import { DataProvider, clearanceQueryFor, type PortAccess } from "@self-engine/data-client/react";
import { changingAnswers, fixedAnswers } from "@self-engine/data-client/testing";
import { referenced } from "@self-engine/db/schema";
import type { Meta, StoryObj } from "@storybook/react-vite";
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

function portForStory() {
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
            delete: {
              state: "blocked",
              reasons: [
                {
                  code: "referenced",
                  table,
                  row: CREATED.id,
                  details: { tables: [{ table: "example_links", count: 2 }] },
                },
              ],
            },
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
    async call(module, entry, input, signal) {
      calls.push({ entry, input });
      await held.promise;
      return port.access.call(module, entry, input, signal);
    },
  };
  return {
    access,
    calls,
    release: () => held.resolve(),
    change: () => port.change(fixed, [table]),
  };
}

function EntryForm({
  onCancel,
  onArchive,
  onDelete,
}: {
  readonly onCancel: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
}) {
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
      clearance={clearance}
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
}
const meta = {
  title: "Forms/Example form/Clearance",
  loaders: [
    loadStoryShell,
    (): Loaded => ({ port: portForStory(), onArchive: fn(), onDelete: fn() }),
  ],
  render: (_args, { loaded }) => {
    const { port, onArchive, onDelete } = loaded as Loaded;
    return (
      <DataProvider access={port.access}>
        <StoryDrawer>
          {({ onCancel }) => (
            <EntryForm onCancel={onCancel} onArchive={onArchive} onDelete={onDelete} />
          )}
        </StoryDrawer>
      </DataProvider>
    );
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

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

    // Measure relative to the animated drawer so its opening transition is outside the check.
    const layout = () => {
      const drawerX = drawer.getBoundingClientRect().x;
      return [title, archive, remove, live].map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return [x - drawerX, y, width, height];
      });
    };
    const before = layout();
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
    await expect(layout()).toEqual(before);
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
