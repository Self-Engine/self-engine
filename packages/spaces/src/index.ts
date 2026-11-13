// The Space below Storage (D287): its table, its id and the Personal Space of a database. No
// Contract and no entry a page can call; the Data Process runs it at its start.

export {
  spaceIdSchema,
  spaceKindSchema,
  spacesMigrations,
  spacesRowMap,
  type Space,
  type SpaceId,
  type SpaceKind,
  type SpaceRow,
  type SpacesTables,
} from "./rows.ts";
export { ensurePersonalSpace, type SpaceSources } from "./personal-space.ts";
