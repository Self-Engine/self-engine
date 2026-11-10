export { SHELL_STANDARD_NAVBAR, type ShellNavbarState } from "./navbar-geometry.ts";
export { Shell, type ShellLogo, type ShellProps } from "./shell.tsx";
export { SHELL_STANDARD_MODULE_SIDEBAR_WIDTH } from "./use-module-sidebar-resize.ts";
export type {
  LeaveGuard,
  ShellLinkProps,
  ShellRouting,
  ViewAddress,
  WriteViewSearch,
} from "./routing.tsx";

export {
  validateContributions,
  defineContribution,
  type ShellContribution,
  type ShellView,
  type EditDrawerProps,
} from "./contributions.ts";

export { auditCommands } from "./command-audit.ts";
export {
  commandRegister,
  defineInputCommand,
  defineOpenCommand,
  definePageCommand,
  type CommandBody,
  type CommandContext,
  type CommandKind,
  type InputCommand,
  type OpenCommand,
  type PageCommand,
  type PageCommandContext,
  type PersonCommand,
  type RegisteredCommand,
  type ShellCommand,
} from "./commands.ts";
export { runCommand, type CommandResult } from "./run-command.ts";

export { useViewSearch, useWriteViewSearch } from "./routing.tsx";
export { retainedViewSearch, type ViewSearch } from "./view-search.ts";
export { ShellGroup, ShellGroupEntry } from "./groups.tsx";
export { useEditDrawerTitle } from "./edit-drawer-title.ts";
export { useUnsavedChanges } from "./edit-drawer-exits.tsx";
