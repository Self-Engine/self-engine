import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  type EditDrawerProps,
  Shell,
  type ShellContribution,
  type ShellProps,
  useWriteViewSearch,
} from "./index.ts";
import { ENTRIES, nextFrame, type Story, shellMeta, storyRouting } from "./shell-story-helpers.tsx";

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
  const dialog = await screen.findByRole("dialog", { name: "Editor" });
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
