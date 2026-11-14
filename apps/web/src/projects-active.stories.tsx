// The View "Active" of `projects` and its form for a new project, over Fixed Answers (D255). An
// Operation's Fixed Answer changes nothing and no Table Change follows, so these stories show
// states and the calls that reach the Port; that the list follows a change is shown by the
// module's Port test.

import type { PortAccess } from "@self-engine/data-client/react";
import { projectsAnswers, WEBSITE } from "@self-engine/projects/testing";
import { LOADER_DELAY_MS } from "@self-engine/ui";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  AppAt,
  editInAddress,
  loadStoryApp,
  openPalette,
  paletteGone,
  pressWithMod,
  storyRouter,
} from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;

const ACTIVE = "/projects/active";
const NEW = `${ACTIVE}?edit=new`;

interface Call {
  readonly entry: string;
  readonly input: unknown;
}

/** The Port access of a story, and every call that reached it. */
function recorded(access: PortAccess): { access: PortAccess; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    access: {
      ...access,
      call: (module, entry, input, signal) => {
        calls.push({ entry, input });
        return access.call(module, entry, input, signal);
      },
    },
  };
}

let port = recorded(projectsAnswers());
/** A new recording for every render, so that a second run starts without calls. */
const freshPort = (access = projectsAnswers()) => {
  port = recorded(access);
  return port.access;
};
const writes = () => port.calls.filter((call) => call.entry !== "active");

const meta = {
  title: "App/Projects/Active",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  args: { address: ACTIVE, access: projectsAnswers() },
  render: (args) => <AppAt address={args.address} access={freshPort()} />,
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const list = (canvas: Canvas) => canvas.findByRole("list", { name: "Active projects" });

/** The title of a row, without an emoji of its mark. */
const titleOf = (item: HTMLElement) => item.lastElementChild?.textContent;

/** The titles in the order the list shows them. */
async function titlesShown(canvas: Canvas) {
  return within(await list(canvas))
    .getAllByRole("listitem")
    .map(titleOf);
}

/** The mark of the row titled `title`: the element before the title. */
async function markOf(canvas: Canvas, title: string) {
  const row = within(await list(canvas))
    .getAllByRole("listitem")
    .find((item) => titleOf(item) === title);
  const mark = row?.firstElementChild;
  if (!(mark instanceof HTMLElement)) throw new Error(`No mark for ${title}`);
  return mark;
}

/** The picture of the Navbar's entry for `projects`, which a row without an icon shows. */
const navbarPicture = (canvas: Canvas) =>
  canvas.getByRole("link", { name: "Projects" }).querySelector("svg")?.innerHTML;

const SORTED = ["Arbeit", "Ärzte", "Auto", "Garden", "Tax", "Website"];

export const TheListShowsEachProjectWithItsMarkSortedByTitle: Story = {
  play: async ({ canvas }) => {
    await expect(await titlesShown(canvas)).toEqual(SORTED);

    const website = await markOf(canvas, "Website");
    await expect(website).toHaveAttribute("data-color-set", "teal");
    await expect(website).toHaveAttribute("aria-hidden", "true");
    await expect(website.querySelector("svg")).not.toBeNull();
    await expect(website.querySelector("svg")?.innerHTML).not.toBe(navbarPicture(canvas));

    await expect(await markOf(canvas, "Garden")).toHaveTextContent("🌱");

    // Without an icon the row shows the projects icon of the Navbar, and without a color the
    // neutral look.
    const tax = await markOf(canvas, "Tax");
    await expect(tax).not.toHaveAttribute("data-color-set");
    await expect(tax.querySelector("svg")?.innerHTML).toBe(navbarPicture(canvas));
  },
};

export const TheListIsSortedByGermanRulesInGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("heading", { name: "Aktiv", level: 1 })).toBeVisible();
    await expect(
      within(await canvas.findByRole("list", { name: "Aktive Projekte" }))
        .getAllByRole("listitem")
        .map(titleOf),
    ).toEqual(SORTED);
  },
};

export const AnEmptyListSaysHowToCreateTheFirstProject: Story = {
  render: (args) => (
    <AppAt address={args.address} access={freshPort(projectsAnswers({ active: { data: [] } }))} />
  ),
  play: async ({ canvas }) => {
    const empty = within((await canvas.findByText("No projects yet")).parentElement!);
    await expect(empty.getByText(/Create your first project with "New project"/)).toBeVisible();
    await userEvent.click(empty.getByRole("button", { name: "New project" }));
    await screen.findByRole("dialog", { name: "New project" });
    await expect(editInAddress(storyRouter())).toBe("new");
  },
};

/** The loading state's wait, run when the story says so. */
let heldWait: ReturnType<typeof holdTimers>["held"];

export const ASlowLoadShowsTheLoadingStateAfterItsWait: Story = {
  render: (args) => (
    <AppAt address={args.address} access={freshPort(projectsAnswers({ active: "loading" }))} />
  ),
  beforeEach: () => {
    const timers = holdTimers(LOADER_DELAY_MS);
    heldWait = timers.held;
    return timers.restore;
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("heading", { name: "Active", level: 1 })).toBeVisible();
    await expect(canvas.queryByRole("status", { name: "Loading" })).toBeNull();
    await waitFor(() => expect(heldWait.size).toBeGreaterThan(0));
    for (const finish of heldWait.values()) finish();
    await expect(await canvas.findByRole("status", { name: "Loading" })).toBeVisible();
    await expect(canvas.queryByRole("list", { name: "Active projects" })).toBeNull();
  },
};

export const AFailedLoadOffersToTryAgain: Story = {
  render: (args) => (
    <AppAt address={args.address} access={freshPort(projectsAnswers({ active: "unexpected" }))} />
  ),
  play: async ({ canvas }) => {
    const failure = await canvas.findByRole("alert");
    await expect(failure).toHaveTextContent("This part could not be loaded.");
    await userEvent.click(within(failure).getByRole("button", { name: "Try again" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("could not be loaded");
    await expect(screen.queryAllByRole("alert")).toHaveLength(1);
  },
};

const newProjectDialog = () => screen.findByRole("dialog", { name: "New project" });

export const NewProjectOpensTheFormFromThePrimaryAction: Story = {
  play: async ({ canvas }) => {
    await list(canvas);
    await userEvent.click(await canvas.findByRole("button", { name: "New project" }));
    await newProjectDialog();
    await expect(editInAddress(storyRouter())).toBe("new");
  },
};

export const NewProjectOpensTheFormFromTheCommandPalette: Story = {
  play: async ({ canvas }) => {
    await list(canvas);
    await openPalette();
    await userEvent.keyboard("new project{Enter}");
    await paletteGone();
    await newProjectDialog();
    await waitFor(() => expect(editInAddress(storyRouter())).toBe("new"));
  },
};

export const NewProjectOpensTheFormWithModN: Story = {
  play: async ({ canvas }) => {
    await list(canvas);
    // The bindings load after the first paint, so an early press is lost.
    await waitFor(async () => {
      await pressWithMod("n");
      await expect(screen.getByRole("dialog", { name: "New project" })).toBeVisible();
    });
    await expect(editInAddress(storyRouter())).toBe("new");
  },
};

/** The form's fields, found as a user finds them. */
async function formIn() {
  const drawer = within(await newProjectDialog());
  return {
    drawer,
    title: await drawer.findByRole("textbox", { name: "Title" }),
    description: () => drawer.getByRole("textbox", { name: "Description" }),
    save: () => drawer.getByRole("button", { name: "Save" }),
  };
}

const noDrawer = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

export const TheNewProjectFormChecksTheTitleBeforeAnyCall: Story = {
  args: { address: NEW },
  play: async () => {
    const form = await formIn();
    // Creating, Save is enabled before anything was typed (D321).
    await expect(form.save()).toBeEnabled();
    await userEvent.click(form.save());
    await waitFor(() => expect(form.title).toHaveAccessibleDescription("This field is required."));
    await expect(form.title).toHaveFocus();

    await userEvent.type(form.title, "   ");
    await expect(form.title).toHaveAccessibleDescription("This field is required.");

    await userEvent.clear(form.title);
    await userEvent.click(form.title);
    await userEvent.paste("x".repeat(201));
    await waitFor(() => expect(form.title).toHaveAccessibleDescription("At most 200 characters."));
    await userEvent.click(form.save());
    await expect(form.save()).toBeEnabled();
    await expect(writes()).toEqual([]);
    await expect(screen.getByRole("dialog", { name: "New project" })).toBeVisible();
  },
};

export const TheNewProjectFormInGerman: Story = {
  args: { address: NEW },
  globals: { language: "de" },
  play: async () => {
    const drawer = within(await screen.findByRole("dialog", { name: "Neues Projekt" }));
    const title = await drawer.findByRole("textbox", { name: "Titel" });
    await expect(drawer.getByRole("textbox", { name: "Beschreibung" })).toBeVisible();
    await userEvent.click(drawer.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(title).toHaveAccessibleDescription("Dieses Feld ist erforderlich."));
    await expect(writes()).toEqual([]);
  },
};

export const ANewProjectIsCreatedWithEveryFieldAndTheDrawerCloses: Story = {
  args: { address: NEW },
  play: async () => {
    const form = await formIn();
    await userEvent.type(form.title, " Website ");
    await userEvent.type(form.description(), "Relaunch");
    await userEvent.click(form.drawer.getByRole("button", { name: /^Icon/ }));
    const picker = within(await screen.findByRole("dialog", { name: "Choose an icon" }));
    await userEvent.click(
      within(picker.getByRole("listbox", { name: "Icons" })).getByRole("option", {
        name: "House",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose an icon" })).toBeNull(),
    );
    await userEvent.click(
      within(form.drawer.getByRole("radiogroup", { name: "Color" })).getByRole("radio", {
        name: "Teal",
      }),
    );
    await userEvent.click(form.save());
    await noDrawer();
    await expect(writes()).toEqual([
      {
        entry: "create",
        input: { title: " Website ", description: "Relaunch", icon: "house", color: "teal" },
      },
    ]);
    await expect(editInAddress(storyRouter())).toBeUndefined();
  },
};

export const AnEmptiedDescriptionIsSentAsNoValue: Story = {
  args: { address: NEW },
  play: async () => {
    const form = await formIn();
    await userEvent.type(form.title, WEBSITE.title);
    await userEvent.type(form.description(), "Draft");
    await userEvent.clear(form.description());
    await userEvent.type(form.description(), "  ");
    await userEvent.click(form.save());
    await noDrawer();
    await expect(writes()).toEqual([
      {
        entry: "create",
        input: { title: "Website", description: null, icon: null, color: null },
      },
    ]);
  },
};
