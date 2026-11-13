// The Shell's layout as the user left it. It lives in the app, because the Shell knows no Settings.
// All three are Device Settings and do not sync: the widths depend on the screen, and what is
// collapsed goes with the room that screen has. The first render reads them, so the schemas are
// `zod/mini`: the startup check refuses Zod's full build.

import { defineSetting } from "@self-engine/settings";
import { SHELL_STANDARD_MODULE_SIDEBAR_WIDTH, SHELL_STANDARD_NAVBAR } from "@self-engine/shell";
import { z } from "zod/mini";

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
