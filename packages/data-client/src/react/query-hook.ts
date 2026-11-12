import type {
  AnyContractRouter,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";
import { useQuery } from "@tanstack/react-query";
import { useDataContext } from "./provider.ts";

/**
 * What a Query hook shows (D250, D257), one variant per display, so the shared state piece in
 * `ui` maps it without asking the query library:
 * - `loading`: the first answer has not arrived.
 * - `loadFailed`: the first call failed; `retry` calls again.
 * - `content`: the answer, valid until a Table Change names one of its tables.
 * - `reloading`: a Table Change or reconnect marked the answer; it stays until the new one.
 * - `reloadFailed`: the reload failed; the previous answer stays and may be outdated.
 */
export type QueryState<Output> =
  | { readonly status: "loading" }
  | { readonly status: "loadFailed"; readonly error: unknown; readonly retry: () => void }
  | { readonly status: "content"; readonly data: Output }
  | { readonly status: "reloading"; readonly data: Output }
  | {
      readonly status: "reloadFailed";
      readonly data: Output;
      readonly error: unknown;
      readonly retry: () => void;
    };

/** A module's Contract: its entries by name, each an oRPC contract procedure. */
type ModuleContract = AnyContractRouter & Readonly<Record<string, AnyContractRouter>>;

/** The entry names of a Contract a hook may name. */
type EntryName<Contract extends ModuleContract> = keyof Contract & string;

type InputOf<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = InferContractRouterInputs<Contract[Entry]>;

type OutputOf<
  Contract extends ModuleContract,
  Entry extends EntryName<Contract>,
> = InferContractRouterOutputs<Contract[Entry]>;

/** A Query hook: the entry's input in, the state of its answer out. */
export type QueryHook<Input, Output> = (input: Input) => QueryState<Output>;

export interface PortHooks<Contract extends ModuleContract> {
  /** The hook that reads the Query `entry`, typed from the Contract (D249). */
  query<Entry extends EntryName<Contract>>(
    entry: Entry,
  ): QueryHook<InputOf<Contract, Entry>, OutputOf<Contract, Entry>>;
}

/**
 * The hooks of the module mounted as `module`, typed from its Contract, which arrives as a type
 * only (D187). A module writes one line per hook and names no tables: which tables a Query reads
 * comes from the Data Process (D248).
 *
 * ```ts
 * const notesPort = portHooks<NotesContract>("notes");
 * export const useNoteList = notesPort.query("list");
 * ```
 */
export function portHooks<Contract extends ModuleContract>(module: string): PortHooks<Contract> {
  return {
    query(entry) {
      return function useQueryEntry(input) {
        const { access, checkQuery } = useDataContext();
        const result = useQuery({
          queryKey: [module, entry, input],
          async queryFn({ signal }) {
            const answer = await access.call(module, entry, input, signal);
            // After an answer the Data Process's list has arrived, so the entry's kind is known.
            checkQuery(module, entry);
            return answer as OutputOf<Contract, typeof entry>;
          },
        });
        const retry = () => void result.refetch();
        if (result.data === undefined) {
          return result.status === "error"
            ? { status: "loadFailed", error: result.error, retry }
            : { status: "loading" };
        }
        if (result.isFetching) return { status: "reloading", data: result.data };
        if (result.status === "error") {
          return { status: "reloadFailed", data: result.data, error: result.error, retry };
        }
        return { status: "content", data: result.data };
      };
    },
  };
}
