import { useLingui } from "@lingui/react/macro";
import { Badge, Button, Group, Paper, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { CrossesMidnightIcon, OverlapsEntryIcon } from "@self-engine/icons/view";
import { formatCalendarDay, formatDuration, formatInstant, type TimeZone } from "@self-engine/time";
import { memo, type ReactElement } from "react";
import { newEntryAddress, timeEntries } from "./entry-address.ts";
import type { DayEntry, SpanDay } from "./port.ts";
import { ProjectMark } from "./project-mark.tsx";
import { NUMBERS, ROW_STYLE } from "./week-styles.ts";

interface Shown {
  readonly locale: string;
  readonly timeZone: TimeZone;
  /**
   * Opens the Edit Drawer at an address: a stored entry's id, or a new entry's. One function for
   * the whole week, the same across Table Changes, so that a changed day redraws alone.
   */
  readonly onOpen: (address: string) => void;
}

/**
 * One day of the week: its date, its sum and the entries that touch it, sorted by start. Behind
 * `memo` and given its day whole, so that a Table Change redraws only the days whose answer
 * changed, and midnight only the two days whose highlight moves.
 */
export const WeekDay = memo(function WeekDay({
  day,
  isToday,
  locale,
  timeZone,
  onOpen,
}: Shown & { readonly day: SpanDay; readonly isToday: boolean }) {
  const { t } = useLingui();
  const fullDate = formatCalendarDay(day.day, "fullDate", locale);
  return (
    <Paper
      aria-current={isToday ? "date" : undefined}
      aria-label={fullDate}
      component="section"
      p="sm"
      style={isToday ? TODAY_STYLE : undefined}
      withBorder
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Text fw={600}>{formatCalendarDay(day.day, "weekdayDate", locale)}</Text>
          {isToday && (
            <Badge size="sm" variant="light">
              {t({ message: "Today", context: "Day badge" })}
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            aria-label={t`New time entry on ${fullDate}`}
            onClick={() => onOpen(newEntryAddress(day.day))}
            size="compact-sm"
            variant="subtle"
          >
            {t({ message: "New", context: "Create a time entry on this day" })}
          </Button>
          <Text aria-label={t`Day total`} fw={600} style={NUMBERS}>
            {formatDuration(day.total, "hoursMinutes", locale)}
          </Text>
        </Group>
      </Group>
      {day.entries.length > 0 && (
        <Stack component="ul" gap={4} m={0} mt="xs" p={0}>
          {day.entries.map((entry) => (
            <DayEntryRow
              entry={entry}
              key={entry.id}
              locale={locale}
              onOpen={onOpen}
              timeZone={timeZone}
            />
          ))}
        </Stack>
      )}
    </Paper>
  );
});

/**
 * An entry on one day: start and end, its marks, project, note and Day Share. A click opens it
 * in the Edit Drawer.
 */
const DayEntryRow = memo(function DayEntryRow({
  entry,
  locale,
  timeZone,
  onOpen,
}: Shown & { readonly entry: DayEntry }) {
  const { t } = useLingui();
  const start = formatInstant(entry.startedAt, "time", locale, timeZone);
  const end = formatInstant(entry.endedAt, "time", locale, timeZone);
  return (
    <li style={ROW_STYLE}>
      <UnstyledButton
        {...timeEntries.control(entry.id)}
        onClick={() => onOpen(entry.id)}
        style={ROW_BUTTON}
      >
        <Text size="sm" style={TIMES}>
          {start} – {end}
        </Text>
        {entry.crossesMidnight && (
          <EntryHint label={t`Crosses midnight`}>
            <CrossesMidnightIcon size="sm" aria-hidden />
          </EntryHint>
        )}
        {entry.overlaps && (
          <EntryHint label={t`Overlaps another entry`}>
            <OverlapsEntryIcon size="sm" aria-hidden />
          </EntryHint>
        )}
        <ProjectMark project={entry.project} />
        <Text c="dimmed" flex={1} miw={0} size="sm" truncate>
          {entry.note}
        </Text>
        <Text size="sm" style={NUMBERS}>
          {formatDuration(entry.dayShare, "hoursMinutes", locale)}
        </Text>
      </UnstyledButton>
    </li>
  );
});

function EntryHint({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactElement;
}) {
  return (
    <Tooltip label={label}>
      <Text aria-label={label} c="dimmed" component="span" role="img" style={MARK}>
        {children}
      </Text>
    </Tooltip>
  );
}

const TODAY_STYLE = { borderColor: "var(--mantine-primary-color-filled)", borderWidth: 2 } as const;
const TIMES = { ...NUMBERS, flexShrink: 0 } as const;
const MARK = { display: "inline-flex", flexShrink: 0 } as const;
const ROW_BUTTON = {
  alignItems: "center",
  display: "flex",
  gap: "var(--mantine-spacing-sm)",
  width: "100%",
} as const;
