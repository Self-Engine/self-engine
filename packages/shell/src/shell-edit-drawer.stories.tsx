import { Button, Group, Popover, Select, Stack, TextInput } from "@mantine/core";
import { notifyUndoable } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { closed, settled } from "@self-engine/ui/story-surfaces";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import {
  type EditDrawerProps,
  Shell,
  type ShellContribution,
  type ShellProps,
  useEditDrawerTitle,
  useWriteViewSearch,
} from "./index.ts";
import {
  atViewport,
  ENTRIES,
  nextFrame,
  pressEscape,
  type Story,
  shellMeta,
  storyRouting,
  VIEWPORTS,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Edit drawer",
  component: Shell,
} satisfies Meta<ShellProps>;
export default meta;

const MODULE_WITH_DRAWER: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({
    default: ({ id }: EditDrawerProps) => <p>Editing {id}</p>,
  }),
};

function OpenEditor() {
  const write = useWriteViewSearch();
  return (
    <button onClick={() => write((search) => ({ ...search, edit: "entry" }))}>Open editor</button>
  );
}

const routing = storyRouting();

const openDialog = async (canvas: ReturnType<typeof within>) => {
  const trigger = canvas.getByRole("button", { name: "Open editor" });
  await userEvent.click(trigger);
  const dialog = await settled(screen.findByRole("dialog", { name: "Time" }));
  await within(dialog).findByText("Editing entry");
  return { dialog, trigger };
};

export const ClosingKeepsTheFrameForItsExit: Story = {
  args: { activeModule: MODULE_WITH_DRAWER, children: <OpenEditor />, routing },
  play: async ({ canvas }) => {
    const { dialog, trigger } = await openDialog(canvas);
    routing.address.writeSearch(({ edit: _edit, ...search }) => search);
    await nextFrame();
    await expect(dialog.isConnected).toBe(true);
    await expect(within(dialog).getByText("Editing entry")).toBeInTheDocument();
    await closed(() => (dialog.isConnected ? dialog : null));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

function MovingShell(args: ShellProps) {
  const [module, setModule] = useState(args.activeModule);
  return (
    <>
      <button
        onClick={() => setModule(ENTRIES[2])}
        style={{ position: "fixed", bottom: 0, right: 0, zIndex: 1000 }}
      >
        Leave module
      </button>
      <Shell {...args} activeModule={module} />
    </>
  );
}

const movingRouting = storyRouting();

export const MovingToAModuleWithoutADrawerStillPlaysTheExit: Story = {
  args: {
    activeModule: MODULE_WITH_DRAWER,
    children: <OpenEditor />,
    routing: movingRouting,
  },
  render: (args) => <MovingShell {...args} />,
  play: async ({ canvas }) => {
    const { dialog } = await openDialog(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Leave module" }));
    movingRouting.address.writeSearch(() => ({}));
    await nextFrame();
    await expect(dialog.isConnected).toBe(true);
    await closed(() => screen.queryAllByRole("dialog"));
  },
};

/** Where the open drawer came to rest, in whole pixels. */
const frameOf = (dialog: HTMLElement) => {
  const { top, right, bottom, width } = dialog.getBoundingClientRect();
  return {
    top: Math.round(top),
    rightGap: Math.round(window.innerWidth - right),
    bottomGap: Math.round(window.innerHeight - bottom),
    width: Math.round(width),
    corners: getComputedStyle(dialog).borderRadius,
  };
};

const FLOATING = { top: 8, rightGap: 8, bottomGap: 8, width: 460, corners: "16px" };

const frameAt = (viewport: keyof typeof VIEWPORTS, frame: typeof FLOATING): Story => ({
  ...atViewport(viewport),
  args: { activeModule: MODULE_WITH_DRAWER, routing: storyRouting({ edit: "entry" }) },
  play: async () => {
    const dialog = await settled(screen.findByRole("dialog"));
    await waitFor(() => expect(frameOf(dialog)).toEqual(frame));
  },
});

export const FloatsAtTheWideStep = frameAt("wide", FLOATING);
export const FloatsAtTheMediumStep = frameAt("medium", FLOATING);
export const FloatsAtTheNarrowStep = frameAt("narrow", FLOATING);
export const FloatsInTheNarrowestWindow = frameAt("narrowest", FLOATING);
export const FillsThePhone = frameAt("phone", {
  top: 0,
  rightGap: 0,
  bottomGap: 0,
  width: 390,
  corners: "0px",
});

function EntryNamedOnRequest({ id }: EditDrawerProps) {
  const [name, setName] = useState<string>();
  useEditDrawerTitle(id === "unnamed" ? undefined : name);
  return (
    <>
      <button onClick={() => setName("Invoice 12")}>Name it</button>
      <button onClick={() => setName("Invoice 13")}>Rename it</button>
    </>
  );
}

const MODULE_NAMING_ITS_ENTRY: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({ default: EntryNamedOnRequest }),
};

export const TitleIsTheModuleNameUntilTheModuleSetsOne: Story = {
  args: { activeModule: MODULE_NAMING_ITS_ENTRY, routing: storyRouting({ edit: "entry" }) },
  play: async () => {
    const dialog = await settled(screen.findByRole("dialog", { name: "Time" }));
    await expect(within(dialog).getByRole("heading", { name: "Time" })).toBeVisible();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Name it" }));
    await screen.findByRole("dialog", { name: "Invoice 12" });
    await expect(within(dialog).getByRole("heading", { name: "Invoice 12" })).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Rename it" }));
    await screen.findByRole("dialog", { name: "Invoice 13" });
    await expect(within(dialog).queryByRole("heading", { name: "Invoice 12" })).toBeNull();
  },
};

const swappingRouting = storyRouting({ edit: "entry" });

export const AnotherEntryStartsFromTheModuleNameAgain: Story = {
  args: { activeModule: MODULE_NAMING_ITS_ENTRY, routing: swappingRouting },
  play: async () => {
    const dialog = await settled(screen.findByRole("dialog", { name: "Time" }));
    await userEvent.click(await within(dialog).findByRole("button", { name: "Name it" }));
    await screen.findByRole("dialog", { name: "Invoice 12" });
    swappingRouting.address.writeSearch((search) => ({ ...search, edit: "unnamed" }));
    await screen.findByRole("dialog", { name: "Time" });
  },
};

const MODULE_PINNING_ITS_BUTTONS: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({
    default: () => (
      <div
        style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end" }}
      >
        <button>Save</button>
      </div>
    ),
  }),
};

export const ContentCanPinItsButtonsToTheBottom: Story = {
  args: { activeModule: MODULE_PINNING_ITS_BUTTONS, routing: storyRouting({ edit: "entry" }) },
  play: async () => {
    const dialog = await settled(screen.findByRole("dialog", { name: "Time" }));
    const save = await within(dialog).findByRole("button", { name: "Save" });
    // The drawer's own padding is all that stays below them.
    await waitFor(() =>
      expect(
        Math.round(dialog.getBoundingClientRect().bottom - save.getBoundingClientRect().bottom),
      ).toBe(16),
    );
  },
};

const MODULE_WITH_TALL_CONTENT: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({ default: () => <div data-testid="tall" style={{ height: 3000 }} /> }),
};

export const TallContentScrollsBelowTheTitle: Story = {
  args: { activeModule: MODULE_WITH_TALL_CONTENT, routing: storyRouting({ edit: "entry" }) },
  play: async () => {
    const dialog = await settled(screen.findByRole("dialog", { name: "Time" }));
    await within(dialog).findByTestId("tall");
    const heading = within(dialog).getByRole("heading", { name: "Time" });
    const top = heading.getBoundingClientRect().top;
    dialog.scrollTop = 400;
    await expect(dialog.scrollTop).toBe(400);
    await expect(heading.getBoundingClientRect().top).toBe(top);
  },
};

/** The shape of a module's drawer: a field on top, its actions pinned to the bottom. */
function EntryWithActions() {
  return (
    <Stack flex={1}>
      <TextInput label="Name" />
      <Group justify="flex-end" mt="auto">
        <Button me="auto" variant="subtle">
          Delete
        </Button>
        <Button variant="default">Cancel</Button>
        <Button>Save</Button>
      </Group>
    </Stack>
  );
}

const MODULE_WITH_ACTIONS: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({ default: EntryWithActions }),
};

/** A click aimed at the middle of the control reaches the control and nothing laid over it. */
const expectClickable = async (control: HTMLElement, name: string) => {
  const { left, top, width, height } = control.getBoundingClientRect();
  const hit = document.elementFromPoint(left + width / 2, top + height / 2);
  await expect(control.contains(hit), `${name} is covered`).toBe(true);
};

const noticeOf = async (message: string) =>
  (await screen.findByText(message)).closest<HTMLElement>("[role=alert]")!;

/** Until the notice has finished sliding in and lies on top where it rests. */
const noticeSettled = async (notice: HTMLElement) => {
  await settled(notice);
  await waitFor(async () => {
    const { left, top, width, height } = notice.getBoundingClientRect();
    await expect(
      notice.contains(document.elementFromPoint(left + width / 2, top + height / 2)),
    ).toBe(true);
  });
};

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const expectApart = async (field: HTMLElement[], notices: HTMLElement[]) => {
  for (const notice of notices) {
    for (const part of field) {
      await expect(
        overlaps(notice.getBoundingClientRect(), part.getBoundingClientRect()),
        "A notice lies over the field",
      ).toBe(false);
    }
  }
};

interface DrawerUnderNotices {
  readonly dialog: ReturnType<typeof within>;
  readonly latest: HTMLElement;
  readonly earlier: HTMLElement;
}

/** Every control of the drawer takes its click with two notices shown; `andThen` checks more. */
const noticesLeaveTheDrawerClickable = (
  window: Partial<Story>,
  andThen?: (shown: DrawerUnderNotices) => Promise<void>,
): Story => ({
  ...window,
  beforeEach: clearNotices,
  args: { activeModule: MODULE_WITH_ACTIONS, routing: storyRouting({ edit: "entry" }) },
  play: async () => {
    const dialog = within(await settled(screen.findByRole("dialog", { name: "Time" })));
    const save = await dialog.findByRole("button", { name: "Save" });
    const undoFirst = fn();
    const undoSecond = fn();
    notifyUndoable({ message: "First entry deleted", undo: undoFirst });
    notifyUndoable({ message: "Second entry deleted", undo: undoSecond });
    const latest = await noticeOf("Second entry deleted");
    const earlier = await noticeOf("First entry deleted");
    await noticeSettled(latest);
    await expectClickable(dialog.getByRole("heading", { name: "Time" }), "The title");
    await expectClickable(dialog.getByRole("button", { name: "Close editor" }), "Close");
    await expectClickable(dialog.getByRole("button", { name: "Delete" }), "Delete");
    await expectClickable(dialog.getByRole("button", { name: "Cancel" }), "Cancel");
    await expectClickable(save, "Save");
    await andThen?.({ dialog, latest, earlier });
    // The notices keep their own action.
    await userEvent.click(within(latest).getByRole("button", { name: "Undo" }));
    await expect(undoSecond).toHaveBeenCalledOnce();
    await noticeSettled(earlier);
    await userEvent.click(within(earlier).getByRole("button", { name: "Undo" }));
    await expect(undoFirst).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  },
});

/** Still the wide step, in a window wide enough that a centred notice ends before the drawer. */
const inAWideWindow: Partial<Story> = {
  parameters: {
    ...shellMeta.parameters,
    viewport: {
      options: {
        ...VIEWPORTS,
        roomy: { name: "Roomy", styles: { width: "1440px", height: "800px" } },
      },
    },
  },
  globals: { viewport: { value: "roomy", isRotated: false } },
};

/** The notices, fanned out too, lie beside the drawer's first field. */
export const NoticesLieBesideTheDrawerInAWideWindow = noticesLeaveTheDrawerClickable(
  inAWideWindow,
  async ({ dialog, latest, earlier }) => {
    const field = [dialog.getByRole("textbox", { name: "Name" }), dialog.getByText("Name")];
    await expectApart(field, [latest, earlier]);
    await userEvent.hover(latest);
    await waitFor(() => expect(earlier).not.toHaveAttribute("inert"));
    await noticeSettled(earlier);
    await expectApart(field, [latest, earlier]);
  },
);

/** A notice lies over the field's edge, and a click into the field still reaches it. */
export const NoticesLeaveTheDrawerClickableAtTheWideStep = noticesLeaveTheDrawerClickable(
  atViewport("wide"),
  ({ dialog }) => expectClickable(dialog.getByRole("textbox", { name: "Name" }), "The field"),
);

/** The drawer fills the width, so a notice lies over its first field. */
export const NoticesLeaveTheDrawerClickableOnThePhone = noticesLeaveTheDrawerClickable(
  atViewport("phone"),
);

/** The same place without a drawer, so a notice does not jump when one opens. */
const noticesLeaveTheHeaderClickable = (viewport: keyof typeof VIEWPORTS): Story => ({
  ...atViewport(viewport),
  beforeEach: clearNotices,
  play: async () => {
    notifyUndoable({ message: "First entry deleted", undo: fn() });
    notifyUndoable({ message: "Second entry deleted", undo: fn() });
    await noticeSettled(await noticeOf("Second entry deleted"));
    await expectClickable(screen.getByRole("heading", { level: 1, name: "Time" }), "The title");
    await expectClickable(
      screen.getByRole("button", { name: /^(Collapse module sidebar|Open module sidebar)$/ }),
      "The sidebar toggle",
    );
    clearNotices();
  },
});

export const NoticesLeaveTheHeaderClickableAtTheWideStep = noticesLeaveTheHeaderClickable("wide");
export const NoticesLeaveTheHeaderClickableOnThePhone = noticesLeaveTheHeaderClickable("phone");

/** A form with the two kinds of layer a field opens over the drawer: a popover and a list. */
function FormWithLayers() {
  return (
    <Stack>
      <Popover returnFocus trapFocus>
        <Popover.Target>
          <Button>Choose</Button>
        </Popover.Target>
        <Popover.Dropdown>
          <TextInput aria-label="Search" data-autofocus />
        </Popover.Dropdown>
      </Popover>
      <Select data={["Client", "Internal"]} label="Kind" />
    </Stack>
  );
}

const MODULE_WITH_LAYERS: ShellContribution = {
  ...ENTRIES[1]!,
  editDrawer: async () => ({ default: FormWithLayers }),
};

const layersRouting = storyRouting();

/**
 * Esc belongs to the layer it was pressed in. The drawer listens on the window, ahead of a
 * popover's own listener, so it has to leave the key to a layer that lies over it.
 */
export const EscapeInALayerOverTheDrawerClosesOnlyTheLayer: Story = {
  args: { activeModule: MODULE_WITH_LAYERS, children: <OpenEditor />, routing: layersRouting },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open editor" }));
    // A popover opened while the drawer still slides in does not take the focus.
    const drawer = await settled(screen.findByRole("dialog", { name: "Time" }));
    const choose = await within(drawer).findByRole("button", { name: "Choose" });
    const stillOpen = () => expect(layersRouting.address.search()).toEqual({ edit: "entry" });
    await expect(frameOf(drawer)).toEqual(FLOATING);

    // A popover: the focus is inside it, outside the drawer.
    await userEvent.click(choose);
    await waitFor(async () =>
      expect(await screen.findByRole("textbox", { name: "Search" })).toHaveFocus(),
    );
    await pressEscape();
    await closed(() => screen.queryByRole("textbox", { name: "Search" }));
    await stillOpen();
    await waitFor(() => expect(choose).toHaveFocus());

    // A list: the focus stays in the field, inside the drawer.
    await userEvent.click(within(drawer).getByRole("combobox", { name: "Kind" }));
    await screen.findByRole("option", { name: "Client" });
    await pressEscape();
    await closed(() => screen.queryByRole("option", { name: "Client" }));
    await stillOpen();

    // No layer is open any more: now the key is the drawer's.
    await pressEscape();
    await waitFor(() => expect(layersRouting.address.search()).toEqual({}));
    await closed(() => screen.queryByRole("dialog", { name: "Time" }));
  },
};

/** How often the drawer's content of each entry was mounted: once per opening. */
const mounts: string[] = [];

function CountingEditor({ id }: EditDrawerProps) {
  const [mounted] = useState(() => {
    mounts.push(id);
    return mounts.length;
  });
  return <p>Opening {mounted}</p>;
}

/** A routing of its own for each run of the story, so that a replay starts with the drawer closed. */
interface Reopening {
  readonly routing: ReturnType<typeof storyRouting>;
}

export const ReopeningDuringTheExitIsANewOpening: Story = {
  args: {
    activeModule: { ...ENTRIES[1]!, editDrawer: async () => ({ default: CountingEditor }) },
    children: <OpenEditor />,
  },
  loaders: [
    (): Reopening => {
      mounts.length = 0;
      return { routing: storyRouting() };
    },
  ],
  render: (args, { loaded }) => <Shell {...args} routing={(loaded as Reopening).routing} />,
  play: async ({ canvas, loaded }) => {
    const { routing: reopenRouting } = loaded as Reopening;
    await userEvent.click(canvas.getByRole("button", { name: "Open editor" }));
    const dialog = await settled(screen.findByRole("dialog", { name: "Time" }));
    await within(dialog).findByText("Opening 1");
    reopenRouting.address.writeSearch(({ edit: _edit, ...search }) => search);
    await nextFrame();
    await expect(dialog.isConnected).toBe(true);

    // Back to the same entry before the frame has left: what the content read on its opening,
    // such as a Clearance, is read anew.
    reopenRouting.address.writeSearch((search) => ({ ...search, edit: "entry" }));
    await waitFor(() => expect(within(dialog).getByText("Opening 2")).toBeInTheDocument());
    await expect(mounts).toEqual(["entry", "entry"]);
  },
};
