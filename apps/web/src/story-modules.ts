// Shared by the app's Stories, never imported by the app.

import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { contribution as projects } from "@self-engine/projects";
import { contribution as timeTracking } from "@self-engine/time-tracking";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import { createModuleList } from "./module-list.ts";

/** The page's Clock in the app's stories: fixed, so a story renders the same on every day. */
export const STORY_CLOCK = fixedClock(requireInstant("2026-11-20T10:00:00.000Z"));

/**
 * The modules of the app's stories: the placeholder modules, which left the app and stay the
 * Shell's test subjects (D315), and every module the app mounts.
 */
export const storyModules = createModuleList([beta, alpha, projects, timeTracking], STORY_CLOCK);
