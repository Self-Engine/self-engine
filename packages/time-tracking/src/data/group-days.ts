// The grouping of the Query of a Day Span (D343): entries in, days with their Day Shares and the
// sums out. Pure, so the Query and the Fixed Answers of the stories group alike.
import type { ProjectReference } from "@self-engine/projects/contracts";
import { type DayRange, durationSchema } from "@self-engine/time";
import type { DayEntry, DaysAnswer, TimeEntryWithProject } from "../contracts/index.ts";
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
 * The answer for `days`, consecutive whole days as `dayRangesOf` gives them, from `entries`
 * sorted by start: each day with the entries that touch it and its sum, the sums per project and
 * the total, all in whole seconds. Parts of an entry outside the days count nowhere.
 */
export function groupDays(
  days: readonly DayRange[],
  entries: Iterable<TimeEntryWithProject>,
): DaysAnswer {
  const byDay = new Map(days.map(({ day }) => [day, { entries: [] as DayEntry[], seconds: 0 }]));
  const projects = new ProjectSums();
  let total = 0;
  for (const entry of entries) {
    const { shares, crossesMidnight } = dayShares(entry, days);
    for (const share of shares) {
      const day = byDay.get(share.day);
      if (day === undefined) continue;
      // Entries come sorted by start, so each day's entries do too.
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
