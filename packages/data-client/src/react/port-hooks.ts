import type {
  ConflictReasonOf,
  EntryName,
  InputOf,
  ModuleContract,
  OutputOf,
} from "./contract-types.ts";
import {
  type OperationFunction,
  type OperationHandling,
  type OperationHook,
  operationFunction,
  operationHook,
} from "./operation-hook.ts";
import {
  type QueryFunction,
  queryFunction,
  type QueryHook,
  queryHook,
  type ReloadHook,
  reloadHook,
} from "./query-hook.ts";

/** The handling an Operation hook needs: required when the entry declares a conflict. */
type HandlingArgument<Input, Reason extends string, Tables = never> = [Reason] extends [never]
  ? [handling?: OperationHandling<Input, Reason, Tables>]
  : [handling: OperationHandling<Input, Reason, Tables>];

/**
 * The hooks of one module. `Tables` are its tables by their columns, for a form that shows a
 * Reason naming a column at its field (`columns` of the handling).
 */
export interface PortHooks<Contract extends ModuleContract, Tables = never> {
  /** The hook that reads the Query `entry`, typed from the Contract (D249). */
  query<Entry extends EntryName<Contract>>(
    entry: Entry,
  ): QueryHook<InputOf<Contract, Entry>, OutputOf<Contract, Entry>>;
  /**
   * The same Query as a function of the Port access, for code outside React such as a Command
   * (D261): one fresh read, typed from the Contract, that neither reads nor fills the page's
   * cache and rejects with the call's error.
   */
  read<Entry extends EntryName<Contract>>(
    entry: Entry,
  ): QueryFunction<InputOf<Contract, Entry>, OutputOf<Contract, Entry>>;
  /**
   * The hook that calls the Operation `entry`, typed from the Contract (D251). An entry that
   * declares conflicts needs a text and a field for each of its reasons.
   */
  operation<Entry extends EntryName<Contract>>(
    entry: Entry,
    ...handling: HandlingArgument<
      InputOf<Contract, Entry>,
      ConflictReasonOf<Contract, Entry>,
      Tables
    >
  ): OperationHook<
    InputOf<Contract, Entry>,
    OutputOf<Contract, Entry>,
    ConflictReasonOf<Contract, Entry>
  >;
  /**
   * The same Operation as a function of the Port access, for code outside React such as a
   * Command (D261): same handling, same result, same default notices. It has no field to show a
   * Reason at, so it maps no column.
   */
  run<Entry extends EntryName<Contract>>(
    entry: Entry,
    ...handling: HandlingArgument<InputOf<Contract, Entry>, ConflictReasonOf<Contract, Entry>>
  ): OperationFunction<
    InputOf<Contract, Entry>,
    OutputOf<Contract, Entry>,
    ConflictReasonOf<Contract, Entry>
  >;
  /**
   * The hook whose function reloads the Query `entry` by hand. Only for a Query whose data no
   * table holds, such as the list of Backups, which are files: no Table Change can say that it
   * changed, so the View reloads it after its own Operation. A Query over tables never needs it:
   * the Table Change of the commit reloads it (D250).
   */
  reload<Entry extends EntryName<Contract>>(entry: Entry): ReloadHook;
}

/**
 * The hooks of the module mounted as `module`, typed from its Contract, which arrives as a type
 * only (D187). A module writes one line per hook and names no tables: which tables a Query reads
 * comes from the Data Process (D248). A module whose form shows a Reason at a field gives its
 * tables as the second type, `TablesOf` of its Row Map, also as a type only.
 *
 * ```ts
 * const notesPort = portHooks<NotesContract>("notes");
 * export const useNoteList = notesPort.query("list");
 * export const useRenameNote = notesPort.operation("update", {
 *   conflicts: { title_taken: { text: msg`This title is taken.`, field: "title" } },
 * });
 * ```
 */
export function portHooks<Contract extends ModuleContract, Tables = never>(
  module: string,
): PortHooks<Contract, Tables> {
  return {
    query: (entry) => queryHook(module, entry),
    read: (entry) => queryFunction(module, entry),
    operation: (entry, handling = {}) => operationHook(module, entry, handling),
    run: (entry, handling = {}) => operationFunction(module, entry, handling),
    reload: (entry) => reloadHook(module, entry),
  };
}
