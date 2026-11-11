import { implementer } from "../implementer.ts";
import type { TablesChangedPublisher } from "../tables-changed.ts";

/**
 * Opens with one empty event, so the renderer knows the stream stands before any write
 * happens, then sends every announcement. It listens before the first event goes out, so no
 * announcement falls between the two.
 */
export function tablesChangedProcedure(publisher: TablesChangedPublisher) {
  return implementer.tablesChanged.handler(async function* ({ signal }) {
    const announcements = publisher.listen(signal);
    yield [];
    yield* announcements;
  });
}
