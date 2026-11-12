import type {
  ConflictReasonOf,
  EntryName,
  InputOf,
  ModuleContract,
  OutputOf,
} from "./contract-types.ts";
import { type OperationHandling, type OperationHook, operationHook } from "./operation-hook.ts";
import { type QueryHook, queryHook } from "./query-hook.ts";

/** The handling an Operation hook needs: required when the entry declares a conflict. */
type HandlingArgument<Input, Reason extends string> = [Reason] extends [never]
  ? [handling?: OperationHandling<Input, Reason>]
  : [handling: OperationHandling<Input, Reason>];

export interface PortHooks<Contract extends ModuleContract> {
  /** The hook that reads the Query `entry`, typed from the Contract (D249). */
  query<Entry extends EntryName<Contract>>(
    entry: Entry,
  ): QueryHook<InputOf<Contract, Entry>, OutputOf<Contract, Entry>>;
  /**
   * The hook that calls the Operation `entry`, typed from the Contract (D251). An entry that
   * declares conflicts needs a text and a field for each of its reasons.
   */
  operation<Entry extends EntryName<Contract>>(
    entry: Entry,
    ...handling: HandlingArgument<InputOf<Contract, Entry>, ConflictReasonOf<Contract, Entry>>
  ): OperationHook<InputOf<Contract, Entry>, OutputOf<Contract, Entry>, ConflictReasonOf<Contract, Entry>>;
}

/**
 * The hooks of the module mounted as `module`, typed from its Contract, which arrives as a type
 * only (D187). A module writes one line per hook and names no tables: which tables a Query reads
 * comes from the Data Process (D248).
 *
 * ```ts
 * const notesPort = portHooks<NotesContract>("notes");
 * export const useNoteList = notesPort.query("list");
 * export const useRenameNote = notesPort.operation("update", {
 *   conflicts: { title_taken: { text: msg`This title is taken.`, field: "title" } },
 * });
 * ```
 */
export function portHooks<Contract extends ModuleContract>(module: string): PortHooks<Contract> {
  return {
    query: (entry) => queryHook(module, entry),
    operation: (entry, handling = {}) => operationHook(module, entry, handling),
  };
}
