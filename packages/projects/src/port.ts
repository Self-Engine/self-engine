import { portHooks } from "@self-engine/data-client/react";
import type { projectsContract } from "./contracts/index.ts";

export type { Project } from "./contracts/index.ts";

// The module's hooks, built from its Contract and its mount name (D249). The Contract arrives as a
// type only, so its schemas never load with a View (D255); the module names no tables (D248).
const projectsPort = portHooks<typeof projectsContract>("projects");

/** The input of the active projects: they have no filters. */
export const ACTIVE_PROJECTS = {};

/** The input of the archived projects: they have no filters either. */
export const ARCHIVED_PROJECTS = {};

export const useActiveProjects = projectsPort.query("active");
export const useArchivedProjects = projectsPort.query("archived");
export const useCreateProject = projectsPort.operation("create");
export const useEditProject = projectsPort.operation("edit");
export const useArchiveProject = projectsPort.operation("archive");
export const useUnarchiveProject = projectsPort.operation("unarchive");
export const useDeleteProject = projectsPort.operation("delete");
export const useRestoreProject = projectsPort.operation("restore");

/** `create` for the Commands, which run outside React and are given the Port access (D261). */
export const createProject = projectsPort.run("create");
