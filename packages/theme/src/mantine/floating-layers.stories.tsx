import { Button, Card, Drawer, Modal, Popover } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { formatRgb } from "culori";
import { expect, screen } from "storybook/test";
import { BUILT_IN_THEMES, DEFAULT_APPEARANCE, resolveAppearance } from "../core/index.ts";

/** Dark, because the light Neutral `canvas`, `surface` and `surfaceRaised` are one white (ADR 0012). */
const DARK_APPEARANCE = { colorMode: "dark" };

const SURFACE_RAISED = formatRgb(
  resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES).dark.roles.surfaceRaised,
);

function backgroundOf(element: Element | null): string | undefined {
  return element === null ? undefined : getComputedStyle(element).backgroundColor;
}

const noop = () => undefined;

const meta = {
  title: "Tokens/Floating Layers",
  decorators: [
    (Story) => (
      <Card h={320} withBorder>
        Content beneath the layer
        <Story />
      </Card>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// Story-level `globals` lock the toolbar, so each layer has a story that follows it, for the check
// by eye, beside the one that fixes the dark appearance for its assertion.

export const PopoverLayer: Story = {
  render: () => (
    <Popover opened>
      <Popover.Target>
        <Button>Filter</Button>
      </Popover.Target>
      <Popover.Dropdown>Only open tasks</Popover.Dropdown>
    </Popover>
  ),
};

export const PopoverLayerInDark: Story = {
  ...PopoverLayer,
  globals: DARK_APPEARANCE,
  play: async () => {
    const dropdown = await screen.findByRole("dialog");
    await expect(backgroundOf(dropdown)).toBe(SURFACE_RAISED);
  },
};

/** The header is sticky and paints its own background, so it has to match the content. */
async function expectRaisedDialog() {
  const dialog = await screen.findByRole("dialog");
  await expect(backgroundOf(dialog)).toBe(SURFACE_RAISED);
  await expect(backgroundOf(dialog.querySelector("header"))).toBe(SURFACE_RAISED);
}

export const ModalLayer: Story = {
  render: () => (
    <Modal onClose={noop} opened title="Delete the project?">
      This cannot be undone.
    </Modal>
  ),
};

export const ModalLayerInDark: Story = {
  ...ModalLayer,
  globals: DARK_APPEARANCE,
  play: expectRaisedDialog,
};

export const DrawerLayer: Story = {
  render: () => (
    <Drawer onClose={noop} opened position="right" title="Edit project">
      Project details
    </Drawer>
  ),
};

export const DrawerLayerInDark: Story = {
  ...DrawerLayer,
  globals: DARK_APPEARANCE,
  play: expectRaisedDialog,
};
