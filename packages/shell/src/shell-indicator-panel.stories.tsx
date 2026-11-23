import { Button, Stack, Text, TextInput } from "@mantine/core";
import type { Meta } from "@storybook/react-vite";
import { type ComponentType, useState } from "react";
import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/geometry";
import { closed, settled } from "@self-engine/ui/story-surfaces";
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import { notifyChoice } from "@self-engine/ui";
import { z } from "zod";
import {
  defineOpenCommand,
  type IndicatorPanelProps,
  type IndicatorWithPanel,
  type ModuleIndicator,
  Shell,
  type ShellContribution,
  type ShellProps,
} from "./index.ts";
import { INDICATOR_PANEL_WIDTH, type IndicatorPanelFrameProps } from "./indicator-panel.tsx";
import { IndicatorPanelFrameLoader } from "./lazy-indicator-panel-frame.tsx";
import { IndicatorPanelsProvider, useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
import {
  atFrameWidth,
  atViewport,
  type Canvas,
  drawerOverlay,
  ENTRIES,
  expectCovered,
  expectOnTop,
  INDICATOR_ARRIVES,
  indicatorPlaceOf,
  nextFrame,
  openPalette,
  panel,
  PanelIndicator,
  panelGone,
  paletteGone,
  pressEscape,
  type Story,
  shellMeta,
  storyRouting,
  VIEWPORTS,
  wheelOver,
  widthOf,
  freshPerRun,
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

const SHEET_EXITS = {
  escape: () => pressEscape(),
  overlay: () => userEvent.click(drawerOverlay()),
  closeButton: async () =>
    userEvent.click(within(await panel()).getByRole("button", { name: "Close panel" })),
};

const aSheetFromBelowOnThePhone = (exit: keyof typeof SHEET_EXITS): Story => ({
  ...atViewport("phone"),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    const button = await openByClick(canvas);
    const dialog = await panel();
    await waitFor(() =>
      expect(Math.round(dialog.getBoundingClientRect().bottom)).toBe(window.innerHeight),
    );
    await expect(widthOf(dialog)).toBe(window.innerWidth);
    await SHEET_EXITS[exit]();
    await panelGone();
    await waitFor(() => expect(button).toHaveFocus());
  },
});

export const ASheetFromBelowOnThePhone = aSheetFromBelowOnThePhone("escape");
export const TheSheetClosesByItsOverlay = aSheetFromBelowOnThePhone("overlay");
export const TheSheetClosesByItsCloseButton = aSheetFromBelowOnThePhone("closeButton");

/** Opens at one Layout Step, types, and crosses the phone border while the panel is open. */
const crossingThePhoneBorder = (from: "narrow" | "phone", to: number): Story => ({
  ...atViewport(from),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    await openByClick(canvas);
    await userEvent.type(within(await panel()).getByRole("textbox", { name: "Note" }), "kept");
    await atFrameWidth(to, async () => {
      // A turn for the media query and React to follow the new width.
      await nextFrame();
      await nextFrame();
      const note = within(await panel()).getByRole("textbox", { name: "Note" });
      await expect(note).toHaveValue("kept");
      // A busy browser may still be placing the frame at the new width.
      await waitFor(() => expect(note).toBeVisible());
    });
  },
});

export const TheInputStaysWhenTheWindowShrinksToThePhone = crossingThePhoneBorder("narrow", 390);
export const TheInputStaysWhenTheWindowGrowsFromThePhone = crossingThePhoneBorder(
  "phone",
  SHELL_REFERENCE_WIDTHS.narrow,
);

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
    const other = await settled(screen.findByRole("dialog", { name: "Third module" }));
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

/** Takes the first module out of the module list and brings it back, as a turned-off module. */
function ShellWhoseFirstModuleLeaves(args: ShellProps) {
  const [present, setPresent] = useState(true);
  return (
    <>
      <button
        onClick={() => setPresent(!present)}
        style={{ position: "fixed", bottom: 0, left: 0, zIndex: 1000 }}
      >
        {present ? "Remove the module" : "Bring the module back"}
      </button>
      <Shell {...args} contributions={present ? args.contributions : args.contributions.slice(1)} />
    </>
  );
}

export const AModuleThatLeavesClosesItsPanelForGood: Story = {
  ...atViewport("wide"),
  args: WITH_PANEL,
  render: (args) => <ShellWhoseFirstModuleLeaves {...args} />,
  play: async ({ canvas }) => {
    await openByClick(canvas);
    // Not by a click, which would close the panel as a click outside.
    canvas.getByRole("button", { name: "Remove the module" }).click();
    await panelGone();
    canvas.getByRole("button", { name: "Bring the module back" }).click();
    await indicatorButton(canvas);
    await nextFrame();
    await nextFrame();
    await expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
  },
};

const thePaletteOverThePanel = (step: "wide" | "narrow"): Story => ({
  ...atViewport(step),
  args: WITH_PANEL,
  play: async ({ canvas }) => {
    await openByClick(canvas);
    const note = within(await panel()).getByRole("textbox", { name: "Note" });
    const palette = await openPalette();
    // On top, by the browser's hit test: its field takes the pointer, the panel's field does not.
    await waitFor(() => expectOnTop(within(palette).getByRole("textbox")));
    await expectCovered(note);
    await userEvent.click(within(palette).getByRole("textbox"));
    await expect(await panel()).toBeVisible();
    await pressEscape();
    await paletteGone();
    await expect(await panel()).toBeVisible();
    await pressEscape();
    await panelGone();
  },
});

export const ThePaletteOpensOverThePanelAndTakesEscapeFirst = thePaletteOverThePanel("wide");
export const ThePaletteOpensOverThePanelAtTheNarrowStep = thePaletteOverThePanel("narrow");

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

const counted = freshPerRun(countedPanel, ({ indicator }) => [
  { ...projects, indicator },
  time,
  third,
]);

export const AfterThePreloadTheFirstOpeningDoesNotWait: Story = {
  ...atViewport("wide"),
  ...counted.story,
  play: async ({ canvas }) => {
    const button = await indicatorButton(canvas);
    await waitFor(() => expect(counted.now.loads()).toBe(1), INDICATOR_ARRIVES);
    // The moment the load takes, and a turn for the loaded code to settle.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const loadingStates = watchForLoadingStates();
    await userEvent.click(button);
    const dialog = await panel();
    await expect(within(dialog).getByRole("textbox", { name: "Note" })).toBeInTheDocument();
    // Not once, between the click and the content.
    await expect(loadingStates.stop()).toBe(0);
    await expect(counted.now.loads()).toBe(1);
  },
};

/** An indicator whose code fails to load while offline, as a chunk does, and a counted panel. */
function indicatorWhileOffline() {
  let offline = true;
  let panelLoads = 0;
  const indicator: ModuleIndicator = {
    load: async () => {
      if (offline) throw new Error("The indicator's code could not be loaded");
      return { default: PanelIndicator };
    },
    panel: async () => {
      panelLoads += 1;
      return { default: PanelContent };
    },
  };
  return {
    indicator,
    panelLoads: () => panelLoads,
    goOnline: () => {
      offline = false;
    },
  };
}

const retried = freshPerRun(indicatorWhileOffline, ({ indicator }) => [
  { ...projects, indicator },
  time,
  third,
]);

export const AfterARetriedIndicatorThePanelIsPreloaded: Story = {
  ...atViewport("wide"),
  ...retried.story,
  // React reports the failure that the boundary caught.
  beforeEach: () => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    return () => reported.mockRestore();
  },
  play: async ({ canvas }) => {
    const retry = await canvas.findByRole(
      "button",
      { name: "Projects indicator failed. Try again." },
      INDICATOR_ARRIVES,
    );
    // Long enough for an idle preload to have run, had it run.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(retried.now.panelLoads()).toBe(0);
    retried.now.goOnline();
    await userEvent.click(retry);
    await indicatorButton(canvas);
    // In an idle moment after the indicator arrived, before any opening.
    await waitFor(() => expect(retried.now.panelLoads()).toBe(1), INDICATOR_ARRIVES);
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

const failing = freshPerRun(failingPanel, ({ indicator }) => [
  { ...projects, indicator },
  time,
  third,
]);

export const AFailedLoadStaysInThePanelAndRetries: Story = {
  ...atViewport("wide"),
  ...failing.story,
  play: async ({ canvas }) => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    const button = await indicatorButton(canvas);
    await userEvent.click(button);
    const dialog = await panel();
    const retry = await within(dialog).findByRole("button", { name: "Try again" });
    // The rest of the Shell works on.
    await expect(button).toBeVisible();
    failing.now.recover();
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

/** An indicator entry that no module of the Shell holds, as a Command of a removed module names. */
const HELD_BY_NO_MODULE = {
  load: async () => ({ default: PanelIndicator }),
  panel: async () => ({ default: PanelContent }),
} satisfies IndicatorWithPanel;

const PROJECTS_WITH_A_STALE_NOTICE: ShellContribution = {
  ...projects,
  indicator: OPENED_FROM_ELSEWHERE,
  commands: [
    {
      id: "stale",
      kind: "open",
      label: { id: "story-Remind me", message: "Remind me" },
      load: async () => ({
        default: defineOpenCommand({
          description: "Shows a Notice whose action opens a panel no module holds.",
          schema: z.object({}),
          run: (_input, { openIndicatorPanel }) => {
            notifyChoice({
              message: "The timer still runs.",
              actions: [{ label: "Stop at …", run: () => openIndicatorPanel(HELD_BY_NO_MODULE) }],
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

/** However the panel opened, closing it puts the focus on its indicator. */
async function expectFocusBackOnTheIndicatorAfterClosing(canvas: Canvas) {
  await pressEscape();
  await panelGone();
  await waitFor(() => expect(canvas.getByRole("button", { name: "Open panel" })).toHaveFocus());
}

export const ACommandOpensThePanelWhileAnotherModuleIsActive: Story = {
  ...atViewport("wide"),
  // Time is active; the Command belongs to Projects.
  args: { contributions: [PROJECTS_WITH_COMMANDS, time, third] },
  play: async ({ canvas }) => {
    await startFromThePalette(canvas, "open the note");
    await expectFocusInPanel();
    await expectFocusBackOnTheIndicatorAfterClosing(canvas);
  },
};

export const TheActionOfANoticeOpensThePanel: Story = {
  ...atViewport("wide"),
  args: { contributions: [PROJECTS_WITH_COMMANDS, time, third] },
  play: async ({ canvas }) => {
    await startFromThePalette(canvas, "remind me");
    await userEvent.click(await screen.findByRole("button", { name: "Stop at …" }));
    await expectFocusInPanel();
    await expectFocusBackOnTheIndicatorAfterClosing(canvas);
  },
};

export const ACommandOpensTheSheetOnThePhoneAndClosingReturnsToTheIndicator: Story = {
  ...atViewport("phone"),
  args: { contributions: [PROJECTS_WITH_COMMANDS, time, third] },
  play: async ({ canvas }) => {
    await startFromThePalette(canvas, "open the note");
    await expectFocusInPanel();
    await expectFocusBackOnTheIndicatorAfterClosing(canvas);
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
    const drawer = await settled(screen.findByRole("dialog", { name: "Time" }));
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
    // The indicator lies behind the drawer's overlay, so the focus goes back into the drawer,
    // which then takes the next Escape.
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    await pressEscape();
    await closed(() => screen.queryByRole("dialog", { name: "Time" }));
  },
};

export const EscapeWithTheFocusNowhereClosesOnlyThePanelOverTheEditDrawer: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [PROJECTS_WITH_COMMANDS, time, third],
    activeModule: { ...time, editDrawer: async () => ({ default: DrawerContent }) },
    // Its own address: the story above closes the drawer of its own.
    routing: storyRouting({ edit: "entry" }),
  },
  play: async ({ canvas }) => {
    await settled(screen.findByRole("dialog", { name: "Time" }));
    await startFromThePalette(canvas, "open the note");
    await expectFocusInPanel();
    // Nowhere, as after a press on a part of the page that takes no focus.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await expect(document.activeElement).toBe(document.body);
    await pressEscape();
    await panelGone();
    // Long enough for the drawer to have slid out, had the same Escape closed it too.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(screen.getByRole("dialog", { name: "Time" })).toBeVisible();
  },
};

const TALL: IndicatorWithPanel = {
  load: async () => ({ default: PanelIndicator }),
  panel: async () => ({ default: TallContent }),
};

const PROJECTS_WITH_A_TALL_PANEL: ShellContribution = {
  ...projects,
  indicator: TALL,
  commands: [
    {
      id: "open-note",
      kind: "open",
      label: { id: "story-Open the note", message: "Open the note" },
      load: async () => ({
        default: defineOpenCommand({
          description: "Opens the panel of the module's indicator.",
          schema: z.object({}),
          run: (_input, { openIndicatorPanel }) => openIndicatorPanel(TALL),
        }),
      }),
    },
  ],
};

export const TallContentScrollsInThePanelOverTheEditDrawer: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [PROJECTS_WITH_A_TALL_PANEL, time, third],
    activeModule: { ...time, editDrawer: async () => ({ default: DrawerContent }) },
    routing: storyRouting({ edit: "entry" }),
  },
  play: async ({ canvas }) => {
    const drawer = await settled(screen.findByRole("dialog", { name: "Time" }));
    await within(drawer).findByRole("textbox", { name: "Entry name" });
    await startFromThePalette(canvas, "open the note");
    await expectFocusInPanel();
    const dialog = await panel();
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
    // The drawer locks scrolling outside itself; the wheel still scrolls the panel.
    await wheelOver(within(dialog).getByText("Line 10"), 200);
    await waitFor(() => expect(dialog.scrollTop).toBeGreaterThan(0));
  },
};

function OpenByHand() {
  const panels = useIndicatorPanels();
  const open = useOpeningOf(projects.id) !== undefined;
  return (
    <>
      <Button onClick={() => panels.toggle(projects.id)}>Toggle the panel</Button>
      <output>{open ? "Opening" : "Closed"}</output>
    </>
  );
}

function StandInFrame({ module }: IndicatorPanelFrameProps) {
  return useOpeningOf(module.id) === undefined ? null : <p>The frame is open</p>;
}

/** The frame's chunk fails `times` times, as one that could not be fetched while offline. */
function frameThatFails(times: number) {
  let loads = 0;
  return {
    load: async () => {
      loads += 1;
      if (loads <= times) throw new Error("The frame's chunk could not be loaded");
      return { default: StandInFrame };
    },
    loads: () => loads,
  };
}

const PROJECTS_WITH_A_PANEL = {
  ...projects,
  indicator: {
    load: async () => ({ default: PanelIndicator }),
    panel: async () => ({ default: PanelContent }),
  },
} satisfies ShellContribution;

const aFrameThatFailsToLoad = (times: number): Story => {
  let failingFrame = frameThatFails(times);
  return {
    // Anew for each run, with a loader of its own, which the Shell keeps what it loaded by: a
    // replay in Storybook starts as the first run did.
    loaders: [
      () => {
        failingFrame = frameThatFails(times);
      },
    ],
    // React reports the failure that the boundary caught, while the story renders.
    beforeEach: () => {
      const reported = spyOn(console, "error").mockImplementation(() => undefined);
      return () => reported.mockRestore();
    },
    render: () => (
      <IndicatorPanelsProvider modules={[PROJECTS_WITH_A_PANEL]} page="story">
        <OpenByHand />
        <IndicatorPanelFrameLoader
          indicatorShown
          load={failingFrame.load}
          module={PROJECTS_WITH_A_PANEL}
          place={null}
          sheet={false}
        />
      </IndicatorPanelsProvider>
    ),
    play: async ({ canvas }) => {
      const toggle = canvas.getByRole("button", { name: "Toggle the panel" });
      await waitFor(() => expect(failingFrame.loads()).toBe(1));
      // Each opening that fails closes again and leaves the next one to try.
      for (let opening = 2; opening <= times; opening += 1) {
        await userEvent.click(toggle);
        await waitFor(() => expect(failingFrame.loads()).toBe(opening));
        await expect(await canvas.findByText("Closed")).toBeVisible();
        await expect(canvas.queryByText("The frame is open")).toBeNull();
      }
      await userEvent.click(toggle);
      await expect(await canvas.findByText("The frame is open")).toBeVisible();
      await expect(failingFrame.loads()).toBe(times + 1);
    },
  };
};

export const AFrameThatFailedToLoadLoadsAgainAtTheNextOpening = aFrameThatFailsToLoad(1);
export const AFrameThatFailedTwiceLoadsAgainAtTheOpeningAfter = aFrameThatFailsToLoad(2);

export const APanelNoModuleHoldsIsReportedAsAFailedAction: Story = {
  ...atViewport("wide"),
  args: { contributions: [PROJECTS_WITH_A_STALE_NOTICE, time, third] },
  play: async ({ canvas }) => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    await startFromThePalette(canvas, "remind me");
    await userEvent.click(await screen.findByRole("button", { name: "Stop at …" }));
    const notice = await screen.findByText("The action could not be completed. Please try again.");
    await waitFor(() => expect(notice).toBeVisible());
    await expect(reported).toHaveBeenCalled();
    reported.mockRestore();
    await expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    await expect(canvas.getByText("Page content")).toBeVisible();
  },
};
