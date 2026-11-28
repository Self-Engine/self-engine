// The grouping of the Query of a Day Span (D343): entries in, days with their Day Shares and the
// sums out. Pure, so the Query and the Fixed Answers of the stories group alike.
import type { ProjectReference } from "@self-engine/projects/contracts";
import { type DayRange, durationSchema, type Instant, type InstantRange } from "@self-engine/time";
import type { DayEntry, DaysAnswer, ListedTimeEntry, TimeEntryFilter } from "../contracts/index.ts";
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
 * Where an entry stands in a list: its Rounded Time, or, without one, the moment of its measured
 * start, where it stands with 0:00.
 */
function placeOf(entry: ListedTimeEntry): InstantRange {
  return entry.roundedTime ?? { start: entry.startedAt, end: entry.startedAt };
}

/** The Day Shares of an entry in `days`; one without a Rounded Time has 0:00 on its start's day. */
function sharesOf(entry: ListedTimeEntry, days: readonly DayRange[]) {
  if (entry.roundedTime !== null) return dayShares(entry.roundedTime, days);
  const day = days.find((range) => range.start <= entry.startedAt && entry.startedAt < range.end);
  return {
    shares: day === undefined ? [] : [{ day: day.day, seconds: durationSchema.parse(0) }],
    crossesMidnight: false,
  };
}

/**
 * The part of each project in one Day Share of an entry, in the order of its projects. An entry
 * that lies in one day gives each project its Project Share. Across midnight each further
 * project gets its part of the Day Share by its share, cut down to the whole second, and the Lead
 * Project the rest, so the parts add up to the Day Share and none is below zero.
 */
function projectPartsOf(entry: ListedTimeEntry, dayShare: number): number[] {
  const { projectShares, bookedDuration } = entry;
  if (dayShare === bookedDuration) return projectShares.map(({ projectShare }) => projectShare);
  const further = projectShares
    .slice(1)
    .map(({ projectShare }) => Math.floor((dayShare * projectShare) / bookedDuration));
  return [Math.max(0, dayShare - further.reduce((sum, part) => sum + part, 0)), ...further];
}

/**
 * The answer for `days`, consecutive whole days as `dayRangesOf` gives them. Pass every entry
 * that may touch the window, in any order: it places them by their Rounded Times and cuts them
 * exactly, and a filter hides an entry without hiding its overlaps. Overlaps are judged on the
 * Rounded Times; an entry without one overlaps nothing. Only the Day Shares of visible entries
 * inside the span contribute to the sums. The sums per project read the Project Shares; under a
 * project filter every sum counts that project's part, and "no project" holds the entries without
 * a share.
 */
export function groupDays(
  days: readonly DayRange[],
  candidates: readonly ListedTimeEntry[],
  filter?: TimeEntryFilter,
): DaysAnswer {
  const entries = candidates.toSorted(
    (a, b) => placeOf(a).start.localeCompare(placeOf(b).start) || a.id.localeCompare(b.id),
  );
  const counting = entries.filter((entry) => entry.roundedTime !== null);
  const overlapping = overlapsOf(counting.map((entry) => entry.roundedTime as InstantRange));
  const overlaps = new Set(counting.filter((_, index) => overlapping[index]).map(({ id }) => id));

  const byDay = new Map(days.map(({ day }) => [day, { entries: [] as DayEntry[], seconds: 0 }]));
  const projects = new ProjectSums();
  let total = 0;
  for (const entry of entries) {
    const only =
      filter?.kind === "project"
        ? entry.projectShares.findIndex(({ projectId }) => projectId === filter.projectId)
        : undefined;
    if (only === -1) continue;
    if (filter?.kind === "noProject" && entry.projectShares.length > 0) continue;

    const { shares, crossesMidnight } = sharesOf(entry, days);
    for (const share of shares) {
      const day = byDay.get(share.day);
      if (day === undefined) continue;
      // Entries come sorted by their place, so each day's entries do too.
      day.entries.push({
        ...entry,
        dayShare: share.seconds,
        crossesMidnight,
        overlaps: overlaps.has(entry.id),
      });
      const parts = projectPartsOf(entry, share.seconds);
      if (entry.projectShares.length === 0) projects.add(null, share.seconds);
      for (const [index, { project }] of entry.projectShares.entries())
        if (only === undefined || only === index) projects.add(project, parts[index] ?? 0);
      const counted = only === undefined ? share.seconds : (parts[only] ?? 0);
      day.seconds += counted;
      total += counted;
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

/** Whether each range, sorted by start, overlaps another one; touching is no overlap. */
function overlapsOf(ranges: readonly InstantRange[]): boolean[] {
  let latestEnd: Instant | undefined;
  return ranges.map((range, index) => {
    // If any later range overlaps, the next one has the earliest start and overlaps too.
    const next = ranges[index + 1];
    const overlaps =
      (latestEnd !== undefined && range.start < latestEnd) ||
      (next !== undefined && next.start < range.end);
    if (latestEnd === undefined || range.end > latestEnd) latestEnd = range.end;
    return overlaps;
  });
}
