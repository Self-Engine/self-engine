// The grouping of the Query of a Day Span (D343): entries in, days with their Day Shares and the
// sums out. Pure, so the Query and the Fixed Answers of the stories group alike.
import type { ProjectReference } from "@self-engine/projects/contracts";
import { type DayRange, durationSchema, type Instant } from "@self-engine/time";
import type {
  DayEntry,
  DaysAnswer,
  TimeEntryFilter,
  TimeEntryWithProject,
} from "../contracts/index.ts";
import { dayShares } from "./day-shares.ts";

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

/**
 * The answer for `days`, consecutive whole days as `dayRangesOf` gives them. Pass every entry
 * that touches the window, sorted by start, so a filter can hide an entry without hiding its
 * overlaps. Only the Day Shares of visible entries inside the span contribute to the sums.
 */
export function groupDays(
  days: readonly DayRange[],
  entries: readonly TimeEntryWithProject[],
  filter?: TimeEntryFilter,
): DaysAnswer {
  const byDay = new Map(days.map(({ day }) => [day, { entries: [] as DayEntry[], seconds: 0 }]));
  const projects = new ProjectSums();
  let total = 0;
  let latestEnd: Instant | undefined;
  for (const [index, entry] of entries.entries()) {
    // If any later entry overlaps, the next one has the earliest start and overlaps too.
    const next = entries[index + 1];
    const overlaps =
      (latestEnd !== undefined && entry.startedAt < latestEnd) ||
      (next !== undefined && next.startedAt < entry.endedAt);
    if (latestEnd === undefined || entry.endedAt > latestEnd) latestEnd = entry.endedAt;

    if (filter?.kind === "project" && entry.projectId !== filter.projectId) continue;
    if (filter?.kind === "noProject" && entry.projectId !== null) continue;

    const { shares, crossesMidnight } = dayShares(entry, days);
    for (const share of shares) {
      const day = byDay.get(share.day);
      if (day === undefined) continue;
      // Entries come sorted by start, so each day's entries do too.
      day.entries.push({ ...entry, dayShare: share.seconds, crossesMidnight, overlaps });
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
