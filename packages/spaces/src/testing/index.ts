// For tests only: fixed Space ids and Space rows. The app takes a random id at its first start.

import type { Instant } from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import type { Kysely } from "kysely";
import {
  spaceIdSchema,
  type SpaceId,
  type SpaceKind,
  type SpaceRow,
  type SpacesTables,
} from "../rows.ts";

/** A fixed, well-formed Space id, numbered from 1. */
export function testSpaceId(index: number): SpaceId {
  return spaceIdSchema.parse(`00000000-0000-7000-8000-${index.toString(16).padStart(12, "0")}`);
}

/** The Space of a test context: the id the fixed constant of the app carries today. */
export const FIRST_SPACE_ID = testSpaceId(1);
/** Another Space, whose rows a module must never see from the first. */
export const SECOND_SPACE_ID = testSpaceId(2);
export const THIRD_SPACE_ID = testSpaceId(3);

/** The Instant a test Space row carries when the test names none. */
const CREATED_AT = requireInstant("2026-01-01T00:00:00.000Z");

export interface TestSpaceRow {
  readonly id: SpaceId;
  readonly kind?: SpaceKind;
  readonly createdAt?: Instant;
  readonly deletedAt?: Instant | null;
}

/**
 * Inserts Space rows into a database that ran the migration of `spaces`, through `db` or an open
 * transaction, and returns them. A row is a Personal Space unless it names another kind.
 */
export async function createSpaceRows<DB>(
  db: Kysely<DB>,
  spaces: readonly TestSpaceRow[],
): Promise<SpaceRow[]> {
  const rows = spaces.map(
    ({ id, kind = "personal", createdAt = CREATED_AT, deletedAt = null }): SpaceRow => ({
      id,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: deletedAt,
      space_id: id,
      kind,
    }),
  );
  // The caller's tables say nothing about `spaces`; the migration of `spaces` is what this needs.
  const spacesDb = db as unknown as Kysely<SpacesTables>;
  if (rows.length > 0) await spacesDb.insertInto("spaces").values(rows).execute();
  return rows;
}
