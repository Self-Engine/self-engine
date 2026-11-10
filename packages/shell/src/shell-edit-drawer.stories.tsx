import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
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
  type Story,
  shellMeta,
  storyRouting,
  type VIEWPORTS,
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
  const dialog = await screen.findByRole("dialog", { name: "Time" });
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
    await waitFor(() => expect(dialog.isConnected).toBe(false));
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
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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
    const dialog = await screen.findByRole("dialog");
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
    const dialog = await screen.findByRole("dialog", { name: "Time" });
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
    const dialog = await screen.findByRole("dialog", { name: "Time" });
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
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end" }}>
        <button>Save</button>
      </div>
    ),
  }),
};

export const ContentCanPinItsButtonsToTheBottom: Story = {
  args: { activeModule: MODULE_PINNING_ITS_BUTTONS, routing: storyRouting({ edit: "entry" }) },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Time" });
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
    const dialog = await screen.findByRole("dialog", { name: "Time" });
    await within(dialog).findByTestId("tall");
    const heading = within(dialog).getByRole("heading", { name: "Time" });
    const top = heading.getBoundingClientRect().top;
    dialog.scrollTop = 400;
    await expect(dialog.scrollTop).toBe(400);
    await expect(heading.getBoundingClientRect().top).toBe(top);
  },
};
