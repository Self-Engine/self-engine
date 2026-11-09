import { ProjectsIcon, SettingsIcon } from "@self-engine/icons";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, type within } from "storybook/test";
import { Shell, type ShellProps } from "./index.ts";

const WIDE_VIEWPORT = { name: "Wide", styles: { width: "1280px", height: "800px" } };

const meta = {
  title: "Shell/Stored limits",
  component: Shell,
  parameters: { layout: "fullscreen", viewport: { options: { wide: WIDE_VIEWPORT } } },
  globals: { viewport: { value: "wide", isRotated: false } },
  args: {
    activeEntryId: "projects",
    children: <p>Page content</p>,
    entries: [{ id: "projects", label: "Projects", icon: ProjectsIcon, color: "blue" }],
    moduleSidebar: <p>Sidebar content</p>,
    onModuleSidebarCollapsedCommit: fn(),
    onModuleSidebarWidthCommit: fn(),
    onNavbarCommit: fn(),
    onSelectEntry: fn(),
    pageTitle: "Projects",
    settingsEntry: { id: "settings", label: "Settings", icon: SettingsIcon, color: "grape" },
  },
} satisfies Meta<ShellProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** What the user sees, and that showing a clamped width reports nothing that would overwrite it. */
async function expectShownWithoutReport(
  canvas: ReturnType<typeof within>,
  args: ShellProps,
  shown: { readonly navbar: number; readonly moduleSidebar: number },
): Promise<void> {
  const navbar = canvas.getByRole("navigation", { name: "Modules" });
  const pane = canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane");
  await expect(Math.round(navbar.getBoundingClientRect().width)).toBe(shown.navbar);
  await expect(Math.round(pane?.getBoundingClientRect().width ?? 0)).toBe(shown.moduleSidebar);
  await expect(args.onNavbarCommit).not.toHaveBeenCalled();
  await expect(args.onModuleSidebarWidthCommit).not.toHaveBeenCalled();
}

export const WidthsAboveTheLimitsShowTheMaximum: Story = {
  args: { navbar: { collapsed: false, expandedWidth: 9000 }, moduleSidebarWidth: 9000 },
  play: ({ args, canvas }) =>
    expectShownWithoutReport(canvas, args, { navbar: 280, moduleSidebar: 360 }),
};

export const WidthsBelowTheLimitsShowTheMinimum: Story = {
  args: { navbar: { collapsed: false, expandedWidth: 10 }, moduleSidebarWidth: 10 },
  play: ({ args, canvas }) =>
    expectShownWithoutReport(canvas, args, { navbar: 168, moduleSidebar: 200 }),
};
