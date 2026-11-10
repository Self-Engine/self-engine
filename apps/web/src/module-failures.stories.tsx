import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import type { ShellCommand, ShellContribution, ShellView } from "@self-engine/shell";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { type ComponentType, useState } from "react";
import { createAppRouter } from "./app-router.ts";
import { settingsStore } from "./settings-store.ts";

type Canvas = ReturnType<typeof within>;
type EditDrawerLoad = NonNullable<ShellContribution["editDrawer"]>;
type GroupsLoad = NonNullable<ShellContribution["groups"]>;

let openRouter: ReturnType<typeof createAppRouter>;

function AppAt({ address }: { readonly address: string }) {
  const [router] = useState(() => {
    openRouter = createAppRouter(createMemoryHistory({ initialEntries: [address] }));
    return openRouter;
  });
  return <RouterProvider router={router} />;
}

const meta = {
  title: "App/Module failures and slow work",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  args: { address: "/placeholder-alpha/overview" },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Work the story finishes by hand, so a slow load is deterministic. */
function held<T>() {
  let finish!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

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

const spyOnModule = {
  groups: () => spyOn(alpha as { groups: GroupsLoad }, "groups"),
  editDrawer: () => spyOn(alpha as { editDrawer: EditDrawerLoad }, "editDrawer"),
  command: () => spyOn(alpha.commands![0] as { load: ShellCommand["load"] }, "load"),
};
const page = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const offline = new Error("offline");
const onceSettled = () => new Promise((resolve) => setTimeout(resolve, 50));

async function expectEditorShows(canvasElement: HTMLElement, id: string) {
  const dialog = await page(canvasElement).findByRole("dialog");
  await within(dialog).findByText(id);
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
    const dialog = within(await body.findByRole("dialog", { name: "Editor" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent("could not be loaded");
    await expectShellIntact(canvas);
    await userEvent.click(dialog.getByRole("button", { name: "Try again" }));
    await expect(await dialog.findByRole("button", { name: "Close entry" })).toBeVisible();
    await expect(dialog.getByText("studio")).toBeVisible();
    await expect(dialog.queryByRole("alert")).toBeNull();
  },
};

export const CommandLoadFailureIsReported: Story = {
  beforeEach: () => expectingReportedErrors(spyOnModule.command().mockRejectedValueOnce(offline)),
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("could not be completed");
    await expectShellIntact(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "New entry" }));
    await expectEditorShows(canvasElement, "new");
    await waitFor(() => expect(canvas.queryByRole("alert")).toBeNull());
  },
};

export const CommandRunFailureIsReported: Story = {
  beforeEach: () =>
    expectingReportedErrors(
      spyOnModule.command().mockResolvedValueOnce({ default: () => Promise.reject(offline) }),
    ),
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("could not be completed");
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
    const dialog = within(await page(canvasElement).findByRole("dialog", { name: "Editor" }));
    await expect(await dialog.findByRole("status", { name: "Loading" })).toBeVisible();
    heldDrawer.finish({ default: DrawerStandIn });
    await expect(await dialog.findByText("Drawer stand-in")).toBeVisible();
    await expect(dialog.queryByRole("status")).toBeNull();
  },
};

let heldCommand: ReturnType<typeof held<Awaited<ReturnType<ShellCommand["load"]>>>>;
const openEditor = {
  default: ({ writeSearch }: Parameters<Awaited<ReturnType<ShellCommand["load"]>>["default"]>[0]) =>
    writeSearch((search) => ({ ...search, edit: "new" })),
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
    await expect(openRouter.state.location.search).not.toHaveProperty("edit");
    await expect(page(canvasElement).queryByRole("dialog")).toBeNull();
  },
};

let heldCommandStaying: ReturnType<typeof held<Awaited<ReturnType<ShellCommand["load"]>>>>;

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
    await expect(openRouter.state.location.search).toMatchObject({
      client: "garden",
      edit: "new",
    });
  },
};

const spyOnBeta = () => spyOn(beta.views[0] as { load: ShellView["load"] }, "load");
let heldBetaForCommand: ReturnType<typeof held<Awaited<ReturnType<ShellView["load"]>>>>;
let heldCommandBeforeLeaving: ReturnType<typeof held<Awaited<ReturnType<ShellCommand["load"]>>>>;

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
      expect(openRouter.state.location.pathname).toBe("/placeholder-beta/overview"),
    );
    heldCommandBeforeLeaving.finish(openEditor);
    await onceSettled();
    await expect(openRouter.state.location.pathname).toBe("/placeholder-beta/overview");
    await expect(openRouter.state.location.search).not.toHaveProperty("edit");
    heldBetaForCommand.finish({ default: BetaStandIn });
    await expect(await canvas.findByText("Beta stand-in")).toBeVisible();
  },
};

const BetaStandIn: ComponentType = () => <p>Beta stand-in</p>;
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
      expect(openRouter.state.location.pathname).toBe("/placeholder-beta/overview"),
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
    await body.findByRole("dialog", { name: "Editor" });
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

export const EditIdThatLooksLikeANumber: Story = {
  args: { address: "/placeholder-alpha/overview?edit=42" },
  play: ({ canvasElement }) => expectEditorShows(canvasElement, "42"),
};
export const EditIdInExponentNotation: Story = {
  args: { address: "/placeholder-alpha/overview?edit=1e5" },
  play: ({ canvasElement }) => expectEditorShows(canvasElement, "1e5"),
};
export const EditIdThatLooksLikeABoolean: Story = {
  args: { address: "/placeholder-alpha/overview?edit=true" },
  play: ({ canvasElement }) => expectEditorShows(canvasElement, "true"),
};
