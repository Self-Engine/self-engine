// The Shell's layout as the user left it. It lives in the app, because the Shell knows no Settings.
// All three are Device Settings: a width depends on the screen, so it does not sync.

import { defineSetting } from "@self-engine/settings";
import { SHELL_STANDARD_MODULE_SIDEBAR_WIDTH, SHELL_STANDARD_NAVBAR } from "@self-engine/shell";
import { z } from "zod";

/**
 * Widths are Mantine's unscaled numbers, so they follow the font scale. Any number is valid here:
 * the limits can change with the font scale and the platform, so the Shell clamps when it shows one.
 */
export const SHELL_SETTINGS = {
  navbar: defineSetting({
    key: "shell.navbar",
    scope: "device",
    default: SHELL_STANDARD_NAVBAR,
    schema: z.object({ collapsed: z.boolean(), expandedWidth: z.number() }),
  }),
  moduleSidebarWidth: defineSetting({
    key: "shell.moduleSidebarWidth",
    scope: "device",
    default: SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
    schema: z.number(),
  }),
  moduleSidebarCollapsed: defineSetting({
    key: "shell.moduleSidebarCollapsed",
    scope: "device",
    default: false,
    schema: z.boolean(),
  }),
};
