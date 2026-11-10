import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import { createAppRouter } from "./app-router.ts";
import { settingsStore } from "./settings-store.ts";

type Canvas = ReturnType<typeof within>;

let openRouter: ReturnType<typeof createAppRouter>;

function AppAt({ address }: { readonly address: string }) {
  const [router] = useState(() => {
    openRouter = createAppRouter(createMemoryHistory({ initialEntries: [address] }));
    return openRouter;
  });
  return <RouterProvider router={router} />;
}

const OVERVIEW = "/placeholder-alpha/overview";

const meta = {
  title: "App/Delete and missing entries",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  args: { address: OVERVIEW },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const QUESTION = "Discard changes?";
const openEntry = () => (openRouter.state.location.search as { readonly edit?: unknown }).edit;

const noDrawer = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

/** A notice stays until the story answers it. Other timers stay real: the queries poll with them. */
function keepNoticesOpen() {
  const realSetTimeout = window.setTimeout.bind(window);
  const timers = spyOn(window, "setTimeout").mockImplementation(((
    run: () => void,
    delay?: number,
  ) => (delay === 8000 ? -1 : realSetTimeout(run, delay))) as typeof window.setTimeout);
  return () => timers.mockRestore();
}

const listed = (canvas: Canvas) =>
  canvas
    .getAllByRole("button", { name: /^(Studio|Garden) work$/ })
    .map((row: HTMLElement) => row.textContent);

const deleteFromTheList = async (canvas: Canvas, name: string) =>
  userEvent.click(await canvas.findByRole("button", { name: `Delete ${name}` }));

const undoLast = async () => {
  const offers = await screen.findAllByRole("button", { name: "Undo" });
  await userEvent.click(offers.at(-1)!);
};

const noUndoOffer = () =>
  waitFor(() => expect(screen.queryByRole("button", { name: "Undo" })).toBeNull());

export const DeletingFromTheListIsImmediateAndUndoRestoresThePosition: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: "Studio work" })).toBeVisible();
    await expect(listed(canvas)).toEqual(["Studio work", "Garden work"]);
    await deleteFromTheList(canvas, "Studio work");
    await waitFor(() => expect(listed(canvas)).toEqual(["Garden work"]));
    const notice = await screen.findByText("Deleted");
    await waitFor(() => expect(notice).toBeVisible());
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

const editStudio = async (canvas: Canvas) => {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = await screen.findByRole("dialog", { name: "Studio work" });
  await userEvent.type(await within(drawer).findByRole("textbox", { name: "Name" }), " changed");
  return within(drawer);
};

export const DeletingFromTheDrawerClosesWithoutAskingAndUndoDoesNotReopen: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    const drawer = await editStudio(canvas);
    await userEvent.click(drawer.getByRole("button", { name: "Delete" }));
    // The form stays on the deleted entry while the drawer slides out.
    await expect(screen.queryByText("Entry not found")).toBeNull();
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(listed(canvas)).toEqual(["Garden work"]);
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await expect(screen.queryByRole("dialog")).toBeNull();
    await expect(openEntry()).toBeUndefined();
    await noUndoOffer();
  },
};

export const TwoQuickDeletesAreUndoneSeparately: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2));
    await expect(canvas.queryByRole("button", { name: "Studio work" })).toBeNull();
    await undoLast();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1));
    await expect(listed(canvas)).toHaveLength(1);
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

export const AnEmptyListSaysSoAndOffersTheNextStep: Story = {
  beforeEach: keepNoticesOpen,
  args: { address: `${OVERVIEW}?client=garden` },
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Garden work");
    const empty = within((await canvas.findByText("No entries here")).parentElement!);
    await userEvent.click(empty.getByRole("button", { name: "New entry" }));
    await screen.findByRole("dialog", { name: "New entry" });
    await expect(openEntry()).toBe("new");
    await userEvent.click(screen.getByRole("button", { name: "Close editor" }));
    await noDrawer();
    await undoLast();
    await expect(await canvas.findByRole("button", { name: "Garden work" })).toBeVisible();
    await expect(canvas.queryByText("No entries here")).toBeNull();
    await noUndoOffer();
  },
};

export const AFailedLoadCanBeRetried: Story = {
  args: { address: `${OVERVIEW}?edit=flaky` },
  play: async () => {
    const drawer = within(await screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    const failure = await drawer.findByRole("alert");
    await expect(failure).toHaveTextContent("This entry could not be loaded.");
    await userEvent.click(within(failure).getByRole("button", { name: "Try again" }));
    await expect(await drawer.findByRole("textbox", { name: "Name" })).toHaveValue("Flaky work");
    await expect(drawer.queryByRole("alert")).toBeNull();
    await screen.findByRole("dialog", { name: "Flaky work" });
  },
};

export const AnOldLinkToADeletedEntrySaysItWasNotFound: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    await waitFor(() => expect(listed(canvas)).toEqual(["Garden work"]));
    openRouter.history.push(`${OVERVIEW}?edit=studio`);
    const drawer = within(await screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    await expect(await drawer.findByRole("alert")).toHaveTextContent("Entry not found");
    await userEvent.click(drawer.getByRole("button", { name: "Close" }));
    await noDrawer();
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

export const AnUnknownEntrySaysSoAndOffersOnlyToClose: Story = {
  args: { address: `${OVERVIEW}?edit=no-such-entry` },
  play: async () => {
    const drawer = within(await screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    const failure = await drawer.findByRole("alert");
    await expect(failure).toHaveTextContent("Entry not found");
    await expect(within(failure).getAllByRole("button")).toHaveLength(1);
    await expect(drawer.queryByRole("textbox")).toBeNull();
    await expect(drawer.queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(within(failure).getByRole("button", { name: "Close" }));
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
  },
};
