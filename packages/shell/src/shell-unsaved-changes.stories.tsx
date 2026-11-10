import { Component, type ReactNode, useState } from "react";
import type { Meta } from "@storybook/react-vite";
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import {
  type EditDrawerProps,
  Shell,
  type ShellContribution,
  type ShellProps,
  useUnsavedChanges,
  useWriteViewSearch,
} from "./index.ts";
import {
  drawerOverlay,
  ENTRIES,
  nextFrame,
  shellMeta,
  type Story,
  storyRouting,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Unsaved changes",
  component: Shell,
} satisfies Meta<ShellProps>;
export default meta;

function DraftEditor({ onCancel, onDone }: EditDrawerProps) {
  const [draft, setDraft] = useState("");
  useUnsavedChanges(() => draft !== "");
  return (
    <>
      <input aria-label="Draft" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <button onClick={onCancel}>Cancel draft</button>
      <button onClick={onDone}>Save draft</button>
    </>
  );
}

const moduleWith = (editor: ShellContribution["editDrawer"]): ShellContribution => ({
  ...ENTRIES[1]!,
  ...(editor && { editDrawer: editor }),
});

const MODULE_WITH_A_DRAFT = moduleWith(async () => ({ default: DraftEditor }));

function OpenEditor() {
  const write = useWriteViewSearch();
  return (
    <button onClick={() => write((search) => ({ ...search, edit: "entry" }))}>Open editor</button>
  );
}

const QUESTION = "Discard changes?";

async function openDrawer(canvas: ReturnType<typeof within>) {
  const trigger = canvas.getByRole("button", { name: "Open editor" });
  await userEvent.click(trigger);
  const drawer = await screen.findByRole("dialog", { name: "Time" });
  const draft = await within(drawer).findByRole("textbox", { name: "Draft" });
  return { drawer: within(drawer), draft, trigger };
}

const question = () => screen.findByRole("dialog", { name: QUESTION });

const answer = async (label: "Discard" | "Keep editing") =>
  userEvent.click(within(await question()).getByRole("button", { name: label }));

const questionGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull());

const drawerGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: "Time" })).toBeNull());

type Routing = ReturnType<typeof storyRouting>;
type Opened = Awaited<ReturnType<typeof openDrawer>>;
type Canvas = ReturnType<typeof within>;

/** Each Story gets an address of its own, which the Shell and the play function share. */
function withDraft(
  play: (canvas: Canvas, routing: Routing) => Promise<void>,
  editor: ShellContribution = MODULE_WITH_A_DRAFT,
): Story {
  const routing = storyRouting();
  return {
    args: { activeModule: editor, children: <OpenEditor />, routing },
    play: ({ canvas }) => play(canvas, routing),
  };
}

const EXITS = {
  closeButton: ({ drawer }: Opened) =>
    userEvent.click(drawer.getByRole("button", { name: "Close editor" })),
  esc: () => userEvent.keyboard("{Escape}"),
  overlay: () => userEvent.click(drawerOverlay()),
  moduleCancel: ({ drawer }: Opened) =>
    userEvent.click(drawer.getByRole("button", { name: "Cancel draft" })),
};

const asksAndDiscardCloses = (exit: keyof typeof EXITS) =>
  withDraft(async (canvas, routing) => {
    const opened = await openDrawer(canvas);
    await userEvent.type(opened.draft, "x");
    await EXITS[exit](opened);
    await question();
    await expect(routing.address.search()).toEqual({ edit: "entry" });
    await answer("Discard");
    await questionGone();
    await drawerGone();
    await expect(routing.address.search()).toEqual({});
    await waitFor(() => expect(opened.trigger).toHaveFocus());
  });

export const TheCloseButtonAsksAndDiscardCloses = asksAndDiscardCloses("closeButton");
export const EscAsksAndDiscardCloses = asksAndDiscardCloses("esc");
export const TheOverlayAsksAndDiscardCloses = asksAndDiscardCloses("overlay");
export const AModulesCancelAsksAndDiscardCloses = asksAndDiscardCloses("moduleCancel");

const closesAtOnce = (exit: keyof typeof EXITS) =>
  withDraft(async (canvas, routing) => {
    const opened = await openDrawer(canvas);
    await EXITS[exit](opened);
    await drawerGone();
    await expect(routing.address.search()).toEqual({});
  });

export const TheCloseButtonClosesAtOnceWithoutChanges = closesAtOnce("closeButton");
export const EscClosesAtOnceWithoutChanges = closesAtOnce("esc");
export const TheOverlayClosesAtOnceWithoutChanges = closesAtOnce("overlay");
export const AModulesCancelClosesAtOnceWithoutChanges = closesAtOnce("moduleCancel");

const keepEditingKeepsEverything = (
  exit: keyof typeof EXITS,
  focusAfterwards: (opened: Opened) => HTMLElement,
) =>
  withDraft(async (canvas, routing) => {
    const opened = await openDrawer(canvas);
    await userEvent.type(opened.draft, "x");
    await EXITS[exit](opened);
    const asked = within(await question());
    await waitFor(() => expect(asked.getByRole("button", { name: "Keep editing" })).toHaveFocus());
    await answer("Keep editing");
    await questionGone();
    await expect(routing.address.search()).toEqual({ edit: "entry" });
    await expect(opened.draft).toHaveValue("x");
    await waitFor(() => expect(focusAfterwards(opened)).toHaveFocus());
  });

const closeButtonOf = ({ drawer }: Opened) => drawer.getByRole("button", { name: "Close editor" });

export const KeepEditingReturnsToTheCloseButton = keepEditingKeepsEverything(
  "closeButton",
  closeButtonOf,
);
export const KeepEditingReturnsToTheField = keepEditingKeepsEverything("esc", ({ draft }) => draft);
/** Clicking the overlay leaves the focus nowhere, so it goes where the drawer starts. */
export const KeepEditingAfterTheOverlayReturnsToTheDrawer = keepEditingKeepsEverything(
  "overlay",
  closeButtonOf,
);

export const OneEscClosesOnlyTheQuestion = withDraft(async (canvas, routing) => {
  const opened = await openDrawer(canvas);
  await userEvent.type(opened.draft, "x");
  await EXITS.esc();
  await question();
  await EXITS.esc();
  await questionGone();
  await expect(screen.getByRole("dialog", { name: "Time" })).toBeVisible();
  await expect(routing.address.search()).toEqual({ edit: "entry" });
  await expect(opened.draft).toHaveValue("x");
  await waitFor(() => expect(opened.draft).toHaveFocus());
  // The drawer listens again once the question is gone.
  await EXITS.esc();
  await question();
  await answer("Discard");
  await drawerGone();
});

export const ASecondAttemptDoesNotStackAnotherQuestion = withDraft(async (canvas, routing) => {
  const opened = await openDrawer(canvas);
  await userEvent.type(opened.draft, "x");
  await EXITS.closeButton(opened);
  await question();
  routing.address.writeSearch((search) => ({ ...search, edit: "another" }));
  await nextFrame();
  await expect(screen.getAllByRole("dialog", { name: QUESTION })).toHaveLength(1);
  await answer("Discard");
  await questionGone();
  await expect(routing.address.search()).toEqual({});
});

export const AFilterChangeThatKeepsTheEntryOpenDoesNotAsk = withDraft(async (canvas, routing) => {
  const opened = await openDrawer(canvas);
  await userEvent.type(opened.draft, "x");
  routing.address.writeSearch((search) => ({ ...search, client: "studio" }));
  await waitFor(() =>
    expect(routing.address.search()).toEqual({ edit: "entry", client: "studio" }),
  );
  await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
  await expect(opened.draft).toHaveValue("x");
});

export const SwappingTheEntryAsks = withDraft(async (canvas, routing) => {
  const opened = await openDrawer(canvas);
  await userEvent.type(opened.draft, "x");
  routing.address.writeSearch((search) => ({ ...search, edit: "another" }));
  await question();
  await expect(routing.address.search()).toEqual({ edit: "entry" });
  await answer("Keep editing");
  await questionGone();
  await expect(routing.address.search()).toEqual({ edit: "entry" });
  await expect(opened.draft).toHaveValue("x");
});

export const DoneClosesWithoutAskingAndTheNextEntryIsGuardedAgain = withDraft(async (canvas) => {
  const opened = await openDrawer(canvas);
  await userEvent.type(opened.draft, "x");
  await userEvent.click(opened.drawer.getByRole("button", { name: "Save draft" }));
  await drawerGone();
  await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();

  const again = await openDrawer(canvas);
  await userEvent.type(again.draft, "y");
  await EXITS.closeButton(again);
  await question();
  await answer("Discard");
  await drawerGone();
});

function EditorWhoseSaveFails({ onCancel, onDone }: EditDrawerProps) {
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  useUnsavedChanges(() => draft !== "");
  const save = async () => {
    try {
      await Promise.reject(new Error("the disk is full"));
      onDone();
    } catch {
      // Shown below, which is all this Story's module does with a failure.
      setFailed(true);
    }
  };
  return (
    <>
      <input aria-label="Draft" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <button onClick={() => void save()}>Save draft</button>
      <button onClick={onCancel}>Cancel draft</button>
      {failed && <p>Could not save</p>}
    </>
  );
}

export const AFailedSaveLeavesTheDraftOpen = withDraft(
  async (canvas, routing) => {
    const opened = await openDrawer(canvas);
    await userEvent.type(opened.draft, "x");
    await userEvent.click(opened.drawer.getByRole("button", { name: "Save draft" }));
    await opened.drawer.findByText("Could not save");
    await expect(routing.address.search()).toEqual({ edit: "entry" });
    await expect(opened.draft).toHaveValue("x");
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
  },
  moduleWith(async () => ({ default: EditorWhoseSaveFails })),
);

function CheckThatSaysYes() {
  useUnsavedChanges(() => true);
  return <p>Second check</p>;
}

function EditorWithTwoChecks({ onCancel }: EditDrawerProps) {
  const [second, setSecond] = useState(false);
  useUnsavedChanges(() => false);
  return (
    <>
      <input aria-label="Draft" />
      <button onClick={() => setSecond((shown) => !shown)}>Toggle second check</button>
      <button onClick={onCancel}>Cancel draft</button>
      {second && <CheckThatSaysYes />}
    </>
  );
}

export const AnyCheckReportingChangesAsksAndAGoneCheckNoLonger = withDraft(
  async (canvas) => {
    const opened = await openDrawer(canvas);
    await userEvent.click(opened.drawer.getByRole("button", { name: "Toggle second check" }));
    await opened.drawer.findByText("Second check");
    await EXITS.moduleCancel(opened);
    await question();
    await answer("Keep editing");
    await questionGone();
    await userEvent.click(opened.drawer.getByRole("button", { name: "Toggle second check" }));
    await waitFor(() => expect(opened.drawer.queryByText("Second check")).toBeNull());
    await EXITS.moduleCancel(opened);
    await drawerGone();
  },
  moduleWith(async () => ({ default: EditorWithTwoChecks })),
);

class CaughtMessage extends Component<
  { readonly children: ReactNode },
  { readonly message: string | undefined }
> {
  override state = { message: undefined };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  override render() {
    return this.state.message ?? this.props.children;
  }
}

function CheckOutsideADrawer() {
  useUnsavedChanges(() => false);
  return null;
}

export const OutsideAnEditDrawerTheHookThrows: Story = {
  beforeEach: () => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    return () => reported.mockRestore();
  },
  render: () => (
    <CaughtMessage>
      <CheckOutsideADrawer />
    </CaughtMessage>
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("useUnsavedChanges only works inside an edit drawer"),
    ).toBeVisible();
  },
};
