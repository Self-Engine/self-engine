// For Stories only, here and in the app. A subpath of its own, so that `storybook` stays out of
// what the package's main entry ships.

import { closed, settled } from "@self-engine/ui/story-surfaces";
import { shellCommands } from "./shell-commands.ts";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

/** Follows a spied platform too, because the hotkey library reads it at each press. */
export const modKey = () =>
  /mac/i.test(navigator.platform + navigator.userAgent) ? "Meta" : "Control";

/** Presses a shortcut the way this platform spells `Mod`. */
export const pressWithMod = (key: string) =>
  userEvent.keyboard(`{${modKey()}>}${key}{/${modKey()}}`);

/** Fetch code before rendering; never call contribution loaders after story mocks are installed. */
export async function loadStoryShell() {
  await Promise.all([
    import("./shortcut-bindings.tsx"),
    import("./command-palette-dialog.tsx"),
    ...(shellCommands.commands ?? []).map((command) => command.load()),
    ...(import.meta.env.MODE === "test" ? [import("vite-plus/test/browser")] : []),
  ]);
}

const PALETTE_NAME = "Command palette";

export const paletteDialog = (name = PALETTE_NAME) => screen.queryByRole("dialog", { name });

/**
 * The bindings and the palette's code load late, so an early press is lost. Presses again only
 * while no palette is there: a press on one that still fades in would close it.
 */
export async function openPalette(name = PALETTE_NAME): Promise<HTMLElement> {
  await waitFor(
    async () => {
      if (paletteDialog(name) === null) await pressWithMod("k");
      await expect(paletteDialog(name)).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  return settled(paletteDialog(name)!);
}

export const paletteGone = () => closed(() => paletteDialog());

/** The name of the question that guards a draft. */
export const QUESTION = "Discard changes?";

export const asked = () => settled(screen.findByRole("dialog", { name: QUESTION }));

export const answer = async (label: "Discard" | "Keep editing") =>
  userEvent.click(within(await asked()).getByRole("button", { name: label }));

export const noQuestion = () => closed(() => screen.queryByRole("dialog", { name: QUESTION }));
