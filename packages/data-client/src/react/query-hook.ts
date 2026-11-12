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

/** A Query hook: the entry's input in, the state of its answer out. */
export type QueryHook<Input, Output> = (input: Input) => QueryState<Output>;

/** The Query hook for the entry `entry` of the module mounted as `module` (`portHooks`). */
export function queryHook<Input, Output>(module: string, entry: string): QueryHook<Input, Output> {
  return function useQueryEntry(input) {
    const { access, checkQuery } = useDataContext();
    const result = useQuery({
      queryKey: [module, entry, input],
      async queryFn({ signal }) {
        const answer = await access.call(module, entry, input, signal);
        // After an answer the Data Process's list has arrived, so the entry's kind is known.
        checkQuery(module, entry);
        return answer as Output;
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
}
