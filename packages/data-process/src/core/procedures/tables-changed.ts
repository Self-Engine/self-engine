import type { QueryTables } from "@self-engine/data-protocol";
import { implementer } from "../implementer.ts";
import type { TablesChangedPublisher } from "../tables-changed.ts";

/**
 * Opens with one `opened` event carrying the Query-to-tables list (D248), so the renderer knows
 * the stream stands before any write happens, then sends every announcement as a `changed`
 * event. It listens before the first event goes out, so no announcement falls between the two.
 */
export function tablesChangedProcedure(publisher: TablesChangedPublisher, queries: QueryTables) {
  return implementer.tablesChanged.handler(async function* ({ signal }) {
    const announcements = publisher.listen(signal);
    yield { kind: "opened", queries };
    for await (const tables of announcements) yield { kind: "changed", tables };
  });
}
