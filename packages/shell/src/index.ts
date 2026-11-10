export { SHELL_STANDARD_NAVBAR, type ShellNavbarState } from "./navbar-geometry.ts";
export { Shell, type ShellLogo, type ShellProps } from "./shell.tsx";
export { SHELL_STANDARD_MODULE_SIDEBAR_WIDTH } from "./use-module-sidebar-resize.ts";
export type { ShellLinkProps, ShellRouting, ViewAddress, WriteViewSearch } from "./routing.tsx";

export {
  validateContributions,
  defineContribution,
  type ShellCommand,
  type CommandContext,
  type ShellContribution,
  type ShellView,
  type EditDrawerProps,
} from "./contributions.ts";

export { useViewSearch, useWriteViewSearch } from "./routing.tsx";
export { retainedViewSearch, type ViewSearch } from "./view-search.ts";
export { ShellGroup, ShellGroupEntry } from "./groups.tsx";
export { useEditDrawerTitle } from "./edit-drawer-title.ts";
