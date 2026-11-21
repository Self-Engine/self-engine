import type { ViewSearch } from "@self-engine/shell";
import {
  addDays,
  type CalendarDay,
  calendarDaySchema,
  type DaySpan,
  type FirstDayOfWeek,
  weekOf,
} from "@self-engine/time";

/**
 * The search parameter of the week's address: the first day of the shown week. It is missing
 * while the week holds today, so that the View follows "today" over midnight and into the next
 * week; a reload and a deep link then show the week of that day's today. A week named while it is
 * the week of today, opened ahead or from a link, is taken out by the View (D367).
 */
export const WEEK_PARAMETER = "week";

/** The day the address names, or `undefined` for the week of today or for an invalid value. */
export function weekDayOf(search: ViewSearch): CalendarDay | undefined {
  const text = search[WEEK_PARAMETER];
  const parsed = calendarDaySchema.safeParse(text);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The search with the week that begins on `first`, keeping every other parameter, such as a
 * filter beside the week. The week of today drops the parameter.
 */
export function withWeek(
  search: ViewSearch,
  first: CalendarDay,
  todaysFirst: CalendarDay,
): ViewSearch {
  const { [WEEK_PARAMETER]: _previous, ...others } = search;
  return first === todaysFirst ? others : { ...others, [WEEK_PARAMETER]: first };
}

/**
 * The span the View shows: the week of the day in the address, or of today, beginning on the
 * first day of the week. A day whose week leaves the supported years shows the week of today.
 * `todaysFirst` is the first day of the week of today, for `withWeek`.
 */
export function shownWeek(
  addressDay: CalendarDay | undefined,
  today: CalendarDay,
  firstDayOfWeek: FirstDayOfWeek,
): { readonly span: DaySpan; readonly todaysFirst: CalendarDay } {
  const todays = weekOf(today, firstDayOfWeek);
  if (addressDay === undefined) return { span: todays, todaysFirst: todays.first };
  try {
    return { span: weekOf(addressDay, firstDayOfWeek), todaysFirst: todays.first };
  } catch {
    // Safe to ignore: only a week beyond the supported years throws, and a typed address can
    // name one; the View then shows the week of today.
    return { span: todays, todaysFirst: todays.first };
  }
}

/** The first day `weeks` weeks after `first`, or `undefined` beyond the supported years. */
export function weekAfter(first: CalendarDay, weeks: number): CalendarDay | undefined {
  try {
    const moved = addDays(first, weeks * 7);
    // The whole week must lie in the supported years.
    addDays(moved, 6);
    return moved;
  } catch {
    // Safe to ignore: only a week beyond the supported years throws; there is none to go to.
    return undefined;
  }
}
