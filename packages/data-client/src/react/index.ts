// The building block for reading and changing data through a Port (D249): the only place that
// imports the query library. The app mounts its DataProvider at startup.
export { type ClearanceState, useClearance } from "./clearance-hook.ts";
export { type ClearanceQuery, clearanceQueryFor } from "./clearance-query.ts";
export { type DataTexts, dataTexts, NO_DATA_TEXTS, type TableNames } from "./data-texts.ts";
export type { Clearance, ClearanceWrite, RowClearance } from "@self-engine/data-protocol";
export {
  type ConflictText,
  type InputIssue,
  type OperationFunction,
  type OperationHandling,
  type OperationHook,
  type OperationResult,
  type ColumnFields,
  type ReasonAtField,
  type OperationState,
  type RunOptions,
} from "./operation-hook.ts";
export type { DeclaredInputReason, InputReasonOf } from "./contract-types.ts";
export { NO_DATA_PROCESS, type PortAccess, portAccessOf } from "./port-access.ts";
export { type PortHooks, portHooks } from "./port-hooks.ts";
// The Reasons' types, for the app's list of Reasons and a page that asks for one (D334).
export type { Reason, ReasonDefinition, Refusal } from "@self-engine/data-protocol";
export {
  type AnyReasonText,
  describeReasons,
  type FrameReasons,
  frameReasonTexts,
  type ReasonText,
  type ReasonTextContext,
  type ReasonTexts,
  type RefusalTexts,
  refusalTexts,
  UNDESCRIBED_REASON,
} from "./reason-texts.ts";
export {
  type RefusalAction,
  type RefusalNoticeOptions,
  type RefusedNotice,
} from "./refusal-notice.ts";
export {
  type DataAccess,
  DataProvider,
  type DataProviderProps,
  useDataAccess,
  useReasonTexts,
} from "./provider.ts";
export type { QueryHook, QueryState, ReloadHook } from "./query-hook.ts";
export { useWithUndo } from "./with-undo.ts";
