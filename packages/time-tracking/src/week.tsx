import { useLingui } from "@lingui/react/macro";
import { ActionIcon, Button, Grid, Group, Stack, Title } from "@mantine/core";
import { NextIcon, PreviousIcon } from "@self-engine/icons/view";
import { useViewSearch, useWriteViewSearch } from "@self-engine/shell";
import {
  type CalendarDay,
  type DaySpan,
  formatCalendarDay,
  type TimeZone,
} from "@self-engine/time";
import { useFirstDayOfWeek, useTimeZone, useToday } from "@self-engine/time/react";
import { QueryStateBlock } from "@self-engine/ui";
import { useCallback, useEffect, useMemo } from "react";
import { type DaysAnswer, useSpanDays } from "./port.ts";
import { shownProjectFilter, timeEntryFilter } from "./project-filter-address.ts";
import { WeekProjectFilter } from "./week-project-filter.tsx";
import { shownWeek, weekAfter, weekDayOf, withWeek } from "./week-address.ts";
import { WeekDay } from "./week-day.tsx";
import { WeekSums } from "./week-sums.tsx";

/**
 * The View "Week" (D303, D345, D354): seven days below each other with their entries and sums,
 * and beside them the sums per project and the total. The week is the one of the day in the
 * address, or of today, from the first day of the week of the Settings; the address names no week
 * while the shown one is the week of today (D367). "Today" comes from the
 * page clock and moves at midnight; nothing here reads "now". The Query reloads after a Table
 * Change of its tables, and after a change of the span.
 */
export default function Week() {
  const { i18n } = useLingui();
  const timeZone = useTimeZone();
  const today = useToday(timeZone);
  const firstDayOfWeek = useFirstDayOfWeek();
  const addressDay = useViewSearch(weekDayOf);
  const { span, todaysFirst } = shownWeek(addressDay, today, firstDayOfWeek);
  const write = useWriteViewSearch();
  // A week the address names leaves it once it is the week of today (D367): opened ahead or from
  // a link, it then follows "today" like the week "Today" goes to. The entry in the history is
  // rewritten, so that Back does not return to the named week.
  const namesTodaysWeek = addressDay !== undefined && span.first === todaysFirst;
  useEffect(() => {
    if (!namesTodaysWeek) return;
    write(
      (search) =>
        weekDayOf(search) === addressDay ? withWeek(search, todaysFirst, todaysFirst) : search,
      { replace: true },
    );
  }, [namesTodaysWeek, addressDay, todaysFirst, write]);
  return (
    <Stack gap="md">
      <WeekNavigation locale={i18n.locale} span={span} todaysFirst={todaysFirst} />
      <WeekResults locale={i18n.locale} span={span} timeZone={timeZone} today={today} />
    </Stack>
  );
}

/** Previous week, "Today" and next week, with the shown span as the heading. */
function WeekNavigation({
  span,
  todaysFirst,
  locale,
}: {
  readonly span: DaySpan;
  readonly todaysFirst: CalendarDay;
  readonly locale: string;
}) {
  const { t } = useLingui();
  const write = useWriteViewSearch();
  const goTo = (first: CalendarDay | undefined) => {
    if (first !== undefined) write((search) => withWeek(search, first, todaysFirst));
  };
  const previous = weekAfter(span.first, -1);
  const next = weekAfter(span.first, 1);
  const first = formatCalendarDay(span.first, "weekdayDate", locale);
  const last = formatCalendarDay(span.last, "weekdayDate", locale);
  return (
    <Group justify="space-between">
      <Title order={2} size="h4">
        {t`${first} – ${last}`}
      </Title>
      <Group gap="xs">
        <WeekProjectFilter />
        <ActionIcon
          aria-label={t`Previous week`}
          disabled={previous === undefined}
          onClick={() => goTo(previous)}
          variant="default"
        >
          <PreviousIcon />
        </ActionIcon>
        <Button
          disabled={span.first === todaysFirst}
          onClick={() => goTo(todaysFirst)}
          variant="default"
        >
          {t({ message: "Today", context: "Go to the week of today" })}
        </Button>
        <ActionIcon
          aria-label={t`Next week`}
          disabled={next === undefined}
          onClick={() => goTo(next)}
          variant="default"
        >
          <NextIcon />
        </ActionIcon>
      </Group>
    </Group>
  );
}

function WeekResults({
  span,
  locale,
  timeZone,
  today,
}: {
  readonly span: DaySpan;
  readonly locale: string;
  readonly timeZone: TimeZone;
  readonly today: CalendarDay;
}) {
  const filter = useViewSearch(shownProjectFilter);
  const queryFilter = useMemo(() => timeEntryFilter(filter), [filter]);
  const state = useSpanDays(span, queryFilter);
  return (
    <QueryStateBlock state={state}>
      {(answer) => (
        <WeekContent answer={answer} locale={locale} timeZone={timeZone} today={today} />
      )}
    </QueryStateBlock>
  );
}

/** The days beside the sums; on a narrow window the sums come below the days. */
function WeekContent({
  answer,
  today,
  locale,
  timeZone,
}: {
  readonly answer: DaysAnswer;
  readonly today: CalendarDay;
  readonly locale: string;
  readonly timeZone: TimeZone;
}) {
  const { t } = useLingui();
  const write = useWriteViewSearch();
  // One function for every day and row, so that a Table Change redraws only the changed day.
  const open = useCallback(
    (address: string) => write((search) => ({ ...search, edit: address })),
    [write],
  );
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack aria-label={t`Days of the week`} gap="xs">
          {answer.days.map((day) => (
            <WeekDay
              day={day}
              isToday={day.day === today}
              key={day.day}
              locale={locale}
              onOpen={open}
              timeZone={timeZone}
            />
          ))}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <WeekSums locale={locale} projects={answer.projects} total={answer.total} />
      </Grid.Col>
    </Grid>
  );
}
