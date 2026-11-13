import type { QueryTables, TablesChanged } from "@self-engine/data-protocol";
import { NO_DATA_PROCESS, type PortAccess } from "../react/port-access.ts";

export interface ChangingAnswers {
  /** The Port access to give `DataProvider`. */
  readonly access: PortAccess;
  /**
   * Answers from `next` from now on and delivers a Table Change naming `tables`, as the Data
   * Process does after a commit.
   */
  change(next: PortAccess, tables: TablesChanged): void;
}

/**
 * The Port access of a story that shows what one change redraws (D256): calls answer from
 * `first`, usually Fixed Answers, until the story changes them, and each entry is described from
 * `queries`, the Query-to-tables list the Data Process would send (D248).
 */
export function changingAnswers(first: PortAccess, queries: QueryTables): ChangingAnswers {
  let answers = first;
  const listeners = new Set<(tables: TablesChanged) => void>();
  return {
    access: {
      ...NO_DATA_PROCESS,
      call: (module, entry, input, signal) => answers.call(module, entry, input, signal),
      describeEntry(module, entry) {
        const reads = queries[module]?.[entry];
        return reads === undefined ? { kind: "operation" } : { kind: "query", reads };
      },
      onTablesChanged(listener) {
        const entry = (tables: TablesChanged) => listener(tables);
        listeners.add(entry);
        return () => listeners.delete(entry);
      },
    },
    change(next, tables) {
      answers = next;
      for (const listener of listeners) listener(tables);
    },
  };
}
