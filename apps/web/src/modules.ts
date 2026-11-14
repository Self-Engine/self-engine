import { contribution as projects } from "@self-engine/projects";
import { createModuleList } from "./module-list.ts";

/**
 * The modules the app mounts. The first one's first View is the start address. The placeholder
 * modules are not among them: they stay the test subjects of the stories (D315).
 */
export const appModules = createModuleList([projects]);
