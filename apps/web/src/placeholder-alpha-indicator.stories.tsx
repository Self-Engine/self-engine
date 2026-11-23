// The Module Indicator of `placeholder-alpha` in the whole app: on every page, on all four Layout
// Steps, in its full form on the wide and medium step and its short form on the narrow step and
// the phone (D357). The counter opens its Indicator Panel, whose form of `forms` asks before its
// unsaved changes are lost; a Command of the module opens the panel as well (D358).

import { placeholderAlphaAnswers } from "@self-engine/placeholder-alpha/testing";
import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/geometry";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { closed } from "@self-engine/ui/story-surfaces";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { answer, asked, noQuestion } from "@self-engine/shell/story-interactions";
import { AppAt, loadStoryApp, openPalette, paletteGone } from "./story-app.tsx";

const viewport = (name: string, width: number) => ({
  name,
  styles: { width: `${width}px`, height: "800px" },
});
const VIEWPORTS = {
  wide: viewport("Wide", SHELL_REFERENCE_WIDTHS.wide),
  medium: viewport("Medium", SHELL_REFERENCE_WIDTHS.medium),
  narrow: viewport("Narrow", SHELL_REFERENCE_WIDTHS.narrow),
  phone: viewport("Phone", 390),
};

const meta = {
  title: "App/Placeholder Alpha indicator",
  component: AppAt,
  parameters: { layout: "fullscreen", viewport: { options: VIEWPORTS } },
  loaders: [loadStoryApp],
  args: { address: "/placeholder-beta/overview", access: placeholderAlphaAnswers() },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

/** The indicator's code loads in an idle moment, which a busy test browser can put off. */
const ARRIVES = { timeout: 4000 };

const contentHeader = (canvas: Canvas) =>
  canvas.getByRole("heading", { level: 1 }).parentElement!.parentElement!;

async function expectFullForm(canvas: Canvas) {
  const button = await canvas.findByRole("button", { name: "Count up" }, ARRIVES);
  await expect(contentHeader(canvas).contains(button)).toBe(true);
  await userEvent.click(button);
  await expect(within(contentHeader(canvas)).getByText("Counted 1")).toBeVisible();
}

async function expectShortForm(canvas: Canvas) {
  const header = within(contentHeader(canvas));
  await expect(await header.findByText("0", {}, ARRIVES)).toBeVisible();
  await expect(header.queryByRole("button", { name: "Count up" })).toBeNull();
}

const atStep = (step: keyof typeof VIEWPORTS, address: string): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  args: { address },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    if (step === "wide" || step === "medium") await expectFullForm(canvas);
    else await expectShortForm(canvas);
  },
});

export const FullFormAtTheWideStep = atStep("wide", "/placeholder-beta/overview");
export const FullFormAtTheMediumStep = atStep("medium", "/placeholder-beta/overview");
export const ShortFormAtTheNarrowStep = atStep("narrow", "/placeholder-beta/overview");
export const ShortFormOnThePhone = atStep("phone", "/placeholder-beta/overview");
export const InItsOwnModule = atStep("wide", "/placeholder-alpha/overview");
export const InTheSettings = atStep("wide", "/settings/appearance");

const panelDialog = () => screen.findByRole("dialog", { name: "Placeholder Alpha" });
const panelGone = () => closed(() => screen.queryByRole("dialog", { name: "Placeholder Alpha" }));

const panelAt = (step: keyof typeof VIEWPORTS, counter: string): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    const opener = await within(contentHeader(canvas)).findByRole(
      "button",
      { name: counter },
      ARRIVES,
    );
    // A screen reader hears that the counter opens a panel, and whether it is open.
    await expect(opener).toHaveAttribute("aria-haspopup", "dialog");
    await expect(opener).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(opener);
    const panel = await panelDialog();
    await waitFor(() => expect(opener).toHaveAttribute("aria-expanded", "true"));
    const field = await within(panel).findByRole("textbox", { name: "Note" });
    await userEvent.type(field, "Called the client");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await panelGone();
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
    await waitFor(() => expect(opener).toHaveAttribute("aria-expanded", "false"));
  },
});

export const OpensItsPanel = panelAt("wide", "Counted 0");
export const OpensItsPanelAsASheetOnThePhone = panelAt("phone", "0");

/** The form of `forms` in the panel reports its unsaved changes, as it does in the Edit Drawer. */
export const ItsFormAsksBeforeUnsavedChangesAreLost: Story = {
  globals: { viewport: { value: "wide", isRotated: false } },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    const opener = await within(contentHeader(canvas)).findByRole(
      "button",
      { name: "Counted 0" },
      ARRIVES,
    );
    await userEvent.click(opener);
    const field = await within(await panelDialog()).findByRole("textbox", { name: "Note" });
    await userEvent.type(field, "Called the client");
    await userEvent.click(within(await panelDialog()).getByRole("button", { name: "Cancel" }));
    await asked();
    await answer("Keep editing");
    await noQuestion();
    await expect(field).toHaveValue("Called the client");
    await userEvent.click(within(await panelDialog()).getByRole("button", { name: "Cancel" }));
    await answer("Discard");
    await panelGone();
  },
};

/** From another module's page, through the Command Palette. */
export const ItsCommandOpensThePanel: Story = {
  globals: { viewport: { value: "wide", isRotated: false } },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    await within(contentHeader(canvas)).findByRole("button", { name: "Counted 0" }, ARRIVES);
    await openPalette();
    await userEvent.keyboard("open note{Enter}");
    await paletteGone();
    const field = await within(await panelDialog()).findByRole("textbox", { name: "Note" });
    await waitFor(() => expect(field).toHaveFocus());
  },
};
