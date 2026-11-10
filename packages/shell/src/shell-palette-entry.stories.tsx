import type { Meta } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Shell, type ShellProps } from "./index.ts";
import {
  atViewport,
  type Canvas,
  headerOf,
  navbarOf,
  onMac,
  onWindows,
  openDrawer,
  paletteDialog,
  paletteGone,
  pressEscape,
  shellMeta,
  type Story,
  widthOf,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Command Palette Entry",
  component: Shell,
  beforeEach: onWindows,
} satisfies Meta<ShellProps>;

export default meta;

const entryIn = (scope: Canvas) => scope.getByRole("button", { name: "Search" });

/** The palette's code loads at the first opening, so it can take a moment. */
const paletteOpens = () =>
  waitFor(() => expect(paletteDialog()).toBeVisible(), { timeout: 10_000 });

async function expectOpensAndGivesFocusBack(entry: HTMLElement): Promise<void> {
  await userEvent.click(entry);
  await paletteOpens();
  await pressEscape();
  await paletteGone();
  await expect(entry).toHaveFocus();
}

export const WideShowsLabelAndShortcut: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const navbar = within(navbarOf(canvas));
    const entry = entryIn(navbar);
    await expect(within(entry).getByText("Search")).toBeVisible();
    await expect(await within(entry).findByText("Ctrl+K")).toBeVisible();
    await expectOpensAndGivesFocusBack(entry);
  },
};

export const WideUsesTheNotationOfMacOS: Story = {
  ...atViewport("wide"),
  beforeEach: onMac,
  play: async ({ canvas }) => {
    const entry = entryIn(within(navbarOf(canvas)));
    await expect(await within(entry).findByText("⌘K")).toBeVisible();
  },
};

/** The longer notation still fits beside the longest label the narrowest Navbar has to hold. */
export const FitsTheNarrowestWideNavbar: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: false, expandedWidth: 10 } },
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(168);
    const entry = entryIn(within(navbar));
    const shortcut = await within(entry).findByText("Ctrl+K");
    await expect(shortcut.getBoundingClientRect().right).toBeLessThanOrEqual(
      entry.getBoundingClientRect().right,
    );
    const label = within(entry).getByText("Search");
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
  },
};

export const KeepsTheEndOfTheContentHeaderFree: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    await expect(within(headerOf(canvas)).queryByRole("button", { name: "Search" })).toBeNull();
  },
};

export const WorksFromTheKeyboard: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const navbar = within(navbarOf(canvas));
    const entry = entryIn(navbar);
    navbar.getByRole("link", { name: "Third module" }).focus();
    await userEvent.tab();
    await expect(entry).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await paletteOpens();
    await pressEscape();
    await paletteGone();
    await expect(entry).toHaveFocus();
  },
};

const expectIconWithItsName = async (entry: HTMLElement) => {
  await expect(entry.querySelector("svg")).toBeVisible();
  await expect(within(entry).queryByText("Search")).toBeNull();
  await expect(within(entry).queryByText("Ctrl+K")).toBeNull();
};

export const CollapsedNavbarShowsTheIcon: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ canvas }) => {
    const entry = entryIn(within(navbarOf(canvas)));
    await expectIconWithItsName(entry);
    await expectOpensAndGivesFocusBack(entry);
  },
};

export const MediumShowsTheIcon: Story = {
  ...atViewport("medium"),
  play: async ({ canvas }) => {
    const entry = entryIn(within(navbarOf(canvas)));
    await expectIconWithItsName(entry);
    await expectOpensAndGivesFocusBack(entry);
  },
};

export const NarrowHasItInTheDrawer: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const entry = entryIn(within(drawer));
    await expectIconWithItsName(entry);
    await expectOpensAndGivesFocusBack(entry);
    await expect(screen.getByRole("dialog", { name: "Module Sidebar" })).toBeVisible();
  },
};

export const PhoneHasItInTheBottomBar: Story = {
  ...atViewport("phone"),
  play: async () => {
    const entry = entryIn(within(screen.getByRole("contentinfo")));
    await expect(within(entry).getByText("Search")).toBeVisible();
    await expect(within(entry).queryByText("Ctrl+K")).toBeNull();
    await expectOpensAndGivesFocusBack(entry);
  },
};
