import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import {
  definePageCommand,
  type EditDrawerProps,
  type PageCommand,
  type ShellContribution,
  type ShellView,
} from "@self-engine/shell";
import type { ComponentType } from "react";
import { z } from "zod";
import { settingsStore } from "./settings-store.ts";
import { AppAt, held, storyRouter } from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;
type EditDrawerLoad = NonNullable<ShellContribution["editDrawer"]>;
type GroupsLoad = NonNullable<ShellContribution["groups"]>;

const meta = {
  title: "App/Module failures and slow work",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  args: { address: "/placeholder-alpha/overview" },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

interface Restorable {
  readonly mockRestore: () => void;
}

/** React and the Shell report a failure they recover from, which would fail the story. */
function expectingReportedErrors(...spies: readonly Restorable[]) {
  const reported = spyOn(console, "error").mockImplementation(() => undefined);
  return () => {
    for (const spy of [...spies, reported]) spy.mockRestore();
  };
}

type HeldCommand = ReturnType<typeof held<Awaited<ReturnType<PageCommand["load"]>>>>;

const pageCommand = (run: Parameters<typeof definePageCommand>[0]["run"]) => ({
  default: definePageCommand({ description: "A stand-in.", schema: z.object({}), run }),
});

const spyOnModule = {
  groups: () => spyOn(alpha as { groups: GroupsLoad }, "groups"),
  editDrawer: () => spyOn(alpha as { editDrawer: EditDrawerLoad }, "editDrawer"),
  command: () => spyOn(alpha.commands![0] as { load: PageCommand["load"] }, "load"),
};
const page = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const offline = new Error("offline");
const onceSettled = () => new Promise((resolve) => setTimeout(resolve, 50));

async function expectEditorShows(canvasElement: HTMLElement, id: string) {
  const dialog = await page(canvasElement).findByRole("dialog");
  await within(dialog).findByText(id);
}

/** Closed again by hand, because the notice store outlives a story. */
async function expectFailureNoticeThenClose(canvas: Canvas, canvasElement: HTMLElement) {
  const body = page(canvasElement);
  await expect(await body.findByRole("alert")).toHaveTextContent("could not be completed");
  await expect(canvas.queryByRole("alert")).toBeNull();
  await userEvent.click(body.getByRole("button", { name: "Close notice" }));
  await waitFor(() => expect(body.queryByRole("alert")).toBeNull());
}

async function expectShellIntact(canvas: Canvas) {
  await expect(canvas.getByRole("navigation", { name: "Modules" })).toBeVisible();
  await expect(canvas.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(canvas.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
}

export const GroupsLoadFailureStaysInTheSidebar: Story = {
  beforeEach: () => expectingReportedErrors(spyOnModule.groups().mockRejectedValueOnce(offline)),
  play: async ({ canvas }) => {
    const failure = await canvas.findByRole("alert");
    await expect(failure).toHaveTextContent("could not be loaded");
    await expect(within(failure).getByRole("button", { name: "Try again" })).toBeVisible();
    await expectShellIntact(canvas);
    await expect(await canvas.findByText("Studio work")).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Archive" }));
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(await canvas.findByRole("link", { name: "Studio" })).toBeVisible();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

let groupsThrow = true;
function SometimesBrokenGroups() {
  if (groupsThrow) throw new Error("broken render");
  return <p>Recovered groups</p>;
}

export const GroupsRenderErrorStaysInTheSidebar: Story = {
  beforeEach: () => {
    groupsThrow = true;
    return expectingReportedErrors(
      spyOnModule.groups().mockResolvedValue({ default: SometimesBrokenGroups }),
    );
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent("could not be loaded");
    await expectShellIntact(canvas);
    groupsThrow = false;
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(await canvas.findByText("Recovered groups")).toBeVisible();
  },
};

export const DrawerLoadFailureStaysInItsFrame: Story = {
  args: { address: "/placeholder-alpha/overview?edit=studio" },
  beforeEach: () =>
    expectingReportedErrors(spyOnModule.editDrawer().mockRejectedValueOnce(offline)),
  play: async ({ canvas, canvasElement }) => {
    const body = page(canvasElement);
    const dialog = within(await body.findByRole("dialog", { name: "Placeholder Alpha" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent("could not be loaded");
    await expectShellIntact(canvas);
    await userEvent.click(dialog.getByRole("button", { name: "Try again" }));
    await expect(await dialog.findByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByText("studio")).toBeVisible();
    await expect(dialog.queryByRole("alert")).toBeNull();
  },
};

export const CommandLoadFailureIsReported: Story = {
  beforeEach: () => expectingReportedErrors(spyOnModule.command().mockRejectedValueOnce(offline)),
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await expectFailureNoticeThenClose(canvas, canvasElement);
    await expectShellIntact(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "New entry" }));
    await expectEditorShows(canvasElement, "new");
  },
};

export const CommandRunFailureIsReported: Story = {
  beforeEach: () =>
    expectingReportedErrors(
      spyOnModule.command().mockResolvedValueOnce(pageCommand(() => Promise.reject(offline))),
    ),
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await expectFailureNoticeThenClose(canvas, canvasElement);
    await expectShellIntact(canvas);
  },
};

export const ViewLoadFailureCanBeRetried: Story = {
  beforeEach: () =>
    expectingReportedErrors(spyOn(alpha.views[0], "load").mockRejectedValueOnce(offline)),
  play: async ({ canvas }) => {
    const failure = await canvas.findByRole("alert");
    await expect(failure).toHaveTextContent("could not be loaded");
    await expectShellIntact(canvas);
    await userEvent.click(within(failure).getByRole("button", { name: "Try again" }));
    await expect(await canvas.findByText("Studio work")).toBeVisible();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

const DrawerStandIn: ComponentType = () => <p>Drawer stand-in</p>;
let heldDrawer: ReturnType<typeof held<Awaited<ReturnType<EditDrawerLoad>>>>;

export const SlowDrawerCodeShowsTheLoadingState: Story = {
  args: { address: "/placeholder-alpha/overview?edit=studio" },
  beforeEach: () => {
    heldDrawer = held();
    const load = spyOnModule.editDrawer().mockReturnValue(heldDrawer.promise);
    return () => load.mockRestore();
  },
  play: async ({ canvasElement }) => {
    const dialog = within(await page(canvasElement).findByRole("dialog"));
    await expect(await dialog.findByRole("status", { name: "Loading" })).toBeVisible();
    heldDrawer.finish({ default: DrawerStandIn });
    await expect(await dialog.findByText("Drawer stand-in")).toBeVisible();
    await expect(dialog.queryByRole("status")).toBeNull();
  },
};

let heldCommand: HeldCommand;
const openEditor = pageCommand((_input, { writeSearch }) =>
  writeSearch((search) => ({ ...search, edit: "new" })),
);

let heldCommandPressedTwice: HeldCommand;
let pressedTwiceLoad: ReturnType<typeof spyOnModule.command>;

export const SecondPressIsIgnoredWhileTheActionRuns: Story = {
  beforeEach: () => {
    heldCommandPressedTwice = held();
    pressedTwiceLoad = spyOnModule.command().mockReturnValue(heldCommandPressedTwice.promise);
    return () => pressedTwiceLoad.mockRestore();
  },
  play: async ({ canvas, canvasElement }) => {
    const action = await canvas.findByRole("button", { name: "New entry" });
    await userEvent.click(action);
    await userEvent.click(action);
    await expect(pressedTwiceLoad).toHaveBeenCalledOnce();
    heldCommandPressedTwice.finish(openEditor);
    await expectEditorShows(canvasElement, "new");
    await expect(pressedTwiceLoad).toHaveBeenCalledOnce();
  },
};

export const SlowActionDoesNotReachTheNextView: Story = {
  beforeEach: () => {
    heldCommand = held();
    const command = spyOnModule.command().mockReturnValue(heldCommand.promise);
    return () => command.mockRestore();
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await userEvent.click(canvas.getByRole("link", { name: "Archive" }));
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    heldCommand.finish(openEditor);
    await onceSettled();
    await expect(storyRouter().state.location.search).not.toHaveProperty("edit");
    await expect(page(canvasElement).queryByRole("dialog")).toBeNull();
  },
};

let heldCommandStaying: HeldCommand;

export const SlowActionStillOpensWhenTheViewStays: Story = {
  args: { address: "/placeholder-alpha/overview?client=studio" },
  beforeEach: () => {
    heldCommandStaying = held();
    const command = spyOnModule.command().mockReturnValue(heldCommandStaying.promise);
    return () => command.mockRestore();
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await userEvent.click(canvas.getByRole("link", { name: "Garden" }));
    await expect(await canvas.findByText("Garden work")).toBeVisible();
    heldCommandStaying.finish(openEditor);
    await expectEditorShows(canvasElement, "new");
    await expect(storyRouter().state.location.search).toMatchObject({
      client: "garden",
      edit: "new",
    });
  },
};

const spyOnBeta = () => spyOn(beta.views[0] as { load: ShellView["load"] }, "load");
let heldBetaForCommand: ReturnType<typeof held<Awaited<ReturnType<ShellView["load"]>>>>;
let heldCommandBeforeLeaving: HeldCommand;

export const SlowActionDoesNotInterruptALeavingNavigation: Story = {
  beforeEach: () => {
    heldBetaForCommand = held();
    heldCommandBeforeLeaving = held();
    const view = spyOnBeta().mockReturnValue(heldBetaForCommand.promise);
    const command = spyOnModule.command().mockReturnValue(heldCommandBeforeLeaving.promise);
    return () => {
      view.mockRestore();
      command.mockRestore();
    };
  },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await waitFor(() =>
      expect(storyRouter().state.location.pathname).toBe("/placeholder-beta/overview"),
    );
    heldCommandBeforeLeaving.finish(openEditor);
    await onceSettled();
    await expect(storyRouter().state.location.pathname).toBe("/placeholder-beta/overview");
    await expect(storyRouter().state.location.search).not.toHaveProperty("edit");
    heldBetaForCommand.finish({ default: BetaStandIn });
    await expect(await canvas.findByText("Beta stand-in")).toBeVisible();
  },
};

const BetaStandIn = () => <p>Beta stand-in</p>;
let heldBeta: ReturnType<typeof held<Awaited<ReturnType<ShellView["load"]>>>>;

export const LinksFollowTheVisiblePageDuringASlowNavigation: Story = {
  args: { address: "/placeholder-alpha/overview?client=studio" },
  beforeEach: () => {
    heldBeta = held();
    const view = spyOnBeta().mockReturnValue(heldBeta.promise);
    return () => view.mockRestore();
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("link", { name: "Garden" })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await waitFor(() =>
      expect(storyRouter().state.location.pathname).toBe("/placeholder-beta/overview"),
    );
    await expect(canvas.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Archive" })).toHaveAttribute(
      "href",
      "/placeholder-alpha/archive?client=studio",
    );
    await expect(canvas.getByRole("link", { name: "Garden" })).toHaveAttribute(
      "href",
      "/placeholder-alpha/overview?client=garden",
    );
    await expect(canvas.getByRole("link", { name: "Placeholder Alpha" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    heldBeta.finish({ default: BetaStandIn });
    await expect(await canvas.findByText("Beta stand-in")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Placeholder Beta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const ClosingTheEditorReturnsFocus: Story = {
  args: { address: "/placeholder-alpha/overview" },
  play: async ({ canvas, canvasElement }) => {
    const body = page(canvasElement);
    const entry = await canvas.findByRole("button", { name: "Studio work" });
    await userEvent.click(entry);
    await body.findByRole("dialog", { name: "Studio work" });
    await userEvent.click(body.getByRole("button", { name: "Close editor" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(entry).toHaveFocus());
  },
};

export const OnlyTheShellMarksTheCurrentGroupEntry: Story = {
  args: { address: "/placeholder-alpha/overview?client=studio" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("link", { name: "Studio" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(canvas.getByRole("link", { name: "All clients" })).not.toHaveAttribute(
      "aria-current",
    );
    await expect(canvas.getByRole("link", { name: "Garden" })).not.toHaveAttribute("aria-current");
    await expect(canvas.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Archive" })).not.toHaveAttribute("aria-current");
  },
};

export const AllClientsIsCurrentWithoutAFilter: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("link", { name: "All clients" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(canvas.getByRole("link", { name: "Studio" })).not.toHaveAttribute("aria-current");
  },
};

const ShowsItsId: ComponentType<EditDrawerProps> = ({ id }) => <p>{id}</p>;
/** These ids exist nowhere: what matters is that the drawer receives them as written. */
function drawerShowsItsId() {
  const load = spyOnModule.editDrawer().mockResolvedValue({ default: ShowsItsId });
  return () => load.mockRestore();
}

export const EditIdThatLooksLikeANumber: Story = {
  args: { address: "/placeholder-alpha/overview?edit=42" },
  beforeEach: drawerShowsItsId,
  play: ({ canvasElement }) => expectEditorShows(canvasElement, "42"),
};
export const EditIdInExponentNotation: Story = {
  args: { address: "/placeholder-alpha/overview?edit=1e5" },
  beforeEach: drawerShowsItsId,
  play: ({ canvasElement }) => expectEditorShows(canvasElement, "1e5"),
};
export const EditIdThatLooksLikeABoolean: Story = {
  args: { address: "/placeholder-alpha/overview?edit=true" },
  beforeEach: drawerShowsItsId,
  play: ({ canvasElement }) => expectEditorShows(canvasElement, "true"),
};
