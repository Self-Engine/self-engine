import { contribution as projects } from "@self-engine/projects";
import { contribution as timeTracking } from "@self-engine/time-tracking";
import { createModuleList } from "./module-list.ts";
import { pageClock } from "./page-clock.ts";

/**
 * The modules the app mounts. The first one's first View is the start address. The placeholder
 * modules are not among them: they stay the test subjects of the stories (D315).
 */
export const appModules = createModuleList([projects, timeTracking], pageClock);
