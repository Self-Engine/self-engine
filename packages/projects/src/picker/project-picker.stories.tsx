// The project picker in a test form of a module above `projects` (D330), over Fixed Answers
// (D255). The form edits an entry that refers to a project: it hands the picker the entry's
// project reference and binds the picker to its `projectId` through a Field Binding. Each story
// drives the picker as a user does and asserts what it shows and which call reached the Port.

import { oc } from "@orpc/contract";
import { Button, Stack } from "@mantine/core";
import { DataProvider, type PortAccess, portHooks } from "@self-engine/data-client/react";
import { fixedAnswers } from "@self-engine/data-client/testing";
import { OperationFormBody, TextField, useOperationForm } from "@self-engine/forms";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import {
  projectIdSchema,
  type ProjectReference,
  projectReferenceSchema,
  projectsContract,
} from "../contracts/index.ts";
import {
  DOCTORS,
  GARDEN,
  OLD_SITE,
  projectReference,
  type ProjectsAnswers,
  SUCCEEDING,
  TAX,
  WEBSITE,
  WEBSITE_TWIN,
} from "../testing/index.ts";
import { ProjectField } from "./index.tsx";

// An invented module above `projects`: its entries each refer to a project, as a time entry will.
const entrySchema = z.object({
  id: z.string(),
  label: z.string(),
  project: projectReferenceSchema.nullable(),
});
const entriesContract = {
  edit: oc
    .input(
      z.strictObject({
        id: z.string(),
        label: z.string().trim().min(1).optional(),
        projectId: projectIdSchema.nullable().optional(),
      }),
    )
    .output(entrySchema),
};
const useEditEntry = portHooks<typeof entriesContract>("entries").operation("edit");

type Entry = z.output<typeof entrySchema>;

interface EntryFormProps {
  readonly entry: Entry;
  /** The entry's project may be cleared. */
  readonly optional: boolean;
}

/** Edits an entry as a module above writes its form: the reference goes to the picker. */
function EntryForm({ entry, optional }: EntryFormProps) {
  const form = useOperationForm({
    entry: entriesContract.edit,
    operation: useEditEntry(),
    draft: { id: entry.id, label: entry.label, projectId: entry.project?.id ?? null },
    edit: { identity: { id: entry.id } },
  });
  return (
    <OperationFormBody form={form}>
      <Stack>
        <TextField form={form} label="Label" name="label" />
        <ProjectField
          clearable={optional}
          current={entry.project}
          form={form}
          label="Project"
          name="projectId"
        />
        <Button type="submit">Save</Button>
      </Stack>
    </OperationFormBody>
  );
}

const contracts = { projects: projectsContract, entries: entriesContract };

interface Call {
  readonly entry: string;
  readonly input: unknown;
}

interface Loaded {
  readonly access: PortAccess;
  /** Every Operation that reached the Port, in order. */
  readonly calls: Call[];
}

interface Args {
  readonly project: ProjectReference | null;
  readonly optional: boolean;
  readonly projects: ProjectsAnswers;
}

const ENTRY_ID = "entry-1";

const meta = {
  title: "Projects/Project picker",
  args: { project: null, optional: false, projects: {} },
  // A new Port for every render, so that a second run starts without calls.
  loaders: [
    ({ args }): Loaded => {
      const calls: Call[] = [];
      const fixed = fixedAnswers(contracts, {
        projects: { ...SUCCEEDING, ...(args as Args).projects },
        entries: { edit: { data: { id: ENTRY_ID, label: "Design", project: null } } },
      });
      return {
        calls,
        access: {
          ...fixed,
          call(module, entry, input, signal) {
            if (entry !== "active") calls.push({ entry, input });
            return fixed.call(module, entry, input, signal);
          },
        },
      };
    },
  ],
  render: (args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).access}>
      <EntryForm
        entry={{ id: ENTRY_ID, label: "Design", project: args.project }}
        optional={args.optional}
      />
    </DataProvider>
  ),
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;

const callsOf = (loaded: unknown) => (loaded as Loaded).calls;

/** The picker's input, found by its label. */
const pickerIn = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole("combobox", { name: "Project" });

/** Opens the picker and answers the options it offers, once the active projects arrived. */
async function openOptions(canvasElement: HTMLElement) {
  await userEvent.click(pickerIn(canvasElement));
  const listbox = await screen.findByRole("listbox");
  return within(listbox);
}

/** The names of the options offered, in order. */
async function offered(canvasElement: HTMLElement, count: number) {
  const options = await openOptions(canvasElement);
  await waitFor(() => expect(options.getAllByRole("option")).toHaveLength(count));
  // The title, without an emoji of the mark.
  return options.getAllByRole("option").map((option) => option.querySelector("p")?.textContent);
}

async function choose(canvasElement: HTMLElement, name: string) {
  const options = await openOptions(canvasElement);
  await userEvent.click(await options.findByRole("option", { name }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

const SORTED = ["Arbeit", "Ärzte", "Auto", "Garden", "Tax", "Website"];
const ARCHIVED_AT = "2026-03-01T09:00:00.000Z";

export const TheListOffersTheActiveProjectsWithMarkAndTitle: Story = {
  play: async ({ canvasElement }) => {
    await expect(await offered(canvasElement, SORTED.length)).toEqual(SORTED);
    const options = within(screen.getByRole("listbox"));
    const website = options.getByRole("option", { name: "Website" });
    await expect(website.querySelector("[data-color-set='teal'] svg")).not.toBeNull();
    await expect(options.getByRole("option", { name: "Garden" })).toHaveTextContent("🌱");
    // Without an icon an option shows the projects icon, and without a color the neutral look.
    const tax = options.getByRole("option", { name: TAX.title });
    await expect(tax.querySelector("svg")).not.toBeNull();
    await expect(tax.querySelector("[data-color-set]")).toBeNull();
  },
};

export const HandedNothingThePickerShowsNoChoice: Story = {
  play: async ({ canvasElement }) => {
    await expect(pickerIn(canvasElement)).toHaveValue("");
    await expect(
      within(canvasElement).queryByRole("button", { name: "Clear the choice" }),
    ).toBeNull();
  },
};

export const HandedAnActiveProjectThePickerShowsItAsChosen: Story = {
  args: { project: projectReference(DOCTORS) },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(pickerIn(canvasElement)).toHaveValue("Ärzte"));
    await expect(await offered(canvasElement, SORTED.length)).toEqual(SORTED);
    await expect(
      within(screen.getByRole("listbox")).getByRole("option", { name: "Ärzte", selected: true }),
    ).toBeVisible();
  },
};

export const AnArchivedProjectIsShownWithItsAdditionUntilAnotherIsChosen: Story = {
  args: { project: projectReference(OLD_SITE, { archivedAt: ARCHIVED_AT }) },
  play: async ({ canvasElement, loaded }) => {
    await expect(pickerIn(canvasElement)).toHaveValue("Old site (archived)");
    await expect(await offered(canvasElement, SORTED.length + 1)).toContain("Old site (archived)");
    await userEvent.keyboard("{Escape}");
    await choose(canvasElement, "Tax");
    await expect(pickerIn(canvasElement)).toHaveValue("Tax");
    await expect(await offered(canvasElement, SORTED.length)).toEqual(SORTED);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "edit", input: { id: ENTRY_ID, projectId: TAX.id } },
      ]),
    );
  },
};

export const ADeletedProjectIsShownWithItsAddition: Story = {
  args: {
    project: projectReference(OLD_SITE, {
      archivedAt: ARCHIVED_AT,
      deletedAt: "2026-04-01T09:00:00.000Z",
    }),
  },
  play: async ({ canvasElement }) => {
    // Deleted outranks archived: the project is gone, whatever else it was.
    await expect(pickerIn(canvasElement)).toHaveValue("Old site (deleted)");
    await choose(canvasElement, "Website");
    await expect(await offered(canvasElement, SORTED.length)).toEqual(SORTED);
  },
};

export const InGermanTheAdditionIsGerman: Story = {
  args: { project: projectReference(OLD_SITE, { archivedAt: ARCHIVED_AT }) },
  globals: { language: "de" },
  play: async ({ canvasElement }) => {
    await expect(pickerIn(canvasElement)).toHaveValue("Old site (archiviert)");
  },
};

export const AnUntouchedPickerSendsNothingInAnEdit: Story = {
  args: { project: projectReference(WEBSITE) },
  play: async ({ canvasElement, loaded }) => {
    const label = within(canvasElement).getByRole("textbox", { name: "Label" });
    await userEvent.clear(label);
    await userEvent.type(label, "Review");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "edit", input: { id: ENTRY_ID, label: "Review" } },
      ]),
    );
  },
};

export const ChoosingAProjectChangesTheDraft: Story = {
  play: async ({ canvasElement, loaded }) => {
    const save = within(canvasElement).getByRole("button", { name: "Save" });
    await choose(canvasElement, "Garden");
    await expect(pickerIn(canvasElement)).toHaveValue("Garden");
    await userEvent.click(save);
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "edit", input: { id: ENTRY_ID, projectId: GARDEN.id } },
      ]),
    );
  },
};

export const InARequiredFieldTheChoiceCannotBeCleared: Story = {
  args: { project: projectReference(WEBSITE) },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(pickerIn(canvasElement)).toHaveValue("Website"));
    await expect(
      within(canvasElement).queryByRole("button", { name: "Clear the choice" }),
    ).toBeNull();
    // Choosing the chosen project again keeps it.
    await choose(canvasElement, "Website");
    await expect(pickerIn(canvasElement)).toHaveValue("Website");
  },
};

export const InAnOptionalFieldTheChoiceCanBeCleared: Story = {
  args: { project: projectReference(WEBSITE), optional: true },
  play: async ({ canvasElement, loaded }) => {
    await waitFor(() => expect(pickerIn(canvasElement)).toHaveValue("Website"));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Clear the choice" }));
    await expect(pickerIn(canvasElement)).toHaveValue("");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "edit", input: { id: ENTRY_ID, projectId: null } },
      ]),
    );
  },
};

export const TwoProjectsWithTheSameTitleBothAppearEachWithItsMark: Story = {
  args: { projects: { active: { data: [WEBSITE, TAX, WEBSITE_TWIN] } } },
  play: async ({ canvasElement, loaded }) => {
    await expect(await offered(canvasElement, 3)).toEqual(["Tax", "Website", "Website"]);
    const [first, second] = within(screen.getByRole("listbox")).getAllByRole("option", {
      name: "Website",
    });
    await expect(first!.querySelector("[data-color-set='teal'] svg")).not.toBeNull();
    await expect(second!).toHaveTextContent("🌐");
    await expect(second!.querySelector("[data-color-set='orange']")).not.toBeNull();
    await userEvent.click(second!);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        { entry: "edit", input: { id: ENTRY_ID, projectId: WEBSITE_TWIN.id } },
      ]),
    );
  },
};

export const AnEmptyListSaysThereIsNoActiveProject: Story = {
  args: { projects: { active: { data: [] } } },
  play: async ({ canvasElement }) => {
    await userEvent.click(pickerIn(canvasElement));
    await expect(await screen.findByText("No active projects")).toBeVisible();
    await expect(screen.queryAllByRole("option")).toEqual([]);
  },
};

export const AnArchivedChoiceStaysShownWhileTheListIsEmpty: Story = {
  args: {
    project: projectReference(OLD_SITE, { archivedAt: ARCHIVED_AT }),
    projects: { active: { data: [] } },
  },
  play: async ({ canvasElement }) => {
    await expect(pickerIn(canvasElement)).toHaveValue("Old site (archived)");
    await expect(await offered(canvasElement, 1)).toEqual(["Old site (archived)"]);
  },
};
