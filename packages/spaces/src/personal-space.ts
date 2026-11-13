import { newId, type Database, type IdSources } from "@self-engine/db";
import type { Clock } from "@self-engine/time";
import { toSpace, type Space, type SpaceId, type SpaceRow, type SpacesTables } from "./rows.ts";

/** Where a new Space takes its id and its Instant from: the same shape as a Storage context's. */
export interface SpaceSources {
  readonly clock: Clock;
  readonly ids: IdSources;
}

/**
 * Another connection wrote after this transaction read: a second Data Process created the
 * Personal Space first (D288).
 */
function lostTheRace(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_BUSY_SNAPSHOT"
  );
}

/**
 * Makes sure the migrated database holds its Personal Space and returns it. The first call
 * creates it with an id from `sources.ids` and the Instant of `sources.clock`; every later call
 * finds it. Two Personal Spaces, or a deleted one, make the call throw: nothing is picked (D288).
 *
 * The read and the insert share one transaction. When it fails with `SQLITE_BUSY_SNAPSHOT`
 * because another connection inserted first, it runs once more and finds that Space.
 */
export async function ensurePersonalSpace(
  database: Database,
  sources: SpaceSources,
): Promise<Space> {
  const now = sources.clock();
  // The id and the timestamps share one Instant, as in a Storage context.
  const ids: IdSources = { clock: () => now, random: sources.ids.random };
  const kysely = database.kysely.withTables<SpacesTables>();
  const attempt = () =>
    kysely.transaction().execute(async (tx) => {
      const found = await tx
        .selectFrom("spaces")
        .selectAll()
        .where("kind", "=", "personal")
        .execute();
      if (found.length > 1) {
        throw new Error(`The database holds ${found.length} Personal Spaces; it must hold one`);
      }
      const [existing] = found;
      if (existing !== undefined) {
        if (existing.deleted_at !== null) {
          throw new Error(`The Personal Space ${existing.id} is deleted`);
        }
        return toSpace(existing);
      }
      const id = newId<SpaceId>(ids);
      const row: SpaceRow = {
        id,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        space_id: id,
        kind: "personal",
      };
      await tx.insertInto("spaces").values(row).execute();
      return toSpace(row);
    });
  try {
    return await attempt();
  } catch (error) {
    if (!lostTheRace(error)) throw error;
    return attempt();
  }
}
