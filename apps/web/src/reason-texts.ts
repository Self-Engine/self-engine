import { type FrameReasons, frameReasonTexts, refusalTexts } from "@self-engine/data-client/react";
import type { ModuleList } from "./module-list.ts";

/**
 * Every Reason definition the app's Protection Rules answer with (D334): today the two of the
 * frame's reference check. A rule of a module or a Bridge adds its definition here, imported as a
 * type, and the app does not compile until its owner's text is in `reasonTexts`.
 */
export type AppReasons = FrameReasons;

/**
 * The text of every Reason of the app, with the table names of `modules`, for the app's
 * `DataProvider`.
 */
export function appReasonTexts(modules: ModuleList) {
  return refusalTexts<AppReasons>(frameReasonTexts, modules.tableName);
}
