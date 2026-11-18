import type { RowClearance } from "@self-engine/data-protocol";
import { useEffect, useRef, useState } from "react";
import { useDataContext } from "./provider.ts";

import type { ClearanceQuery } from "./clearance-query.ts";

export type ClearanceState =
  | { readonly status: "loading" }
  | { readonly status: "loadFailed" }
  | { readonly status: "content"; readonly data: readonly RowClearance[] };

/** The one call of an opening, with what calls it off and how many setups listen to it. */
interface OpeningCall {
  readonly answer: Promise<readonly RowClearance[]>;
  readonly stop: AbortController;
  listeners: number;
}

/**
 * Takes one Clearance when mounted (D336, D339). An open form keeps its answer through Table
 * Changes and reconnects. Mount anew for another row or another opening of the same form. An
 * opening that closes before the answer calls its Clearance off, so none waits for a Port, while
 * the Data Process reconnects, that no form will read.
 */
export function useClearance(input: ClearanceQuery): ClearanceState {
  const { access } = useDataContext();
  const [opening] = useState(() => ({ access, input }));
  const call = useRef<OpeningCall | undefined>(undefined);
  const [state, setState] = useState<ClearanceState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    // Strict Mode replays the effect. Both setups listen to the same call.
    if (call.current === undefined || call.current.stop.signal.aborted) {
      const stop = new AbortController();
      call.current = {
        answer: opening.access.clearance(opening.input, stop.signal),
        stop,
        listeners: 0,
      };
    }
    const current = call.current;
    current.listeners += 1;
    void current.answer.then(
      (data) => {
        if (active) setState({ status: "content", data });
      },
      () => {
        // The caller can render loadFailed; the Operation still enforces the same rules.
        if (active) setState({ status: "loadFailed" });
      },
    );
    return () => {
      active = false;
      current.listeners -= 1;
      // Strict Mode's replay sets the effect up again before this runs; a closed opening does not.
      queueMicrotask(() => {
        if (current.listeners === 0) current.stop.abort();
      });
    };
  }, [opening]);
  return state;
}
