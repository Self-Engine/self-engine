// The grouping of the Query of a Day Span (D343): entries in, days with their Day Shares and the
// sums out. Pure, so the Query and the Fixed Answers of the stories group alike.
import type { ProjectReference } from "@self-engine/projects/contracts";
import {
  cutAtDays,
  type DayRange,
  durationSchema,
  type Instant,
  type InstantRange,
  type TimeZone,
} from "@self-engine/time";
import {
  type Break,
  countedRanges,
  type DayEntry,
  type DaysAnswer,
  type ListedTimeEntry,
  projectsOfListed,
  type RoundingRule,
  type TimeEntryFilter,
  type TimeEntryId,
  timeKindCounts,
} from "../contracts/index.ts";
import { crossesMidnight, type DayShare, divideOverItsDays } from "./day-shares.ts";

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

/**
 * What the division of an entry across midnight reads beyond the list, for that entry alone: its
 * rule and its breaks (`null` where this version cannot read them) and its own Time Zone.
 */
export interface EntryStretches {
  readonly rule: RoundingRule | null;
  readonly breaks: readonly Break[] | null;
  readonly timeZone: TimeZone;
}

/** The entries whose Rounded Time crosses midnight in `days`: only they need their stretches. */
export function entriesAcrossMidnight(
  days: readonly DayRange[],
  entries: readonly ListedTimeEntry[],
): ListedTimeEntry[] {
  return entries.filter(
    (entry) => entry.roundedTime !== null && crossesMidnight(entry.roundedTime, days),
  );
}

/**
 * The Day Shares of an entry in `days`; one without a Rounded Time has 0:00 on its start's day.
 * An entry on one day has its Booked Duration there and each project its Project Share. One
 * across midnight is divided over all its days with its stretches, and only the days in `days`
 * are kept. Without its stretches it counts its Rounded Time, on whole seconds.
 */
function sharesOf(
  entry: ListedTimeEntry,
  days: readonly DayRange[],
  timeZone: TimeZone,
  stretches: EntryStretches | undefined,
): { readonly shares: readonly DayShare[]; readonly crossesMidnight: boolean } {
  const projectShares = projectsOfListed(entry).map(({ projectShare }) => projectShare);
  const { roundedTime } = entry;
  if (roundedTime === null) {
    const day = days.find((range) => range.start <= entry.startedAt && entry.startedAt < range.end);
    const zero = durationSchema.parse(0);
    return {
      shares:
        day === undefined ? [] : [{ day: day.day, seconds: zero, projectParts: projectShares }],
      crossesMidnight: false,
    };
  }
  if (!crossesMidnight(roundedTime, days))
    return {
      shares: cutAtDays(roundedTime, days).map(({ day }) => ({
        day,
        seconds: entry.bookedDuration,
        projectParts: projectShares,
      })),
      crossesMidnight: false,
    };
  const rule = stretches?.rule ?? null;
  const counted = countedRanges(
    {
      timeKind: entry.timeKind,
      measuredTime: { start: entry.startedAt, end: entry.endedAt },
      timeZone: stretches?.timeZone ?? timeZone,
      breaks: stretches?.breaks ?? [],
      rule,
    },
    roundedTime,
  );
  const unit = rule === null || rule.kind === "exact" ? 1 : 60;
  const inSpan = new Set(days.map(({ day }) => day));
  const divided = divideOverItsDays(
    { roundedTime, bookedDuration: entry.bookedDuration, projectShares, counted, unit },
    timeZone,
  );
  return { shares: divided.filter(({ day }) => inSpan.has(day)), crossesMidnight: true };
}

/**
 * The answer for `days`, consecutive whole days as `dayRangesOf` gives them in `timeZone`, the
 * Time Zone of the call. Pass every entry that may touch the window, in any order, and the
 * stretches of those of them `entriesAcrossMidnight` names: it places them by their Rounded Times and cuts them
 * exactly, and a filter hides an entry without hiding its overlaps. Overlaps are judged on the
 * Rounded Times; an entry without one overlaps nothing. Only the Day Shares of visible entries
 * inside the span contribute to the sums. The sums per project read the Project Shares; under a
 * project filter every sum counts that project's part, and "no project" holds the entries without
 * a share. An entry that is not work has no project: a Short Break entry counts toward the day
 * and "no project", a Rest Break entry and Leisure toward no sum.
 */
export function groupDays(
  { days, timeZone }: { readonly days: readonly DayRange[]; readonly timeZone: TimeZone },
  candidates: readonly ListedTimeEntry[],
  stretches: ReadonlyMap<TimeEntryId, EntryStretches>,
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
    const shared = projectsOfListed(entry);
    const only =
      filter?.kind === "project"
        ? shared.findIndex(({ projectId }) => projectId === filter.projectId)
        : undefined;
    if (only === -1) continue;
    if (filter?.kind === "noProject" && shared.length > 0) continue;

    const { shares, crossesMidnight: across } = sharesOf(
      entry,
      days,
      timeZone,
      stretches.get(entry.id),
    );
    for (const share of shares) {
      const day = byDay.get(share.day);
      if (day === undefined) continue;
      // Entries come sorted by their place, so each day's entries do too.
      day.entries.push({
        ...entry,
        dayShare: share.seconds,
        crossesMidnight: across,
        overlaps: overlaps.has(entry.id),
      });
      const parts = share.projectParts;
      if (shared.length === 0 && timeKindCounts(entry.timeKind)) projects.add(null, share.seconds);
      for (const [index, { project }] of shared.entries())
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
