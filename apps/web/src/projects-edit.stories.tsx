// The Edit Drawer of a stored project, over Fixed Answers (D255) that the story changes the way
// another window, an assistant or the sync would (Changing Answers). Each story asserts the calls
// that reach the Port; that the Data Process answers them as the Contract says is shown by the
// module's Port test and the contract kit.

import {
  OLD_SHOP,
  type PortCall,
  type ProjectsAnswers,
  type ProjectsStoryPort,
  projectsAnswers,
  projectsStoryPort,
  sampleProjectId,
  TAX,
  WEBSITE,
} from "@self-engine/projects/testing";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { AppAt, editInAddress, loadStoryApp, QUESTION, storyRouter } from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;

const ACTIVE = "/projects/active";
const OTHERS = [TAX];
type StoredProject = Omit<typeof WEBSITE, "description" | "icon"> & {
  readonly description: string | null;
  readonly icon: string | null;
};
const listOf = (...projects: readonly StoredProject[]): ProjectsAnswers => ({
  active: { data: projects.map((project) => ({ ...project })) },
});
/** Both lists: the active projects, then the archived ones. */
const listsOf = (
  active: readonly StoredProject[],
  archived: readonly StoredProject[],
): ProjectsAnswers => ({
  active: { data: active.map((project) => ({ ...project })) },
  archived: { data: archived.map((project) => ({ ...project })) },
});
const ARCHIVED_AT = "2026-11-12T12:00:00.000Z";
const ARCHIVE = "/projects/archive";

let port = projectsStoryPort();

/** The Port a story's render uses; `afterCall` changes the stored projects after an Operation. */
function storyPort(
  answers: ProjectsAnswers,
  afterCall?: (call: PortCall, of: ProjectsStoryPort<ProjectsAnswers>) => void,
) {
  port = projectsStoryPort(answers, afterCall);
  return port.access;
}

const meta = {
  title: "App/Projects/Edit",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  args: { address: ACTIVE, access: projectsAnswers() },
  render: (args) => <AppAt address={args.address} access={storyPort(listOf(WEBSITE, ...OTHERS))} />,
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const titlesShown = async (canvas: Canvas, name = "Active projects") =>
  within(await canvas.findByRole("list", { name }))
    .getAllByRole("button")
    .map((row) => row.lastElementChild?.textContent);

/** Opens `title` from the list and finds its form as a user finds it. */
async function openFromTheList(canvas: Canvas, title = WEBSITE.title) {
  await userEvent.click(await canvas.findByRole("button", { name: title }));
  const dialog = await screen.findByRole("dialog", { name: title });
  const drawer = within(dialog);
  return {
    drawer,
    title: await drawer.findByRole("textbox", { name: "Title" }),
    description: () => drawer.getByRole("textbox", { name: "Description" }),
    save: () => drawer.getByRole("button", { name: "Save" }),
  };
}

const noDrawer = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

/** A notice stays until the story answers it. */
const keepNoticesOpen = () => holdTimers(8000).restore;

/** Undo on the latest notice, the one in front of the stack. */
const undoLast = async () => {
  const offers = await screen.findAllByRole("button", { name: "Undo" });
  await userEvent.click(offers.find((offer) => offer.closest("[inert]") === null)!);
};

/** Whether one of `texts` was ever on the page while the story ran, even for one frame. */
function watchFor(texts: readonly string[]) {
  let seen: string | undefined;
  const look = () => {
    seen ??= texts.find((text) => document.body.textContent.includes(text));
  };
  const observer = new MutationObserver(look);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    seen: () => seen,
    stop: () => observer.disconnect(),
  };
}

export const AStoredProjectOpensWithItsValuesAndSaveDisabled: Story = {
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await expect(form.title).toHaveValue("Website");
    await expect(form.drawer.getByRole("button", { name: /^Icon/ })).toBeVisible();
    await expect(
      within(form.drawer.getByRole("radiogroup", { name: "Color" })).getByRole("radio", {
        name: "Teal",
      }),
    ).toBeChecked();
    // Editing, Save waits for a change (D321); typing and taking it back is no change.
    await expect(form.save()).toBeDisabled();
    await userEvent.type(form.title, "!");
    await expect(form.save()).toBeEnabled();
    await userEvent.type(form.title, "{Backspace}");
    await expect(form.save()).toBeDisabled();

    await userEvent.click(form.drawer.getByRole("button", { name: "Cancel" }));
    await noDrawer();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(port.calls).toEqual([]);
  },
};

export const ANewTitleIsSentAloneAndTheListShowsIt: Story = {
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listOf(WEBSITE, ...OTHERS), (call, of) => {
        if (call.entry === "edit") of.change(listOf({ ...WEBSITE, title: "Shop" }, ...OTHERS));
      })}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await userEvent.clear(form.title);
    await userEvent.type(form.title, "Shop");
    await userEvent.click(form.save());
    await noDrawer();
    await expect(port.calls).toEqual([{ entry: "edit", input: { id: WEBSITE.id, title: "Shop" } }]);
    await waitFor(async () => expect(await titlesShown(canvas)).toEqual(["Shop", "Tax"]));
    await expect(editInAddress(storyRouter())).toBeUndefined();
  },
};

export const AClearedDescriptionIsSentAsNoValue: Story = {
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listOf({ ...WEBSITE, description: "Relaunch" }))}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await expect(form.description()).toHaveValue("Relaunch");
    await userEvent.clear(form.description());
    await userEvent.type(form.description(), "  ");
    await userEvent.click(form.save());
    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: WEBSITE.id, description: null } },
    ]);
  },
};

export const AnIconOfANewerVersionStaysWhenOnlyTheTitleChanges: Story = {
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listOf({ ...WEBSITE, icon: "icon-of-a-newer-version" }))}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await userEvent.type(form.title, " shop");
    await userEvent.click(form.save());
    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: WEBSITE.id, title: "Website shop" } },
    ]);
  },
};

export const AnInvalidTitleIsReportedAtItsFieldBeforeAnyCall: Story = {
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await userEvent.clear(form.title);
    await userEvent.click(form.save());
    await waitFor(() => expect(form.title).toHaveAccessibleDescription("This field is required."));
    await expect(form.title).toHaveFocus();
    await userEvent.click(form.title);
    await userEvent.paste("x".repeat(201));
    await waitFor(() => expect(form.title).toHaveAccessibleDescription("At most 200 characters."));
    await userEvent.click(form.save());
    await expect(port.calls).toEqual([]);
    // Under a loaded run the drawer's transition can lag; a drawer that closed would never return.
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Website" })).toBeVisible());
  },
};

export const DeleteClosesTheDrawerAndUndoBringsTheProjectBack: Story = {
  beforeEach: keepNoticesOpen,
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listOf(WEBSITE, ...OTHERS), (call, of) => {
        if (call.entry === "delete") of.change(listOf(...OTHERS));
        if (call.entry === "restore") of.change(listOf(WEBSITE, ...OTHERS));
      })}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await userEvent.type(form.title, " changed");
    const flash = watchFor(["Project not found", "This entry was deleted"]);
    try {
      await userEvent.click(form.drawer.getByRole("button", { name: "Delete" }));
      await noDrawer();
      await waitFor(async () => expect(await titlesShown(canvas)).toEqual(["Tax"]));
      await expect(flash.seen()).toBeUndefined();
    } finally {
      flash.stop();
    }
    // A delete is a named Operation and asks nothing, even with a change typed (D322).
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(await screen.findByText("Project deleted")).toBeVisible();

    await undoLast();
    await waitFor(async () => expect(await titlesShown(canvas)).toEqual(["Tax", "Website"]));
    await expect(port.calls).toEqual([
      { entry: "delete", input: { id: WEBSITE.id } },
      { entry: "restore", input: { id: WEBSITE.id } },
    ]);
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};

export const AChangeFromElsewhereShowsInAnUntouchedField: Story = {
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await userEvent.type(form.title, " shop");
    port.change(listOf({ ...WEBSITE, description: "Written elsewhere" }, ...OTHERS));
    await waitFor(() => expect(form.description()).toHaveValue("Written elsewhere"));
    await expect(form.title).toHaveValue("Website shop");
    await userEvent.click(form.save());
    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: WEBSITE.id, title: "Website shop" } },
    ]);
  },
};

export const AProjectDeletedElsewhereKeepsWhatWasTypedAndCannotBeSaved: Story = {
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await userEvent.type(form.title, " shop");
    port.change(listOf(...OTHERS));
    const warning = await form.drawer.findByText("This entry was deleted");
    await waitFor(() => expect(warning).toBeVisible());
    await expect(form.title).toHaveValue("Website shop");
    await expect(form.save()).toBeDisabled();
    await expect(port.calls).toEqual([]);
  },
};

export const AnUnknownProjectSaysSoAndOffersOnlyToClose: Story = {
  args: { address: `${ACTIVE}?edit=${sampleProjectId(99)}` },
  play: async () => {
    const drawer = within(await screen.findByRole("dialog", { name: "Projects" }));
    const failure = await drawer.findByRole("alert");
    await expect(failure).toHaveTextContent("Project not found");
    await expect(within(failure).getAllByRole("button")).toHaveLength(1);
    await expect(drawer.queryByRole("textbox")).toBeNull();
    await expect(drawer.queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(within(failure).getByRole("button", { name: "Close" }));
    await noDrawer();
    await expect(editInAddress(storyRouter())).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
  },
};

export const TheStoredProjectsDrawerInGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: WEBSITE.title }));
    const drawer = within(await screen.findByRole("dialog", { name: WEBSITE.title }));
    await expect(await drawer.findByRole("textbox", { name: "Titel" })).toHaveValue("Website");
    await expect(drawer.getByRole("button", { name: "Speichern" })).toBeDisabled();
    // The drawer can still be sliding in.
    await waitFor(() => expect(drawer.getByRole("button", { name: "Löschen" })).toBeVisible());
    await expect(drawer.getByRole("button", { name: "Archivieren" })).toBeVisible();
  },
};

/** What "not found" and the warning of a project deleted elsewhere say. */
const FLASHES = ["Project not found", "This entry was deleted"];

export const ArchiveClosesTheDrawerAndUndoBringsTheProjectBack: Story = {
  beforeEach: keepNoticesOpen,
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listsOf([WEBSITE, ...OTHERS], []), (call, of) => {
        const archived = { ...WEBSITE, archivedAt: ARCHIVED_AT };
        if (call.entry === "archive") of.change(listsOf(OTHERS, [archived]));
        if (call.entry === "unarchive") of.change(listsOf([WEBSITE, ...OTHERS], []));
      })}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas);
    await expect(form.drawer.queryByRole("button", { name: "Unarchive" })).toBeNull();
    const flash = watchFor([...FLASHES, "Unarchive"]);
    try {
      await userEvent.click(form.drawer.getByRole("button", { name: "Archive" }));
      await noDrawer();
      await waitFor(async () => expect(await titlesShown(canvas)).toEqual(["Tax"]));
      await expect(flash.seen()).toBeUndefined();
    } finally {
      flash.stop();
    }
    await expect(await screen.findByText("Project archived")).toBeVisible();

    await undoLast();
    await waitFor(async () => expect(await titlesShown(canvas)).toEqual(["Tax", "Website"]));
    await expect(port.calls).toEqual([
      { entry: "archive", input: { id: WEBSITE.id } },
      { entry: "unarchive", input: { id: WEBSITE.id } },
    ]);
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};

const OLD_SHOP_ACTIVE = { ...OLD_SHOP, archivedAt: null };

export const UnarchiveClosesTheDrawerAndUndoArchivesAgain: Story = {
  args: { address: ARCHIVE },
  beforeEach: keepNoticesOpen,
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listsOf(OTHERS, [OLD_SHOP]), (call, of) => {
        if (call.entry === "unarchive") of.change(listsOf([...OTHERS, OLD_SHOP_ACTIVE], []));
        if (call.entry === "archive") of.change(listsOf(OTHERS, [OLD_SHOP]));
      })}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas, OLD_SHOP.title);
    await expect(form.drawer.queryByRole("button", { name: "Archive" })).toBeNull();
    const flash = watchFor(FLASHES);
    try {
      await userEvent.click(form.drawer.getByRole("button", { name: "Unarchive" }));
      await noDrawer();
      await canvas.findByText("No archived projects");
      await expect(flash.seen()).toBeUndefined();
    } finally {
      flash.stop();
    }
    await expect(await screen.findByText("Project unarchived")).toBeVisible();

    await undoLast();
    await waitFor(async () =>
      expect(await titlesShown(canvas, "Archived projects")).toEqual(["Old shop"]),
    );
    await expect(port.calls).toEqual([
      { entry: "unarchive", input: { id: OLD_SHOP.id } },
      { entry: "archive", input: { id: OLD_SHOP.id } },
    ]);
  },
};

export const AnArchivedProjectIsEditedAndSavedAndStaysArchived: Story = {
  args: { address: ARCHIVE },
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listsOf(OTHERS, [OLD_SHOP]), (call, of) => {
        if (call.entry === "edit") of.change(listsOf(OTHERS, [{ ...OLD_SHOP, title: "Shop" }]));
      })}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas, OLD_SHOP.title);
    await expect(form.title).toHaveValue("Old shop");
    await expect(form.save()).toBeDisabled();
    await waitFor(() =>
      expect(form.drawer.getByRole("button", { name: "Unarchive" })).toBeVisible(),
    );
    await expect(form.drawer.getByRole("button", { name: "Delete" })).toBeVisible();
    await userEvent.clear(form.title);
    await userEvent.type(form.title, "Shop");
    await userEvent.click(form.save());
    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: OLD_SHOP.id, title: "Shop" } },
    ]);
    await waitFor(async () =>
      expect(await titlesShown(canvas, "Archived projects")).toEqual(["Shop"]),
    );
  },
};

export const AnArchivedProjectIsDeletedAndUndoBringsItBackArchived: Story = {
  args: { address: ARCHIVE },
  beforeEach: keepNoticesOpen,
  render: (args) => (
    <AppAt
      address={args.address}
      access={storyPort(listsOf(OTHERS, [OLD_SHOP]), (call, of) => {
        if (call.entry === "delete") of.change(listsOf(OTHERS, []));
        if (call.entry === "restore") of.change(listsOf(OTHERS, [OLD_SHOP]));
      })}
    />
  ),
  play: async ({ canvas }) => {
    const form = await openFromTheList(canvas, OLD_SHOP.title);
    const flash = watchFor(FLASHES);
    try {
      await userEvent.click(form.drawer.getByRole("button", { name: "Delete" }));
      await noDrawer();
      await canvas.findByText("No archived projects");
      await expect(flash.seen()).toBeUndefined();
    } finally {
      flash.stop();
    }
    await undoLast();
    await waitFor(async () =>
      expect(await titlesShown(canvas, "Archived projects")).toEqual(["Old shop"]),
    );
    await expect(port.calls).toEqual([
      { entry: "delete", input: { id: OLD_SHOP.id } },
      { entry: "restore", input: { id: OLD_SHOP.id } },
    ]);
  },
};

export const TheArchivedProjectsDrawerInGerman: Story = {
  args: { address: ARCHIVE },
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: OLD_SHOP.title }));
    const drawer = within(await screen.findByRole("dialog", { name: OLD_SHOP.title }));
    await expect(await drawer.findByRole("textbox", { name: "Titel" })).toHaveValue("Old shop");
    await waitFor(() => expect(drawer.getByRole("button", { name: "Reaktivieren" })).toBeVisible());
    await expect(drawer.getByRole("button", { name: "Löschen" })).toBeVisible();
  },
};
