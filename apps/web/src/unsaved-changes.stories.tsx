import type { Meta, StoryObj } from "@storybook/react-vite";
import { createHashHistory, RouterProvider } from "@tanstack/react-router";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { DataProvider, type PortAccess } from "@self-engine/data-client/react";
import type { PageCommand } from "@self-engine/shell";
import { useEffect, useState } from "react";
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import { createAppRouter } from "./app-router.ts";
import { settingsStore } from "./settings-store.ts";
import {
  answer,
  asked,
  editInAddress,
  editStudio,
  noDrawer,
  noQuestion,
  pressWithMod,
  QUESTION,
} from "./story-app.tsx";
import { placeholderAlphaAnswers, STUDIO_WORK } from "@self-engine/placeholder-alpha/testing";

type Canvas = ReturnType<typeof within>;

let openRouter: ReturnType<typeof createAppRouter>;

/** Hash history as in Electron: only a real history entry can prove Back and Forward. */
function AppAt({ address, access }: { readonly address: string; readonly access: PortAccess }) {
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
  return (
    <DataProvider access={access}>
      <RouterProvider router={router} />
    </DataProvider>
  );
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
  args: { address: OVERVIEW, access: placeholderAlphaAnswers() },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const address = () => ({
  pathname: openRouter.state.location.pathname,
  edit: editInAddress(openRouter),
});

export const BackAsksAndDiscardGoesBack: Story = {
  play: async ({ canvas }) => {
    await editStudio(canvas);
    window.history.back();
    await asked();
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address()).toEqual({ pathname: OVERVIEW, edit: undefined }));
    await expect(window.location.hash).not.toContain(`edit=${STUDIO_WORK.id}`);
  },
};

export const BackAndKeepEditingLeavesTheAddressAndTheDraft: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudio(canvas);
    window.history.back();
    await asked();
    await answer("Keep editing");
    await noQuestion();
    await waitFor(() => expect(window.location.hash).toContain(`edit=${STUDIO_WORK.id}`));
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await expect(name).toHaveValue("Studio work changed");
    await waitFor(() => expect(name).toHaveFocus());
  },
};

/** Leaves the entry again and comes back to it, so that one history entry lies ahead of it. */
async function editStudioWithAnEntryAhead(canvas: Canvas) {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = within(await screen.findByRole("dialog", { name: "Studio work" }));
  await userEvent.click(await drawer.findByRole("button", { name: "Cancel" }));
  await noDrawer("Studio work");
  window.history.back();
  const reopened = await screen.findByRole("dialog", { name: "Studio work" });
  await userEvent.type(await within(reopened).findByRole("textbox", { name: "Name" }), "!");
}

export const ForwardAsksAndDiscardGoesForward: Story = {
  play: async ({ canvas }) => {
    await editStudioWithAnEntryAhead(canvas);
    window.history.forward();
    await asked();
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address().edit).toBeUndefined());
  },
};

export const TheAddressStaysOnTheEntryWhileTheQuestionIsOpen: Story = {
  play: async ({ canvas }) => {
    await editStudio(canvas);
    window.history.back();
    await asked();
    await waitFor(() => expect(window.location.hash).toContain(`edit=${STUDIO_WORK.id}`));
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await answer("Keep editing");
    await noQuestion();
  },
};

/** Waits for the browser to have moved through its history this many times. */
const traversals = (count: number) =>
  new Promise<void>((resolve) => {
    let left = count;
    const landed = () => {
      left -= 1;
      if (left > 0) return;
      window.removeEventListener("popstate", landed);
      resolve();
    };
    window.addEventListener("popstate", landed);
  });

/** The press itself, and the traversal that undoes it because a question is already open. */
async function traverseWhileAsked(press: () => void) {
  const undone = traversals(2);
  press();
  await undone;
}

const historyIndex = () => openRouter.history.location.state.__TSR_index;

/** A group only changes the address (D262): its link is marked once the address holds it. */
const groupIsCurrent = (canvas: Canvas, name: string) =>
  waitFor(() => expect(canvas.getByRole("link", { name })).toHaveAttribute("aria-current", "true"));

/** Picks a group first, so that two history entries lie behind the open drawer. */
async function editStudioWithTwoEntriesBehind(canvas: Canvas) {
  await userEvent.click(await canvas.findByRole("link", { name: "Studio" }));
  await groupIsCurrent(canvas, "Studio");
  return editStudio(canvas);
}

export const BackTwiceAndDiscardGoesBackOneStep: Story = {
  play: async ({ canvas }) => {
    await editStudioWithTwoEntriesBehind(canvas);
    window.history.back();
    await asked();
    await traverseWhileAsked(() => window.history.back());
    await waitFor(() => expect(window.location.hash).toContain(`edit=${STUDIO_WORK.id}`));
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address().edit).toBeUndefined());
    await expect(window.location.hash).not.toContain(`edit=${STUDIO_WORK.id}`);
    await expect(window.location.hash).toContain("client=studio");
  },
};

export const BackTwiceAndKeepEditingLeavesBackWorking: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudioWithTwoEntriesBehind(canvas);
    window.history.back();
    await asked();
    await traverseWhileAsked(() => window.history.back());
    await answer("Keep editing");
    await noQuestion();
    await waitFor(() => expect(window.location.hash).toContain(`edit=${STUDIO_WORK.id}`));
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await expect(name).toHaveValue("Studio work changed");
    // The next Back is an ordinary one: it asks again and is not swallowed.
    window.history.back();
    await asked();
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address().edit).toBeUndefined());
    await expect(window.location.hash).toContain("client=studio");
  },
};

export const BackThenForwardAndDiscardGoesBack: Story = {
  play: async ({ canvas }) => {
    await editStudioWithAnEntryAhead(canvas);
    const onTheEntry = historyIndex();
    window.history.back();
    await asked();
    const landed = traversals(1);
    window.history.forward();
    await landed;
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address().edit).toBeUndefined());
    await waitFor(() => expect(historyIndex()).toBe(onTheEntry - 1));
  },
};

/** Types a hash by hand first: the browser adds that entry, and nothing gives it a history index. */
async function editStudioWithAHandTypedEntryBehind(canvas: Canvas) {
  await canvas.findByRole("button", { name: "Studio work" });
  window.location.hash = `${OVERVIEW}?client=studio`;
  await groupIsCurrent(canvas, "Studio");
  await expect(window.history.state).toBeNull();
  return editStudio(canvas);
}

export const BackOntoAnEntryWithoutAnIndexStillAsks: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudioWithAHandTypedEntryBehind(canvas);
    window.history.back();
    await asked();
    await answer("Keep editing");
    await noQuestion();
    await waitFor(() => expect(window.location.hash).toContain(`edit=${STUDIO_WORK.id}`));
    await expect(name).toHaveValue("Studio work changed");
    window.history.back();
    await asked();
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address().edit).toBeUndefined());
    await expect(window.location.hash).not.toContain(`edit=${STUDIO_WORK.id}`);
    await expect(window.location.hash).toContain("client=studio");
  },
};

export const ACommandThatWouldSwapTheEntryAsks: Story = {
  play: async ({ canvas }) => {
    const { name } = await editStudio(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "New entry" }));
    await asked();
    await answer("Keep editing");
    await noQuestion();
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await expect(name).toHaveValue("Studio work changed");
    await userEvent.click(canvas.getByRole("button", { name: "New entry" }));
    await answer("Discard");
    await screen.findByRole("dialog", { name: "New entry" });
    await waitFor(() => expect(address().edit).toBe("new"));
  },
};

const pressNew = () => pressWithMod("n");
const spyOnNewEntry = () => spyOn(alpha.commands![0] as { load: PageCommand["load"] }, "load");
let newEntry: ReturnType<typeof spyOnNewEntry>;

/** The bindings load after the first paint. Ends on the first press that lands, with no drawer. */
async function shortcutsArrived() {
  await waitFor(async () => {
    await pressNew();
    await expect(newEntry).toHaveBeenCalled();
  });
  const drawer = within(await screen.findByRole("dialog", { name: "New entry" }));
  await userEvent.click(await drawer.findByRole("button", { name: "Cancel" }));
  await noDrawer("New entry");
}

export const AShortcutThatWouldSwapTheEntryAsksAndKeepEditingKeepsIt: Story = {
  beforeEach: () => {
    newEntry = spyOnNewEntry();
    return () => newEntry.mockRestore();
  },
  play: async ({ canvas }) => {
    await shortcutsArrived();
    const { name } = await editStudio(canvas);
    await expect(name).toHaveFocus();
    newEntry.mockClear();
    await pressNew();
    await asked();
    await expect(newEntry).toHaveBeenCalledOnce();
    // Pressed again over the question: it stays one question, and nothing else starts.
    await pressNew();
    await expect(newEntry).toHaveBeenCalledOnce();
    await answer("Keep editing");
    await noQuestion();
    await expect(address().edit).toBe(STUDIO_WORK.id);
    await expect(name).toHaveValue("Studio work changed");
    await waitFor(() => expect(name).toHaveFocus());
  },
};

export const AShortcutThatWouldSwapTheEntryAsksAndDiscardFinishesTheCommand: Story = {
  beforeEach: () => {
    newEntry = spyOnNewEntry();
    return () => newEntry.mockRestore();
  },
  play: async ({ canvas }) => {
    await shortcutsArrived();
    await editStudio(canvas);
    await pressNew();
    await answer("Discard");
    await screen.findByRole("dialog", { name: "New entry" });
    await waitFor(() => expect(address().edit).toBe("new"));
  },
};

export const LeavingTheViewAsks: Story = {
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
    await groupIsCurrent(canvas, "Garden");
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(address().edit).toBe(STUDIO_WORK.id);
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

/** The list stays as it is: a Fixed Answer changes nothing (D255); the Port test shows the reload. */
export const SavingClosesWithoutAsking: Story = {
  args: { address: `${OVERVIEW}?edit=new` },
  play: async ({ canvas }) => {
    const drawer = within(await screen.findByRole("dialog", { name: "New entry" }));
    await userEvent.type(
      await drawer.findByRole("textbox", { name: "Name" }),
      "Saved from a story",
    );
    await userEvent.click(drawer.getByRole("button", { name: "Save" }));
    await noDrawer("New entry");
    await expect(address().edit).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(await canvas.findByRole("button", { name: "Studio work" })).toBeVisible();
  },
};
