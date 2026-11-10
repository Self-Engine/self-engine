import {
  Button,
  Card,
  Drawer,
  HoverCard,
  Menu,
  Modal,
  Notification,
  Popover,
  Select,
} from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { formatRgb } from "culori";
import { expect, screen } from "storybook/test";
import { useFinalColors } from "./index.tsx";

/** Dark, because the light Neutral `canvas`, `surface` and `surfaceRaised` are one white (ADR 0012). */
const DARK_GLOBALS = { colorMode: "dark" };

/** Publishes the `surfaceRaised` of the appearance on screen, whatever the toolbar has chosen. */
function ActiveSurfaceRaised() {
  const { surfaceRaised } = useFinalColors();
  return (
    <span data-testid="active-surface-raised" hidden>
      {surfaceRaised}
    </span>
  );
}

function backgroundOf(element: Element | null): string | undefined {
  return element === null ? undefined : getComputedStyle(element).backgroundColor;
}

async function expectRaised(element: Element | null) {
  const active = screen.getByTestId("active-surface-raised").textContent;
  await expect(backgroundOf(element)).toBe(formatRgb(active));
}

const noop = () => undefined;

const meta = {
  title: "Appearance/Floating Layers",
  decorators: [
    (Story) => (
      <Card h={320} withBorder>
        Content beneath the layer
        <ActiveSurfaceRaised />
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
  globals: DARK_GLOBALS,
  play: async () => {
    await expectRaised(await screen.findByRole("dialog"));
  },
};

// Menu, Select and HoverCard read their `theme.components` styles under their own names, so each
// one proves that the override sits on the dropdown they all share.

export const MenuLayer: Story = {
  render: () => (
    <Menu opened>
      <Menu.Target>
        <Button>Actions</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item>Archive</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  ),
};

export const MenuLayerInDark: Story = {
  ...MenuLayer,
  globals: DARK_GLOBALS,
  play: async () => {
    await expectRaised(await screen.findByRole("menu"));
  },
};

export const SelectLayer: Story = {
  render: () => <Select data={["Open", "Done"]} dropdownOpened label="Status" />,
};

export const SelectLayerInDark: Story = {
  ...SelectLayer,
  globals: DARK_GLOBALS,
  play: async () => {
    const options = await screen.findByRole("listbox");
    await expectRaised(options.closest(".mantine-Select-dropdown"));
  },
};

export const HoverCardLayer: Story = {
  render: () => (
    <HoverCard initiallyOpened>
      <HoverCard.Target>
        <Button>Author</Button>
      </HoverCard.Target>
      <HoverCard.Dropdown>Written by the owner</HoverCard.Dropdown>
    </HoverCard>
  ),
};

export const HoverCardLayerInDark: Story = {
  ...HoverCardLayer,
  globals: DARK_GLOBALS,
  play: async () => {
    await expectRaised(await screen.findByText("Written by the owner"));
  },
};

/** The header is sticky and paints its own background, so it has to match the content. */
async function expectRaisedDialog() {
  const dialog = await screen.findByRole("dialog");
  await expectRaised(dialog);
  await expectRaised(dialog.querySelector("header"));
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
  globals: DARK_GLOBALS,
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
  globals: DARK_GLOBALS,
  play: expectRaisedDialog,
};

export const NotificationLayer: Story = {
  render: () => <Notification>Entry deleted</Notification>,
};

export const NotificationLayerInDark: Story = {
  ...NotificationLayer,
  globals: DARK_GLOBALS,
  play: async () => {
    await expectRaised(await screen.findByRole("alert"));
  },
};
