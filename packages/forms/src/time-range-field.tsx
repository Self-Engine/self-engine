// The field "date, start, end" (D319, D344, D347): one field bound to two Instants of the draft.
// It shows a date, a start time and an end time, and on demand an end date, with the inputs of
// `date-inputs.tsx`. `time-range.ts` turns what it shows into the two Instants; this file draws.

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Badge, Button, CloseButton, Fieldset, Group, Text } from "@mantine/core";
import {
  type CalendarDay,
  durationBetween,
  epochMsOf,
  type FirstDayOfWeek,
  formatDuration,
  formatInstant,
  type Instant,
  instantSchema,
  repeatedTimeOffset,
  type TimeZone,
  type WallClockTime,
} from "@self-engine/time";
import { type ReactNode, useRef, useState } from "react";
import { checkedOrNull } from "./checked-value.ts";
import { DayInput, TimeInput } from "./date-inputs.tsx";
import { type FieldBinding, typedMemo, useFieldBinding } from "./field-binding.ts";
import { bindingOf, type OperationForm } from "./operation-form.ts";
import type { FieldTaking } from "./picker-fields.tsx";
import {
  dayOfEnd,
  isNextDay,
  partsOf,
  type RangeOutcome,
  type RangeParts,
  rangeFrom,
} from "./time-range.ts";

/** Shown at a start or end time the clocks skip on that day (D347). */
const SKIPPED = msg`This time does not exist on this day: the clocks skip it. Choose another.`;

export interface TimeRangeFieldProps<FormDraft> {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Instant the range starts at. */
  readonly start: FieldTaking<FormDraft, Instant | null>;
  /** The field of the draft that holds the Instant the range ends at. */
  readonly end: FieldTaking<FormDraft, Instant | null>;
  /** The zone the date and the times are read in; the caller reads it from the Setting. */
  readonly timeZone: TimeZone;
  /** The column the calendars start their weeks with; the caller reads it from the Setting. */
  readonly firstDayOfWeek: FirstDayOfWeek;
  /** The day the calendars mark as today and open on while empty: `useToday(timeZone)`. */
  readonly today: CalendarDay;
  /** The name of the whole field, such as "Worked". */
  readonly label?: ReactNode;
  readonly disabled?: boolean;
}

/** The parts of the field that hold text which is no value yet. */
type Part = "day" | "startTime" | "endTime" | "endDay";

interface View {
  readonly parts: RangeParts;
  /** Parts holding unfinished text; their older value stays in `parts`. */
  readonly unfinished: ReadonlySet<Part>;
  /** The side whose time the clocks skip. */
  readonly skipped: { readonly start: boolean; readonly end: boolean };
}

const fresh = (parts: RangeParts): View => ({
  parts,
  unfinished: new Set(),
  skipped: { start: false, end: false },
});

function sameView(a: View, b: View): boolean {
  const keys = Object.keys(a.parts) as (keyof RangeParts)[];
  return (
    keys.every((key) => a.parts[key] === b.parts[key]) &&
    a.unfinished.size === b.unfinished.size &&
    [...a.unfinished].every((part) => b.unfinished.has(part)) &&
    a.skipped.start === b.skipped.start &&
    a.skipped.end === b.skipped.end
  );
}

/** Whether each side holds no value its field can take: text that is no value, or a skipped time. */
function heldOf({ unfinished, skipped }: View) {
  return {
    start: skipped.start || unfinished.has("day") || unfinished.has("startTime"),
    end: skipped.end || unfinished.has("endTime") || unfinished.has("endDay"),
  };
}

/**
 * Hands one side's outcome to its field of the draft: text that is no value, a skipped time, a
 * new Instant, or nothing, in which case an older message of this field is taken back.
 */
function tell(
  field: FieldBinding<unknown>,
  current: Instant | null,
  outcome: RangeOutcome,
  unfinished: boolean,
  wasHeld: boolean,
): void {
  if (unfinished) field.onUnfinished();
  else if (outcome.case === "skipped") field.onUnfinished(SKIPPED);
  else if (outcome.case === "set" && outcome.instant !== current) field.onChange(outcome.instant);
  // The Instant stays: handing it on again drops the text the field held that was no value.
  else if (wasHeld) field.onChange(current);
}

/** The note at a time the zone shows twice: which of the two is meant (D347). */
function useRepeatedNote(instant: Instant | null, timeZone: TimeZone): string | undefined {
  const { i18n, t } = useLingui();
  const utc = instant === null ? null : repeatedTimeOffset(instant, timeZone);
  if (instant === null || utc === null) return undefined;
  const time = formatInstant(instant, "time", i18n.locale, timeZone);
  return t({ message: `${time} (${utc})`, comment: "A wall-clock time and its UTC offset" });
}

/**
 * A stretch of time, entered as a date, a start time and an end time, bound to two Instants of
 * the draft in the given Time Zone. An end time that is not after the start time lies on the next
 * day ("+1"); a separate end date can be opened for a longer range. A part the user did not
 * change keeps its Instant with its seconds (D344). A time the zone shows twice is resolved by
 * `resolveWallClockTime` of `time` and named at the field; a skipped one blocks the save with a
 * message (D347). A message of the Contract at the end, such as "the end lies after the start",
 * shows at the end time. The field reads no Setting and no clock.
 */
export const TimeRangeField = typedMemo(function TimeRangeField<FormDraft>({
  form,
  start: startName,
  end: endName,
  timeZone,
  firstDayOfWeek,
  today,
  label,
  disabled = false,
}: TimeRangeFieldProps<FormDraft>) {
  const { t, i18n } = useLingui();
  const start = useFieldBinding(form, startName) as FieldBinding<unknown>;
  const end = useFieldBinding(form, endName) as FieldBinding<unknown>;
  const startInstant = checkedOrNull(instantSchema, start.value);
  const endInstant = checkedOrNull(instantSchema, end.value);
  const binding = bindingOf(form);
  const isEdit = binding.isEdit;

  // A value from outside, by code or followed from the stored entry (D324), or another Time Zone
  // draws every part anew.
  const outside = `${start.setFromOutside}:${end.setFromOutside}:${timeZone}`;
  const [shownFor, setShownFor] = useState(outside);
  const [view, setView] = useState(() => fresh(partsOf(startInstant, endInstant, timeZone)));
  // The view as the last event left it: a picker reports unfinished text after a timeout, which
  // may run after a newer event than the draw it was scheduled in.
  const latest = useRef(view);
  // The Instants the parts were drawn from: an untouched one comes back with its seconds (D344).
  const original = useRef({ start: startInstant, end: endInstant });
  if (shownFor !== outside) {
    const next = fresh(partsOf(startInstant, endInstant, timeZone));
    latest.current = next;
    original.current = { start: startInstant, end: endInstant };
    setShownFor(outside);
    setView(next);
  }

  const apply = (change: (parts: RangeParts) => RangeParts, part: Part, finished: boolean) => {
    const before = latest.current;
    const parts = change(before.parts);
    const unfinished = new Set(before.unfinished);
    if (finished) unfinished.delete(part);
    else unfinished.add(part);
    // Read now, not from this draw: the other side may have changed since.
    const current = {
      start: checkedOrNull(instantSchema, binding.valueOf(startName)),
      end: checkedOrNull(instantSchema, binding.valueOf(endName)),
    };
    const outcome = rangeFrom(parts, current, timeZone, isEdit, original.current);
    const next: View = {
      parts,
      unfinished,
      skipped: { start: outcome.start.case === "skipped", end: outcome.end.case === "skipped" },
    };
    const wasHeld = heldOf(before);
    latest.current = next;
    // Unfinished text reported again while it is typed changes nothing to draw.
    if (!sameView(before, next)) setView(next);
    tell(
      start,
      current.start,
      outcome.start,
      unfinished.has("day") || unfinished.has("startTime"),
      wasHeld.start,
    );
    tell(
      end,
      current.end,
      outcome.end,
      unfinished.has("endTime") || unfinished.has("endDay"),
      wasHeld.end,
    );
  };
  const set = <Of extends Part>(part: Of, value: RangeParts[Of]) =>
    apply((parts) => ({ ...parts, [part]: value }), part, true);
  const unfinishedAt = (part: Part) => () => apply((parts) => parts, part, false);
  const { parts } = view;
  const { start: startHeld, end: endHeld } = heldOf(view);
  const startNote = useRepeatedNote(startHeld ? null : startInstant, timeZone);
  const endNote = useRepeatedNote(endHeld ? null : endInstant, timeZone);
  // The time that really passed between the two Instants, also across a clock change (D347).
  const duration =
    startInstant !== null &&
    endInstant !== null &&
    !startHeld &&
    !endHeld &&
    epochMsOf(endInstant) >= epochMsOf(startInstant)
      ? formatDuration(durationBetween(startInstant, endInstant), "hoursMinutes", i18n.locale)
      : undefined;
  // A day that is no value shows the message at the day, everything else at the time.
  const startErrorAtDay = view.unfinished.has("day");
  const endErrorAtDay = view.unfinished.has("endDay");
  const shared = { firstDayOfWeek, today, disabled };
  const dayProps = (day: CalendarDay | null) => ({ ...shared, day });

  return (
    <Fieldset disabled={disabled} legend={label} variant="unstyled">
      <Group align="flex-start" gap="sm">
        <Group align="flex-start" gap="sm" ref={start.ref}>
          <DayInput
            key={`day ${outside}`}
            {...dayProps(parts.day)}
            error={startErrorAtDay ? start.error : undefined}
            label={t`Date`}
            onBlur={start.onBlur}
            onDay={(day) => set("day", day)}
            onUnfinished={unfinishedAt("day")}
          />
          <TimeInput
            key={`start ${outside}`}
            description={startNote}
            descriptionBelow
            disabled={disabled}
            error={startErrorAtDay ? undefined : start.error}
            label={t({ message: "Start", context: "beginning of a stretch of time" })}
            onBlur={start.onBlur}
            onTime={(time: WallClockTime | null) => set("startTime", time)}
            onUnfinished={unfinishedAt("startTime")}
            time={parts.startTime}
          />
        </Group>
        <Group align="flex-start" gap="sm" ref={end.ref}>
          <TimeInput
            key={`end ${outside}`}
            beside={
              <>
                {isNextDay(parts) && (
                  <Badge title={t`The end lies on the next day.`} variant="light">
                    +1
                  </Badge>
                )}
                {!parts.endDayOpen && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      apply(
                        (now) => ({ ...now, endDayOpen: true, endDay: dayOfEnd(now) ?? today }),
                        "endDay",
                        true,
                      )
                    }
                    size="compact-sm"
                    variant="subtle"
                  >
                    {t`Add an end date`}
                  </Button>
                )}
              </>
            }
            description={endNote}
            descriptionBelow
            disabled={disabled}
            error={endErrorAtDay ? undefined : end.error}
            label={t({ message: "End", context: "end of a stretch of time" })}
            onBlur={end.onBlur}
            onTime={(time: WallClockTime | null) => set("endTime", time)}
            onUnfinished={unfinishedAt("endTime")}
            time={parts.endTime}
          />
          {parts.endDayOpen && (
            <DayInput
              key={`end day ${outside}`}
              {...dayProps(parts.endDay)}
              beside={
                <CloseButton
                  aria-label={t`Remove the end date`}
                  disabled={disabled}
                  onClick={() => apply((now) => ({ ...now, endDayOpen: false }), "endDay", true)}
                />
              }
              error={endErrorAtDay ? end.error : undefined}
              label={t`End date`}
              onBlur={end.onBlur}
              onDay={(day) => set("endDay", day)}
              onUnfinished={unfinishedAt("endDay")}
            />
          )}
        </Group>
      </Group>
      {duration !== undefined && (
        <Text c="dimmed" mt={4} size="sm">
          {t`Duration: ${duration}`}
        </Text>
      )}
    </Fieldset>
  );
});
