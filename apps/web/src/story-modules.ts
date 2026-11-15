// Shared by the app's Stories, never imported by the app.

import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { contribution as projects } from "@self-engine/projects";
import { createModuleList } from "./module-list.ts";

/**
 * The modules of the app's stories: the placeholder modules, which left the app and stay the
 * Shell's test subjects (D315), and every module the app mounts.
 */
export const storyModules = createModuleList([beta, alpha, projects]);
