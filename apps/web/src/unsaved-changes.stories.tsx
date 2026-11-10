import type { Meta, StoryObj } from "@storybook/react-vite";
import { createHashHistory, RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { createAppRouter } from "./app-router.ts";
import { settingsStore } from "./settings-store.ts";

type Canvas = ReturnType<typeof within>;

let openRouter: ReturnType<typeof createAppRouter>;

/** Hash history as in Electron: only a real history entry can prove Back and Forward. */
function AppAt({ address }: { readonly address: string }) {
  const [history] = useState(() => {
    const created = createHashHistory();
    created.replace(address);
    return created;
  });
  const [router] = useState(() => {
    openRouter = createAppRouter(history);
    return openRouter;
  });
  useEffect(() => () => history.destroy(), [history]);
  return <RouterProvider router={router} />;
}

const OVERVIEW = "/placeholder-alpha/overview";

const meta = {
  title: "App/Unsaved changes",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  beforeEach: () => {
    const original = window.location.href;
    // The test runner's query, which the hash parser would add to the last parameter after Back.
    window.history.replaceState(null, "", window.location.pathname);
    return () => window.history.replaceState(null, "", original);
  },
  args: { address: OVERVIEW },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const QUESTION = "Discard changes?";

const address = () => ({
  pathname: openRouter.state.location.pathname,
  edit: (openRouter.state.location.search as { readonly edit?: unknown }).edit,
});

const asked = () => screen.findByRole("dialog", { name: QUESTION });
const answer = async (label: "Discard" | "Keep editing") =>
  userEvent.click(within(await asked()).getByRole("button", { name: label }));
const noQuestion = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull());
const noDrawer = (name: string) =>
  waitFor(() => expect(screen.queryByRole("dialog", { name })).toBeNull());

/** Opens the entry from the list, so that there is a history entry to go back from. */
async function editStudio(canvas: Canvas) {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = await screen.findByRole("dialog", { name: "Studio work" });
  const name = await within(drawer).findByRole("textbox", { name: "Name" });
  await userEvent.type(name, " changed");
  return { drawer: within(drawer), name };
}

export const BackAsksAndDiscardGoesBack: Story = {
  play: async ({ canvas }) => {
    await editStudio(canvas);
    window.history.back();
    await asked();
    await expect(address().edit).toBe("studio");
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address()).toEqual({ pathname: OVERVIEW, edit: undefined }));
    await expect(window.location.hash).not.toContain("edit=studio");
  },
};

export const BackAndKeepEditingLeavesTheAddressAndTheDraft: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudio(canvas);
    window.history.back();
    await asked();
    await answer("Keep editing");
    await noQuestion();
    await waitFor(() => expect(window.location.hash).toContain("edit=studio"));
    await expect(address().edit).toBe("studio");
    await expect(name).toHaveValue("Studio work changed");
    await waitFor(() => expect(name).toHaveFocus());
  },
};

export const ForwardAsksAndDiscardGoesForward: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Studio work" }));
    await userEvent.click(await drawer.findByRole("button", { name: "Cancel" }));
    await noDrawer("Studio work");
    // Back to the entry, then change it, so that Forward would lose the change.
    window.history.back();
    const reopened = await screen.findByRole("dialog", { name: "Studio work" });
    await userEvent.type(await within(reopened).findByRole("textbox", { name: "Name" }), "!");
    window.history.forward();
    await asked();
    await expect(address().edit).toBe("studio");
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address().edit).toBeUndefined());
  },
};

export const ACommandThatWouldSwapTheEntryAsks: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudio(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "New entry" }));
    await asked();
    await answer("Keep editing");
    await noQuestion();
    await expect(address().edit).toBe("studio");
    await expect(name).toHaveValue("Studio work changed");
    await userEvent.click(canvas.getByRole("button", { name: "New entry" }));
    await answer("Discard");
    await screen.findByRole("dialog", { name: "New entry" });
    await waitFor(() => expect(address().edit).toBe("new"));
  },
};

export const LeavingThePageAsks: Story = {
  play: async ({ canvas }) => {
    await editStudio(canvas);
    await userEvent.click(canvas.getByRole("link", { name: "Archive" }));
    await asked();
    await expect(address().pathname).toBe(OVERVIEW);
    await answer("Discard");
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await noDrawer("Studio work");
  },
};

export const AFilterChangeThatKeepsTheEntryOpenDoesNotAsk: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudio(canvas);
    await userEvent.click(canvas.getByRole("link", { name: "Garden" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Studio work" })).toBeNull());
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(address().edit).toBe("studio");
    await expect(name).toHaveValue("Studio work changed");
  },
};

export const CancelWithoutChangesClosesAtOnce: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Garden work" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Garden work" }));
    await userEvent.click(await drawer.findByRole("button", { name: "Cancel" }));
    await noDrawer("Garden work");
    await expect(address().edit).toBeUndefined();
  },
};

export const CancelWithChangesAsks: Story = {
  play: async ({ canvas }) => {
    const { drawer, name } = await editStudio(canvas);
    await userEvent.click(drawer.getByRole("button", { name: "Cancel" }));
    await answer("Keep editing");
    await noQuestion();
    await expect(name).toHaveValue("Studio work changed");
  },
};

export const SavingClosesWithoutAskingAndTheListShowsIt: Story = {
  args: { address: `${OVERVIEW}?edit=new` },
  play: async ({ canvas }) => {
    const drawer = within(await screen.findByRole("dialog", { name: "New entry" }));
    await userEvent.type(await drawer.findByRole("textbox", { name: "Name" }), "Saved from a story");
    await userEvent.click(drawer.getByRole("button", { name: "Save" }));
    await noDrawer("New entry");
    await expect(address().edit).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(await canvas.findByRole("button", { name: "Saved from a story" })).toBeVisible();
  },
};
