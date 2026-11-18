import type { RowClearance } from "@self-engine/data-protocol";
import { useEffect, useRef, useState } from "react";
import { useDataContext } from "./provider.ts";

import type { ClearanceQuery } from "./clearance-query.ts";

export type ClearanceState =
  | { readonly status: "loading" }
  | { readonly status: "loadFailed" }
  | { readonly status: "content"; readonly data: readonly RowClearance[] };

/**
 * Takes one Clearance when mounted (D336, D339). An open form keeps its answer through Table
 * Changes and reconnects. Mount anew for another row or another opening of the same form.
 */
export function useClearance(input: ClearanceQuery): ClearanceState {
  const { access } = useDataContext();
  const [opening] = useState(() => ({ access, input }));
  const inFlight = useRef<Promise<readonly RowClearance[]> | undefined>(undefined);
  const [state, setState] = useState<ClearanceState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    // Strict Mode replays the effect. Both setups listen to the same call.
    inFlight.current ??= opening.access.clearance(opening.input);
    void inFlight.current.then(
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
    };
  }, [opening]);
  return state;
}
