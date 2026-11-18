import { type ReasonTexts, refusalTexts } from "@self-engine/data-client/react";
import type { ModuleList } from "./module-list.ts";

/**
 * The Reasons of the Protection Rules registered from above (D331), where the desktop app starts
 * the Data Process (`apps/desktop/src/data-process.ts`): none yet. The frame's Reasons and those
 * of every module's own rules bring their texts by themselves (`refusalTexts`, the modules'
 * `dataTexts`). A rule from above is listed here by hand: the desktop app composes the Data
 * Process, and this app imports nothing of it, so the compiler cannot see that rule from here.
 */
type ReasonsFromAbove = never;

/** The texts of `ReasonsFromAbove`, each written by the package that owns the Reason. */
const TEXTS_FROM_ABOVE: ReasonTexts<ReasonsFromAbove> = {};

/**
 * The text of every Reason of the app, with the table names of `modules`, for the app's
 * `DataProvider`.
 */
export function appReasonTexts(modules: Pick<ModuleList, "reasonTexts" | "tableName">) {
  return refusalTexts([...modules.reasonTexts, TEXTS_FROM_ABOVE], modules.tableName);
}
