// Where the focus goes when the Edit Drawer of `projects` closes (#308, ADR 0041), for each way of
// opening and closing it. Over Fixed Answers (D255) that change after each Operation as the Data
// Process would, so the list follows a create, a delete, an archive and an unarchive.

import {
  OLD_SHOP,
  type PortCall,
  type ProjectsAnswers,
  type ProjectsStoryPort,
  projectsStoryPort,
  sampleProjectId,
  TAX,
  TAX_2025,
  WEBSITE,
} from "@self-engine/projects/testing";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { settled } from "@self-engine/ui/story-surfaces";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  answer,
  AppAt,
  keepNoticesOpen,
  loadStoryApp,
  noDrawer,
  pressWithMod,
} from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;
type StoredProject = typeof TAX;

/** What the create answers: a project titled as the stories type it. */
const STUDIO = { ...TAX, id: sampleProjectId(7), title: "Studio" };
const ARCHIVED_AT = "2026-11-12T12:00:00.000Z";

const lists = (
  active: readonly StoredProject[],
  archived: readonly StoredProject[] = [],
): ProjectsAnswers => ({
  active: { data: active.map((project) => ({ ...project })) },
  archived: { data: archived.map((project) => ({ ...project })) },
  create: { data: STUDIO },
});

const ARCHIVED = [OLD_SHOP, TAX_2025];

/** The stored projects after each Operation, as the Table Change that follows it shows them. */
function follow(call: PortCall, of: ProjectsStoryPort) {
  const unarchived = { ...OLD_SHOP, archivedAt: null };
  if (call.entry === "create") of.change(lists([WEBSITE, TAX, STUDIO], ARCHIVED));
  if (call.entry === "delete") of.change(lists([TAX], ARCHIVED));
  if (call.entry === "archive")
    of.change(lists([TAX], [...ARCHIVED, { ...WEBSITE, archivedAt: ARCHIVED_AT }]));
  if (call.entry === "unarchive") of.change(lists([WEBSITE, TAX, unarchived], [TAX_2025]));
}

const meta = {
  title: "App/Projects/Focus after the drawer",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  beforeEach: keepNoticesOpen,
  args: { address: "/projects/active", access: projectsStoryPort().access },
  render: (args) => (
    <AppAt
      address={args.address}
      access={projectsStoryPort(lists([WEBSITE, TAX], ARCHIVED), follow).access}
    />
  ),
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What has the focus, as a person would name it, for a failure that says where it went. */
function focused(): string {
  const element = document.activeElement;
  if (element === null || element === document.body) return "the page";
  return `${element.tagName.toLowerCase()} "${element.textContent}"`;
}

/** Once the drawer has left, the focus is on `element`. */
async function focusIsOn(element: HTMLElement | Promise<HTMLElement>) {
  await noDrawer();
  const target = await element;
  await waitFor(() => expect(target, `the focus is on ${focused()}`).toHaveFocus());
}

const rowOf = (canvas: Canvas, title: string) => canvas.findByRole("button", { name: title });

const drawerNamed = async (name: string) =>
  within(await settled(screen.findByRole("dialog", { name })));

async function openRow(canvas: Canvas, title = WEBSITE.title) {
  const row = await rowOf(canvas, title);
  await userEvent.click(row);
  return { row, drawer: await drawerNamed(title) };
}

/** Mod+N on the page, with the focus nowhere. */
async function openWithModN(canvas: Canvas) {
  await rowOf(canvas, WEBSITE.title);
  // The bindings load after the first paint, so an early press is lost. A second press goes only
  // to a page where the drawer is not there yet.
  await waitFor(async () => {
    if (screen.queryByRole("dialog", { name: "New project" }) === null) await pressWithMod("n");
    await expect(screen.getByRole("dialog", { name: "New project" })).toBeInTheDocument();
  });
  return drawerNamed("New project");
}

async function createStudio(drawer: Canvas) {
  await userEvent.type(await drawer.findByRole("textbox", { name: "Title" }), STUDIO.title);
  await userEvent.click(drawer.getByRole("button", { name: "Save" }));
}

/** Criterion 1. */
export const ANewProjectCreatedWithModNTakesTheFocusAndTabMovesOn: Story = {
  play: async ({ canvas }) => {
    await createStudio(await openWithModN(canvas));
    await focusIsOn(rowOf(canvas, STUDIO.title));
    await userEvent.tab();
    await expect(await rowOf(canvas, TAX.title)).toHaveFocus();
  },
};

export const ANewProjectCreatedFromThePrimaryActionTakesTheFocus: Story = {
  play: async ({ canvas }) => {
    await rowOf(canvas, WEBSITE.title);
    await userEvent.click(canvas.getByRole("button", { name: "New project" }));
    await createStudio(await drawerNamed("New project"));
    await focusIsOn(rowOf(canvas, STUDIO.title));
  },
};

export const ANewProjectOpenedByItsAddressTakesTheFocus: Story = {
  args: { address: "/projects/active?edit=new" },
  play: async ({ canvas }) => {
    await createStudio(await drawerNamed("New project"));
    await focusIsOn(rowOf(canvas, STUDIO.title));
  },
};

/** One way out of the drawer from inside it, criterion 2. */
const backToTheRow =
  (exit: (drawer: Canvas) => Promise<unknown>): NonNullable<Story["play"]> =>
  async ({ canvas }) => {
    const { row, drawer } = await openRow(canvas);
    await exit(drawer);
    await focusIsOn(row);
  };

export const EscReturnsTheFocusToTheRow: Story = {
  play: backToTheRow(() => userEvent.keyboard("{Escape}")),
};
export const CancelReturnsTheFocusToTheRow: Story = {
  play: backToTheRow((drawer) => userEvent.click(drawer.getByRole("button", { name: "Cancel" }))),
};
export const TheCloseButtonReturnsTheFocusToTheRow: Story = {
  play: backToTheRow((drawer) =>
    userEvent.click(drawer.getByRole("button", { name: "Close editor" })),
  ),
};

/** A link or a reload opened it: no control did, so the project's row takes the focus. */
export const AProjectOpenedByItsAddressGivesTheFocusToItsRowOnEsc: Story = {
  args: { address: `/projects/active?edit=${WEBSITE.id}` },
  play: async ({ canvas }) => {
    await drawerNamed(WEBSITE.title);
    await userEvent.keyboard("{Escape}");
    await focusIsOn(rowOf(canvas, WEBSITE.title));
  },
};

/** No project and no control: the View's first control, here the first row. */
export const ANewProjectCancelledAfterModNLeavesTheFocusOnTheFirstRow: Story = {
  play: async ({ canvas }) => {
    const drawer = await openWithModN(canvas);
    await userEvent.click(drawer.getByRole("button", { name: "Cancel" }));
    await focusIsOn(rowOf(canvas, TAX.title));
  },
};

/** Criterion 3: the row is gone, so the View's first control takes the focus. */
export const DeleteLeavesTheFocusOnTheFirstRow: Story = {
  play: async ({ canvas }) => {
    const { drawer } = await openRow(canvas);
    await userEvent.click(await drawer.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: WEBSITE.title })).toBeNull());
    await focusIsOn(rowOf(canvas, TAX.title));
  },
};

export const ArchiveLeavesTheFocusOnTheFirstRow: Story = {
  play: async ({ canvas }) => {
    const { drawer } = await openRow(canvas);
    await userEvent.click(await drawer.findByRole("button", { name: "Archive" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: WEBSITE.title })).toBeNull());
    await focusIsOn(rowOf(canvas, TAX.title));
  },
};

export const UnarchiveLeavesTheFocusOnTheFirstArchivedRow: Story = {
  args: { address: "/projects/archive" },
  play: async ({ canvas }) => {
    const { drawer } = await openRow(canvas, OLD_SHOP.title);
    await userEvent.click(await drawer.findByRole("button", { name: "Unarchive" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: OLD_SHOP.title })).toBeNull());
    await focusIsOn(rowOf(canvas, TAX_2025.title));
  },
};

/** The emptied archive has no control: the View itself takes the focus, never the page. */
export const UnarchivingTheLastProjectLeavesTheFocusOnTheView: Story = {
  args: { address: "/projects/archive" },
  render: (args) => (
    <AppAt
      address={args.address}
      access={
        projectsStoryPort(lists([TAX], [OLD_SHOP]), (call, of) => {
          if (call.entry === "unarchive")
            of.change(lists([TAX, { ...OLD_SHOP, archivedAt: null }]));
        }).access
      }
    />
  ),
  play: async ({ canvas }) => {
    const { drawer } = await openRow(canvas, OLD_SHOP.title);
    await userEvent.click(await drawer.findByRole("button", { name: "Unarchive" }));
    const empty = await canvas.findByText("No archived projects");
    await focusIsOn(empty.closest<HTMLElement>("[data-shell-view]")!);
  },
};

/** Criterion 4: "Discard" leaves the drawer as every other way out does. */
export const DiscardReturnsTheFocusToTheRow: Story = {
  play: backToTheRow(async (drawer) => {
    await userEvent.type(await drawer.findByRole("textbox", { name: "Title" }), " shop");
    await userEvent.keyboard("{Escape}");
    await answer("Discard");
  }),
};

export const DiscardAfterModNLeavesTheFocusOnTheFirstRow: Story = {
  play: async ({ canvas }) => {
    const drawer = await openWithModN(canvas);
    await userEvent.type(await drawer.findByRole("textbox", { name: "Title" }), STUDIO.title);
    await userEvent.keyboard("{Escape}");
    await answer("Discard");
    await focusIsOn(rowOf(canvas, TAX.title));
  },
};
