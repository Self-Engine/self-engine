// The building block for reading and changing data through a Port (D249): the only place that
// imports the query library. Nothing at startup imports this entry.
export type {
  ConflictText,
  OperationFunction,
  OperationHandling,
  OperationHook,
  OperationResult,
  OperationState,
} from "./operation-hook.ts";
export { type PortAccess, portAccessOf } from "./port-access.ts";
export { type PortHooks, portHooks } from "./port-hooks.ts";
export { DataProvider, type DataProviderProps, usePortAccess } from "./provider.ts";
export type { QueryHook, QueryState } from "./query-hook.ts";
