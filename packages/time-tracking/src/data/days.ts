// The Query of a Day Span (D343, D147, D193, D352, D354). SQL fetches the window: every Live Row
// that touches the span, joined with the Read Piece of `projects`. TypeScript groups: the Day
// Shares, the days and the sums. Day logic never runs in SQL.
import type { TablesOf } from "@self-engine/db";
import type { ProjectReference } from "@self-engine/projects/contracts";
import { projectReferences } from "@self-engine/projects/data";
import {
  type ReadTransaction,
  SETTINGS_TABLE,
  sharedEntry,
  type StorageContext,
} from "@self-engine/storage";
import { dayRangesOf, type DaySpan, type DayRange, durationSchema } from "@self-engine/time";
import type { DayEntry, DaysAnswer, TimeEntryFilter } from "../contracts/index.ts";
import { dayShares } from "./day-shares.ts";
import {
  JOINED_PROJECT_COLUMNS,
  projectReferenceOf,
  type timeTrackingRowMap,
  toTimeEntry,
} from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;
type Reads = ReadTransaction<Tables>;

/** The tables the Query reads: the Time Zone is a Setting, so a change of it reloads the Query. */
export const DAYS_READS = ["time_entries", "projects", SETTINGS_TABLE] as const;

/**
 * Every Live Row that touches the window, not only those that begin in it, with its Project
 * Reference, sorted by start. The indexes on start and on end serve the two bounds.
 */
export function windowRows(
  tx: Reads,
  context: StorageContext,
  window: { readonly start: DayRange["start"]; readonly end: DayRange["end"] },
  filter: TimeEntryFilter | undefined,
) {
  let query = sharedEntry<Tables>(tx, context)
    .live("time_entries")
    .leftJoin(projectReferences(tx, context, "project"), "project.id", "time_entries.project_id")
    .selectAll("time_entries")
    .select(JOINED_PROJECT_COLUMNS)
    .where("time_entries.started_at", "<", window.end)
    .where("time_entries.ended_at", ">", window.start);
  if (filter?.kind === "project")
    query = query.where("time_entries.project_id", "=", filter.projectId);
  if (filter?.kind === "noProject") query = query.where("time_entries.project_id", "is", null);
  return query.orderBy("time_entries.started_at").orderBy("time_entries.id");
}

/** Sums in whole seconds, keyed by project id; `null` is "no project". */
class ProjectSums {
  readonly #lines = new Map<
    ProjectReference["id"] | null,
    { project: ProjectReference | null; seconds: number }
  >();

  add(project: ProjectReference | null, seconds: number) {
    const key = project?.id ?? null;
    const line = this.#lines.get(key);
    if (line === undefined) this.#lines.set(key, { project, seconds });
    else line.seconds += seconds;
  }

  /** Largest sum first, ties by id; "no project" last. */
  lines(): DaysAnswer["projects"] {
    const lines = [...this.#lines.values()];
    const withProject = lines
      .filter((line) => line.project !== null)
      .sort(
        (a, b) => b.seconds - a.seconds || ((a.project?.id ?? "") < (b.project?.id ?? "") ? -1 : 1),
      );
    const without = lines.filter((line) => line.project === null);
    return [...withProject, ...without].map((line) => ({
      project: line.project,
      total: durationSchema.parse(line.seconds),
    }));
  }
}

/** The answer of the Query for a span in the Time Zone of the call. */
export async function spanDays(
  tx: Reads,
  context: StorageContext,
  input: { readonly span: DaySpan; readonly filter?: TimeEntryFilter | undefined },
): Promise<DaysAnswer> {
  const days = dayRangesOf(input.span, await context.readTimeZone(tx));
  const first = days[0];
  const last = days.at(-1);
  // The input schema keeps the last day at or after the first.
  if (first === undefined || last === undefined) throw new Error("A Day Span has a day");
  const rows = await windowRows(
    tx,
    context,
    { start: first.start, end: last.end },
    input.filter,
  ).execute();

  const byDay = new Map(days.map(({ day }) => [day, { entries: [] as DayEntry[], seconds: 0 }]));
  const projects = new ProjectSums();
  let total = 0;
  for (const row of rows) {
    const entry = { ...toTimeEntry(row), project: projectReferenceOf(row) };
    const { shares, crossesMidnight } = dayShares(entry, days);
    for (const share of shares) {
      const day = byDay.get(share.day);
      if (day === undefined) continue;
      // Rows come sorted by start, so each day's entries do too.
      day.entries.push({ ...entry, dayShare: share.seconds, crossesMidnight });
      day.seconds += share.seconds;
      projects.add(entry.project, share.seconds);
      total += share.seconds;
    }
  }
  return {
    days: days.map(({ day }) => {
      const found = byDay.get(day);
      return {
        day,
        entries: found?.entries ?? [],
        total: durationSchema.parse(found?.seconds ?? 0),
      };
    }),
    projects: projects.lines(),
    total: durationSchema.parse(total),
  };
}
