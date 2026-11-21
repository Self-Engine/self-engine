import { Button, Stack, Text, TextInput } from "@mantine/core";
import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { type IndicatorPanelProps, Shell, type ShellProps, useUnsavedChanges } from "./index.ts";
import {
  atViewport,
  type Canvas,
  ENTRIES,
  expectCovered,
  expectOnTop,
  INDICATOR_ARRIVES,
  nextFrame,
  panel,
  PanelIndicator,
  panelGone,
  pressEscape,
  type Story,
  shellMeta,
  storyRouting,
} from "./shell-story-helpers.tsx";
import { answer, asked, noQuestion } from "./story-interactions.ts";

const meta = {
  ...shellMeta,
  title: "Shell/Indicator Panel/Unsaved changes",
  component: Shell,
} satisfies Meta<ShellProps>;
export default meta;

const projects = ENTRIES[0]!;
const time = ENTRIES[1]!;
const third = ENTRIES[2]!;

/** A draft that reports unsaved changes, as a form of `forms` does. */
function DraftPanel({ onCancel, onDone }: IndicatorPanelProps) {
  const [draft, setDraft] = useState("");
  useUnsavedChanges(() => draft !== "");
  return (
    <Stack gap="xs">
      <TextInput label="Note" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <Button onClick={onCancel} variant="default">
        Cancel
      </Button>
      <Button onClick={onDone}>Done</Button>
    </Stack>
  );
}

const WITH_DRAFT = {
  contributions: [
    {
      ...projects,
      indicator: {
        load: async () => ({ default: PanelIndicator }),
        panel: async () => ({ default: DraftPanel }),
      },
    },
    time,
    third,
  ],
};

/** Still there behind the question; a busy browser may still be fading the popover in. */
const expectPanelVisible = async () => {
  const dialog = await panel();
  await waitFor(() => expect(dialog).toBeVisible());
};

/** The first module's indicator: with two panels, both indicators carry the same name. */
const firstIndicator = async (canvas: Canvas) =>
  (await canvas.findAllByRole("button", { name: "Open panel" }, INDICATOR_ARRIVES))[0]!;

async function openWithDraft(canvas: Canvas) {
  const button = await firstIndicator(canvas);
  await userEvent.click(button);
  const dialog = await panel();
  const note = await within(dialog).findByRole("textbox", { name: "Note" });
  // The popover moves the focus to the field, the phone's sheet to its first control.
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  await userEvent.type(note, "x");
  return { button, note };
}

export const EscapeAsksAndDiscardCloses: Story = {
  ...atViewport("wide"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { button } = await openWithDraft(canvas);
    await pressEscape();
    await asked();
    await expectPanelVisible();
    await answer("Discard");
    await noQuestion();
    await panelGone();
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** A click that lands on the page, outside the panel. */
const clickOutside = (canvas: Canvas) => userEvent.click(canvas.getByText("Page content"));
const clickContent = async (label: string) =>
  userEvent.click(within(await panel()).getByRole("button", { name: label }));

const EXITS = {
  escape: () => pressEscape(),
  clickOutside,
  secondClick: (_canvas: Canvas, button: HTMLElement) => userEvent.click(button),
  cancel: () => clickContent("Cancel"),
};

type Exit = keyof typeof EXITS;

const asksAndDiscardCloses = (exit: Exit): Story => ({
  ...atViewport("wide"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { button } = await openWithDraft(canvas);
    await EXITS[exit](canvas, button);
    await asked();
    await expectPanelVisible();
    await answer("Discard");
    await noQuestion();
    await panelGone();
  },
});

export const AClickOutsideAsksAndDiscardCloses = asksAndDiscardCloses("clickOutside");
export const ASecondClickOnTheIndicatorAsksAndDiscardCloses = asksAndDiscardCloses("secondClick");
export const CancelFromTheContentAsksAndDiscardCloses = asksAndDiscardCloses("cancel");

const keepEditingKeepsThePanel = (exit: Exit): Story => ({
  ...atViewport("wide"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { button, note } = await openWithDraft(canvas);
    await EXITS[exit](canvas, button);
    const buttons = within(await asked());
    await waitFor(() =>
      expect(buttons.getByRole("button", { name: "Keep editing" })).toHaveFocus(),
    );
    await answer("Keep editing");
    await noQuestion();
    await expectPanelVisible();
    await expect(note).toHaveValue("x");
    // Back in the field, however the way out took the focus away.
    await waitFor(() => expect(note).toHaveFocus());
  },
});

export const KeepEditingAfterEscapeKeepsThePanelAndItsInput = keepEditingKeepsThePanel("escape");
export const KeepEditingAfterAClickOutsideKeepsThePanelAndItsInput =
  keepEditingKeepsThePanel("clickOutside");
export const KeepEditingAfterASecondClickKeepsThePanelAndItsInput =
  keepEditingKeepsThePanel("secondClick");

export const OneEscapeClosesOnlyTheQuestion: Story = {
  ...atViewport("wide"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { note } = await openWithDraft(canvas);
    await pressEscape();
    await asked();
    await pressEscape();
    await noQuestion();
    await expectPanelVisible();
    await waitFor(() => expect(note).toHaveFocus());
    // The panel listens again once the question is gone.
    await pressEscape();
    await answer("Discard");
    await panelGone();
  },
};

const closesWithoutAsking = (exit: Exit): Story => ({
  ...atViewport("wide"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const button = await firstIndicator(canvas);
    await userEvent.click(button);
    await within(await panel()).findByRole("textbox", { name: "Note" });
    await EXITS[exit](canvas, button);
    await panelGone();
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
  },
});

export const WithoutChangesEscapeDoesNotAsk = closesWithoutAsking("escape");
export const WithoutChangesAClickOutsideDoesNotAsk = closesWithoutAsking("clickOutside");
export const WithoutChangesASecondClickDoesNotAsk = closesWithoutAsking("secondClick");
export const WithoutChangesCancelDoesNotAsk = closesWithoutAsking("cancel");

export const DoneClosesWithoutAsking: Story = {
  ...atViewport("wide"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { button } = await openWithDraft(canvas);
    await clickContent("Done");
    await panelGone();
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
    await waitFor(() => expect(button).toHaveFocus());
  },
};

const TWO_PANELS = {
  contributions: [
    WITH_DRAFT.contributions[0]!,
    time,
    {
      ...third,
      indicator: {
        load: async () => ({ default: PanelIndicator }),
        panel: async () => ({ default: DraftPanel }),
      },
    },
  ],
};

const openingAnotherPanel = (choice: "Discard" | "Keep editing"): Story => ({
  ...atViewport("wide"),
  args: TWO_PANELS,
  play: async ({ canvas }) => {
    const { note } = await openWithDraft(canvas);
    const second = canvas.getAllByRole("button", { name: "Open panel" })[1]!;
    await userEvent.click(second);
    await asked();
    await answer(choice);
    await noQuestion();
    if (choice === "Discard") {
      await screen.findByRole("dialog", { name: "Third module" });
      await panelGone();
    } else {
      await expectPanelVisible();
      await expect(note).toHaveValue("x");
      await expect(screen.queryByRole("dialog", { name: "Third module" })).toBeNull();
    }
  },
});

export const OpeningAnotherPanelAsksAndDiscardOpensIt = openingAnotherPanel("Discard");
export const OpeningAnotherPanelAsksAndKeepEditingKeepsThisOne =
  openingAnotherPanel("Keep editing");

/** Holds the page the way the app's router does: a move to another View asks the guards first. */
function NavigatingShell(args: ShellProps) {
  const [module, setModule] = useState(args.activeModule);
  const goToView = args.routing.useGoToView();
  return (
    <>
      <button
        onClick={() =>
          void goToView("/third/overview").then((moved) => {
            if (moved) setModule(third);
          })
        }
        style={{ position: "fixed", bottom: 0, left: 0, zIndex: 1000 }}
      >
        Go to another page
      </button>
      <Shell {...args} activeModule={module} activeView={module?.views[0]} />
    </>
  );
}

const changeOfPage = (choice: "Discard" | "Keep editing"): Story => ({
  ...atViewport("wide"),
  args: { ...WITH_DRAFT, routing: storyRouting() },
  render: (args) => <NavigatingShell {...args} />,
  play: async ({ canvas }) => {
    const { note } = await openWithDraft(canvas);
    // Not by a click, which would leave the panel as a click outside.
    canvas.getByRole("button", { name: "Go to another page" }).click();
    await asked();
    await answer(choice);
    await noQuestion();
    if (choice === "Discard") {
      await expect(await canvas.findByRole("heading", { name: "Overview" })).toBeVisible();
      await panelGone();
    } else {
      await expectPanelVisible();
      await expect(note).toHaveValue("x");
      await expect(canvas.queryByRole("heading", { name: "Overview" })).toBeNull();
    }
  },
});

export const AChangeOfPageAsksAndDiscardMoves = changeOfPage("Discard");
export const AChangeOfPageAsksAndKeepEditingStays = changeOfPage("Keep editing");

/**
 * A click on a link of the navigation is two ways out at once: a click outside the panel, and a
 * change of page. Both wait for the one question, and "Discard" answers both.
 */
const aClickThatChangesThePage = (choice: "Discard" | "Keep editing"): Story => ({
  ...atViewport("wide"),
  args: { ...WITH_DRAFT, routing: storyRouting() },
  render: (args) => <NavigatingShell {...args} />,
  play: async ({ canvas }) => {
    const { note } = await openWithDraft(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Go to another page" }));
    await asked();
    await answer(choice);
    await noQuestion();
    if (choice === "Discard") {
      await expect(await canvas.findByRole("heading", { name: "Overview" })).toBeVisible();
      await panelGone();
    } else {
      await expectPanelVisible();
      await expect(note).toHaveValue("x");
      await expect(canvas.queryByRole("heading", { name: "Overview" })).toBeNull();
    }
  },
});

export const AClickThatChangesThePageAsksOnceAndDiscardMoves = aClickThatChangesThePage("Discard");
export const AClickThatChangesThePageAsksOnceAndKeepEditingStays =
  aClickThatChangesThePage("Keep editing");

export const AChangeOfPageWithoutChangesDoesNotAsk: Story = {
  ...atViewport("wide"),
  args: { ...WITH_DRAFT, routing: storyRouting() },
  render: (args) => <NavigatingShell {...args} />,
  play: async ({ canvas }) => {
    const button = await canvas.findByRole("button", { name: "Open panel" }, INDICATOR_ARRIVES);
    await userEvent.click(button);
    await panel();
    canvas.getByRole("button", { name: "Go to another page" }).click();
    await expect(await canvas.findByRole("heading", { name: "Overview" })).toBeVisible();
    await panelGone();
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
  },
};

/** Lets the save of `PanelWhoseSaveWaits` end when the play function says so. */
let endWaitingSave: () => void = () => undefined;

function PanelWhoseSaveWaits({ onCancel, onDone }: IndicatorPanelProps) {
  const [draft, setDraft] = useState("");
  useUnsavedChanges(() => draft !== "");
  const save = async () => {
    await new Promise<void>((resolve) => {
      endWaitingSave = resolve;
    });
    onDone();
  };
  return (
    <Stack gap="xs">
      <TextInput label="Note" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <Button onClick={onCancel} variant="default">
        Cancel
      </Button>
      <Button onClick={() => void save()}>Save</Button>
    </Stack>
  );
}

export const ASaveThatEndsAfterItsOpeningWasLeftClosesNothing: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      {
        ...projects,
        indicator: {
          load: async () => ({ default: PanelIndicator }),
          panel: async () => ({ default: PanelWhoseSaveWaits }),
        },
      },
      time,
      third,
    ],
  },
  play: async ({ canvas }) => {
    const { button } = await openWithDraft(canvas);
    await clickContent("Save");
    await clickContent("Cancel");
    await answer("Discard");
    await panelGone();
    // The next opening, with a change of its own.
    await userEvent.click(button);
    const note = await within(await panel()).findByRole("textbox", { name: "Note" });
    await userEvent.type(note, "y");
    endWaitingSave();
    await nextFrame();
    await nextFrame();
    await expect(screen.getByRole("dialog", { name: "Projects" })).toBeInTheDocument();
    await waitFor(() => expect(note).toBeVisible());
    await expect(note).toHaveValue("y");
  },
};

/** "Archive": leaves what the panel shows and keeps it, so it asks the question alone. */
function PanelThatArchives({ confirmDiscard, onDone }: IndicatorPanelProps) {
  const [draft, setDraft] = useState("");
  const [archived, setArchived] = useState(false);
  useUnsavedChanges(() => draft !== "");
  const archive = async () => {
    if (!(await confirmDiscard())) return;
    setArchived(true);
    onDone();
  };
  return (
    <Stack gap="xs">
      <TextInput label="Note" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <Button onClick={() => void archive()}>Archive</Button>
      {archived && <Text>Archived</Text>}
    </Stack>
  );
}

export const TheContentAsksTheQuestionAlone: Story = {
  ...atViewport("wide"),
  args: {
    contributions: [
      {
        ...projects,
        indicator: {
          load: async () => ({ default: PanelIndicator }),
          panel: async () => ({ default: PanelThatArchives }),
        },
      },
      time,
      third,
    ],
  },
  play: async ({ canvas }) => {
    await openWithDraft(canvas);
    await clickContent("Archive");
    await answer("Keep editing");
    await noQuestion();
    const archive = within(await panel()).getByRole("button", { name: "Archive" });
    // Back where it was when the content asked.
    await waitFor(() => expect(archive).toHaveFocus());
    await clickContent("Archive");
    await answer("Discard");
    await panelGone();
  },
};

export const OnThePhoneTheSheetAsksToo: Story = {
  ...atViewport("phone"),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { note } = await openWithDraft(canvas);
    const close = within(await panel()).getByRole("button", { name: "Close panel" });
    await userEvent.click(close);
    await answer("Keep editing");
    await noQuestion();
    await expect(note).toHaveValue("x");
    await waitFor(() => expect(close).toHaveFocus());
    await pressEscape();
    await answer("Discard");
    await panelGone();
  },
};

/**
 * The question lies over the panel, whose field takes no click and no typing while it waits. A
 * hit test, since `userEvent.click` ignores layers.
 */
async function expectTheQuestionOnTop(note: HTMLElement) {
  const question = within(await asked());
  for (const label of ["Discard", "Keep editing"]) {
    await expectOnTop(question.getByRole("button", { name: label }));
  }
  await expectCovered(note);
  await userEvent.keyboard("y");
  await expect(note).toHaveValue("x");
}

const theQuestionLiesOverThePanel = (step: "wide" | "narrow" | "phone"): Story => ({
  ...atViewport(step),
  args: WITH_DRAFT,
  play: async ({ canvas }) => {
    const { note } = await openWithDraft(canvas);
    await pressEscape();
    await expectTheQuestionOnTop(note);
    await answer("Keep editing");
    await noQuestion();
    await waitFor(() => expect(note).toHaveFocus());
    await expectOnTop(note);
  },
});

export const TheQuestionLiesOverThePopoverAtTheWideStep = theQuestionLiesOverThePanel("wide");
export const TheQuestionLiesOverThePopoverAtTheNarrowStep = theQuestionLiesOverThePanel("narrow");
export const TheQuestionLiesOverTheSheetOnThePhone = theQuestionLiesOverThePanel("phone");

/** Keeps the Edit Drawer open, as an address with `edit` does. */
function DrawerContent() {
  return <TextInput label="Entry name" />;
}

const theQuestionOverThePanelOverTheEditDrawer = (step: "wide" | "phone"): Story => ({
  ...atViewport(step),
  args: {
    ...WITH_DRAFT,
    activeModule: { ...time, editDrawer: async () => ({ default: DrawerContent }) },
    routing: storyRouting({ edit: "entry" }),
  },
  play: async ({ canvas }) => {
    const drawer = await screen.findByRole("dialog", { name: "Time" });
    await within(drawer).findByRole("textbox", { name: "Entry name" });
    // The drawer's overlay on the phone covers the header; the panel opens from its indicator.
    const button = await firstIndicator(canvas);
    button.click();
    const dialog = await panel();
    const note = await within(dialog).findByRole("textbox", { name: "Note" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // Once the sheet has slid in.
    await waitFor(() => expectOnTop(note));
    await userEvent.type(note, "x");
    await pressEscape();
    await expectTheQuestionOnTop(note);
    await answer("Discard");
    await panelGone();
    await expect(screen.getByRole("dialog", { name: "Time" })).toBeVisible();
  },
});

export const TheQuestionLiesOverThePanelOverTheEditDrawer =
  theQuestionOverThePanelOverTheEditDrawer("wide");
export const TheQuestionLiesOverTheSheetOverTheEditDrawerOnThePhone =
  theQuestionOverThePanelOverTheEditDrawer("phone");
