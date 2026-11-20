import { Button, Stack, Text, TextInput } from "@mantine/core";
import type { Meta } from "@storybook/react-vite";
import { type ComponentType, useState } from "react";
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import { notifyChoice } from "@self-engine/ui";
import { z } from "zod";
import {
  defineOpenCommand,
  type IndicatorPanelProps,
  type IndicatorWithPanel,
  type ModuleIndicator,
  type ModuleIndicatorWithPanelProps,
  Shell,
  type ShellContribution,
  type ShellProps,
} from "./index.ts";
import { INDICATOR_PANEL_WIDTH } from "./indicator-panel.tsx";
import {
  atViewport,
  type Canvas,
  ENTRIES,
  INDICATOR_ARRIVES,
  indicatorPlaceOf,
  openPalette,
  paletteGone,
  pressEscape,
  type Story,
  shellMeta,
  storyRouting,
  VIEWPORTS,
  widthOf,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Indicator Panel",
  component: Shell,
} satisfies Meta<ShellProps>;
export default meta;

const projects = ENTRIES[0]!;
const time = ENTRIES[1]!;
const third = ENTRIES[2]!;

/** An indicator whose one button opens its panel, as `placeholder-alpha`'s does. */
function PanelIndicator({ togglePanel }: ModuleIndicatorWithPanelProps) {
  return (
    <Button onClick={togglePanel} size="compact-sm" variant="subtle">
      Open panel
    </Button>
  );
}

/** One field and the two ways the content itself closes the panel. */
function PanelContent({ onCancel, onDone }: IndicatorPanelProps) {
  return (
    <Stack gap="xs">
      <TextInput label="Note" />
      <Button onClick={onCancel} variant="default">
        Cancel
      </Button>
      <Button onClick={onDone}>Done</Button>
    </Stack>
  );
}

const withPanel = (
  content: () => Promise<{ default: ComponentType<IndicatorPanelProps> }>,
): ModuleIndicator => ({
  load: async () => ({ default: PanelIndicator }),
  panel: content,
});

/** A new indicator each call: the Shell keeps loaded code per `load`, as React.lazy does. */
const panelIndicator = () => withPanel(async () => ({ default: PanelContent }));

const WITH_PANEL = { contributions: [{ ...projects, indicator: panelIndicator() }, time, third] };

const indicatorButton = (canvas: Canvas) =>
  canvas.findByRole("button", { name: "Open panel" }, INDICATOR_ARRIVES);

/** The panel is named after its module, as the Edit Drawer is. */
const panel = () => screen.findByRole("dialog", { name: "Projects" });
const panelGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull());

/** In the popover on its first field; in the sheet, a modal, on its first control. */
async function expectFocusInPanel() {
  const dialog = await panel();
  await within(dialog).findByRole("textbox", { name: "Note" });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
}

async function openByClick(canvas: Canvas) {
  const button = await indicatorButton(canvas);
  await userEvent.click(button);
  await expectFocusInPanel();
  return button;
}

const popoverAt = (viewport: keyof typeof VIEWPORTS): Story => ({
  ...atViewport(viewport),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    const button = await openByClick(canvas);
    const dialog = await panel();
    await expect(within(dialog).getByRole("textbox", { name: "Note" })).toHaveFocus();
    const place = indicatorPlaceOf(button).getBoundingClientRect();
    const frame = dialog.getBoundingClientRect();
    // Below the indicator, ending with it, in the Shell's fixed width.
    await expect(frame.top).toBeGreaterThanOrEqual(place.bottom);
    await expect(frame.right).toBeCloseTo(place.right, 0);
    await expect(widthOf(dialog)).toBe(INDICATOR_PANEL_WIDTH);
  },
});

export const APopoverBelowTheIndicatorAtTheWideStep = popoverAt("wide");
export const APopoverBelowTheIndicatorAtTheMediumStep = popoverAt("medium");
export const APopoverBelowTheIndicatorAtTheNarrowStep = popoverAt("narrow");

export const ASheetFromBelowOnThePhone: Story = {
  ...atViewport("phone"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    await openByClick(canvas);
    const dialog = await panel();
    await waitFor(() =>
      expect(Math.round(dialog.getBoundingClientRect().bottom)).toBe(window.innerHeight),
    );
    await expect(widthOf(dialog)).toBe(window.innerWidth);
    await pressEscape();
    await panelGone();
  },
};

const openByKey = (key: string): Story => ({
  ...atViewport("wide"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    const button = await indicatorButton(canvas);
    button.focus();
    await userEvent.keyboard(key);
    await expectFocusInPanel();
    await pressEscape();
    await panelGone();
    await waitFor(() => expect(button).toHaveFocus());
  },
});

export const OpensWithEnterAndEscapeReturnsTheFocus = openByKey("{Enter}");
export const OpensWithSpace = openByKey(" ");

export const AClickOutsideCloses: Story = {
  ...atViewport("wide"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    const button = await openByClick(canvas);
    await userEvent.click(canvas.getByText("Page content"));
    await panelGone();
    await waitFor(() => expect(button).toHaveFocus());
  },
};

export const ASecondClickOnTheIndicatorCloses: Story = {
  ...atViewport("wide"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    const button = await openByClick(canvas);
    await userEvent.click(button);
    await panelGone();
    await waitFor(() => expect(button).toHaveFocus());
  },
};

const closedByTheContent = (label: "Done" | "Cancel"): Story => ({
  ...atViewport("wide"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    const button = await openByClick(canvas);
    await userEvent.click(within(await panel()).getByRole("button", { name: label }));
    await panelGone();
    await waitFor(() => expect(button).toHaveFocus());
  },
});

export const DoneFromTheContentCloses = closedByTheContent("Done");
export const CancelFromTheContentCloses = closedByTheContent("Cancel");

export const OpeningASecondPanelClosesTheFirst: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      { ...projects, indicator: panelIndicator() },
      time,
      { ...third, indicator: panelIndicator() },
    ],
  },
  play: async ({ canvas }) => {
    await waitFor(
      () => expect(canvas.getAllByRole("button", { name: "Open panel" })).toHaveLength(2),
      INDICATOR_ARRIVES,
    );
    const [first, second] = canvas.getAllByRole("button", { name: "Open panel" });
    await userEvent.click(first!);
    await panel();
    await userEvent.click(second!);
    const other = await screen.findByRole("dialog", { name: "Third module" });
    await panelGone();
    await expect(other).toBeVisible();
    await expect(screen.getAllByRole("dialog")).toHaveLength(1);
  },
};

/** Holds the page the way the app's router does, with a way to another View. */
function PageChangingShell(args: ShellProps) {
  const [module, setModule] = useState(args.activeModule);
  return (
    <>
      <button
        onClick={() => setModule(third)}
        style={{ position: "fixed", bottom: 0, left: 0, zIndex: 1000 }}
      >
        Go to another page
      </button>
      <Shell {...args} activeModule={module} activeView={module?.views[0]} />
    </>
  );
}

export const AChangeOfPageCloses: Story = {
  ...atViewport("wide"),
  args: WITH_PANEL,
  render: (args) => <PageChangingShell {...args} />,
  play: async ({ canvas }) => {
    await openByClick(canvas);
    // Not by a click, which would close the panel as a click outside.
    canvas.getByRole("button", { name: "Go to another page" }).click();
    await expect(await canvas.findByRole("heading", { name: "Overview" })).toBeVisible();
    await panelGone();
  },
};

export const ThePaletteOpensOverThePanelAndTakesEscapeFirst: Story = {
  ...atViewport("wide"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    await openByClick(canvas);
    const palette = await openPalette();
    await userEvent.click(within(palette).getByRole("textbox"));
    await expect(await panel()).toBeVisible();
    await pressEscape();
    await paletteGone();
    await expect(await panel()).toBeVisible();
    await pressEscape();
    await panelGone();
  },
};

/** Counts every loading state that enters the page until `stop`, however briefly it stays. */
function watchForLoadingStates() {
  let seen = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[role="status"]') || node.querySelector('[role="status"]')) seen += 1;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return {
    stop: () => {
      observer.disconnect();
      return seen;
    },
  };
}

/**
 * Counts the loads of the panel's code, so a story sees the idle preload. Each load takes a moment,
 * as fetching a chunk does: code already in memory arrives before React would show a fallback.
 */
function countedPanel() {
  let loads = 0;
  const indicator = withPanel(async () => {
    loads += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { default: PanelContent };
  });
  return { indicator, loads: () => loads };
}

const counted = countedPanel();

export const AfterThePreloadTheFirstOpeningDoesNotWait: Story = {
  ...atViewport("wide"),
  args: { contributions: [{ ...projects, indicator: counted.indicator }, time, third] },
  play: async ({ canvas }) => {
    const button = await indicatorButton(canvas);
    await waitFor(() => expect(counted.loads()).toBe(1), INDICATOR_ARRIVES);
    // The moment the load takes, and a turn for the loaded code to settle.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const loadingStates = watchForLoadingStates();
    await userEvent.click(button);
    const dialog = await panel();
    await expect(within(dialog).getByRole("textbox", { name: "Note" })).toBeInTheDocument();
    // Not once, between the click and the content.
    await expect(loadingStates.stop()).toBe(0);
    await expect(counted.loads()).toBe(1);
  },
};

/** Fails until the story lets it succeed, as a chunk that could not be fetched. */
function failingPanel() {
  let fails = true;
  const indicator = withPanel(async () => {
    if (fails) throw new Error("The panel's code could not be loaded");
    return { default: PanelContent };
  });
  return {
    indicator,
    recover: () => {
      fails = false;
    },
  };
}

const failing = failingPanel();

export const AFailedLoadStaysInThePanelAndRetries: Story = {
  ...atViewport("wide"),
  args: { contributions: [{ ...projects, indicator: failing.indicator }, time, third] },
  play: async ({ canvas }) => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    const button = await indicatorButton(canvas);
    await userEvent.click(button);
    const dialog = await panel();
    const retry = await within(dialog).findByRole("button", { name: "Try again" });
    // The rest of the Shell works on.
    await expect(button).toBeVisible();
    failing.recover();
    await userEvent.click(retry);
    const field = await within(dialog).findByRole("textbox", { name: "Note" });
    await waitFor(() => expect(field).toBeVisible());
    // React reports the failure that the boundary caught.
    await expect(reported).toHaveBeenCalled();
    reported.mockRestore();
  },
};

function ThrowingContent(): never {
  throw new Error("The panel's content failed while drawing");
}

export const AFailingContentStaysInThePanelWhichStillCloses: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      { ...projects, indicator: withPanel(async () => ({ default: ThrowingContent })) },
      time,
      third,
    ],
  },
  play: async ({ canvas }) => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    const button = await indicatorButton(canvas);
    await userEvent.click(button);
    const dialog = await panel();
    const alert = await within(dialog).findByRole("alert");
    await waitFor(() => expect(alert).toBeVisible());
    await expect(reported).toHaveBeenCalled();
    reported.mockRestore();
    await expect(within(dialog).getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(canvas.getByText("Page content")).toBeVisible();
    await pressEscape();
    await panelGone();
  },
};

function TallContent() {
  return (
    <Stack>
      <TextInput label="Note" />
      {Array.from({ length: 40 }, (_, line) => (
        <Text key={line}>Line {line + 1}</Text>
      ))}
    </Stack>
  );
}

export const TallContentScrollsInThePanel: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      { ...projects, indicator: withPanel(async () => ({ default: TallContent })) },
      time,
      third,
    ],
  },
  play: async ({ canvas }) => {
    await openByClick(canvas);
    const dialog = await panel();
    await expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
  },
};

/** The indicator entry a Command and a Notice name, so only an indicator with a panel compiles. */
const OPENED_FROM_ELSEWHERE = {
  load: async () => ({ default: PanelIndicator }),
  panel: async () => ({ default: PanelContent }),
} satisfies IndicatorWithPanel;

const PROJECTS_WITH_COMMANDS: ShellContribution = {
  ...projects,
  indicator: OPENED_FROM_ELSEWHERE,
  commands: [
    {
      id: "open-note",
      kind: "open",
      label: { id: "story-Open the note", message: "Open the note" },
      load: async () => ({
        default: defineOpenCommand({
          description: "Opens the panel of the module's indicator.",
          schema: z.object({}),
          run: (_input, { openIndicatorPanel }) => openIndicatorPanel(OPENED_FROM_ELSEWHERE),
        }),
      }),
    },
    {
      id: "remind",
      kind: "open",
      label: { id: "story-Remind me", message: "Remind me" },
      load: async () => ({
        default: defineOpenCommand({
          description: "Shows a Notice whose action opens the module's panel.",
          schema: z.object({}),
          run: (_input, { openIndicatorPanel }) => {
            notifyChoice({
              message: "The timer still runs.",
              actions: [
                { label: "Stop at …", run: () => openIndicatorPanel(OPENED_FROM_ELSEWHERE) },
              ],
            });
          },
        }),
      }),
    },
  ],
};

async function startFromThePalette(canvas: Canvas, label: string) {
  // The indicators' code arrives in an idle moment; the panel opens either way once it has.
  await indicatorButton(canvas);
  await openPalette();
  await userEvent.keyboard(`${label}{Enter}`);
  await paletteGone();
}

export const ACommandOpensThePanelWhileAnotherModuleIsActive: Story = {
  ...atViewport("wide"),
  // Time is active; the Command belongs to Projects.
  args: { contributions: [PROJECTS_WITH_COMMANDS, time, third] },
  play: async ({ canvas }) => {
    await startFromThePalette(canvas, "open the note");
    await expectFocusInPanel();
  },
};

export const TheActionOfANoticeOpensThePanel: Story = {
  ...atViewport("wide"),
  args: { contributions: [PROJECTS_WITH_COMMANDS, time, third] },
  play: async ({ canvas }) => {
    await startFromThePalette(canvas, "remind me");
    await userEvent.click(await screen.findByRole("button", { name: "Stop at …" }));
    await expectFocusInPanel();
  },
};

/** Keeps the Edit Drawer open, as an address with `edit` does. */
function DrawerContent() {
  return <TextInput label="Entry name" />;
}

export const ACommandPutsThePanelOverTheEditDrawer: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [PROJECTS_WITH_COMMANDS, time, third],
    activeModule: { ...time, editDrawer: async () => ({ default: DrawerContent }) },
    routing: storyRouting({ edit: "entry" }),
  },
  play: async ({ canvas }) => {
    const drawer = await screen.findByRole("dialog", { name: "Time" });
    await within(drawer).findByRole("textbox", { name: "Entry name" });
    await startFromThePalette(canvas, "open the note");
    await expectFocusInPanel();
    const note = within(await panel()).getByRole("textbox", { name: "Note" });
    const { left, top, width, height } = note.getBoundingClientRect();
    // On top: what a pointer at the field's middle reaches is the field.
    await expect(document.elementFromPoint(left + width / 2, top + height / 2)).toBe(note);
    await userEvent.type(note, "typed over the drawer");
    await expect(note).toHaveValue("typed over the drawer");
    // Escape leaves the panel first and keeps the drawer.
    await pressEscape();
    await panelGone();
    await expect(screen.getByRole("dialog", { name: "Time" })).toBeVisible();
  },
};
