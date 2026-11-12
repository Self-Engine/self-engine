import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "./state-blocks.tsx";

/**
 * The state of a Query as a display needs it (D257). A plain shape, so `ui` stays free of the
 * data layer: the state a Query hook of `@self-engine/data-client/react` returns fits it as is.
 * - `loading`: the first answer has not arrived.
 * - `loadFailed`: the first call failed; `retry` calls again.
 * - `content`, `reloading`, `reloadFailed`: an answer is there and is shown.
 */
export type QueryDisplayState<Data> =
  | { readonly status: "loading" }
  | { readonly status: "loadFailed"; readonly retry: () => void }
  | { readonly status: "content" | "reloading" | "reloadFailed"; readonly data: Data };

export interface QueryStateBlockProps<Data> {
  readonly state: QueryDisplayState<Data>;
  /** Draws the answer. */
  readonly children: (data: Data) => ReactNode;
}

/**
 * Shows a Query's state the same way in every View (D257). The first load shows the loading
 * state after its delay, and a failed first load the error state with a retry. Once an answer is
 * there it stays: a reload shows no loading display, and a failed reload keeps the answer, while
 * the data client's building block tells the user once that it may be outdated.
 *
 * ```tsx
 * <QueryStateBlock state={useNoteList({})}>{(notes) => <NoteList notes={notes} />}</QueryStateBlock>
 * ```
 */
export function QueryStateBlock<Data>({ state, children }: QueryStateBlockProps<Data>): ReactNode {
  const { t } = useLingui();
  switch (state.status) {
    case "loading":
      return <LoadingState />;
    case "loadFailed":
      return <ErrorState onRetry={state.retry} title={t`This part could not be loaded.`} />;
    default:
      return children(state.data);
  }
}
