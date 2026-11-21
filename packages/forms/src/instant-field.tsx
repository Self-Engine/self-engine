// The field "date, time" (D319, D344, D347): one field bound to one Instant of the draft, such as a
// timer's start or the end of "Stop at …". It shows a date and a wall-clock time with the inputs
// of `date-inputs.tsx`; `instant-parts.ts` turns what it shows into the Instant. The texts and the
// hand-over at the end of this file the field "date, start, end" shares.

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Fieldset, Group } from "@mantine/core";
import {
  type CalendarDay,
  type FirstDayOfWeek,
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
import {
  type FieldTaking,
  type TakingBinding,
  typedMemo,
  useFieldTaking,
} from "./field-binding.ts";
import {
  type InstantOutcome,
  type InstantParts,
  instantFrom,
  instantPartsOf,
} from "./instant-parts.ts";
import { bindingOf, type OperationForm } from "./operation-form.ts";

/** Shown at a time the clocks skip on that day (D347). */
export const SKIPPED = msg`This time does not exist on this day: the clocks skip it. Choose another.`;

/**
 * Hands one Instant's outcome to its field of the draft: text that is no value, a skipped time, a
 * new Instant, or nothing, in which case an older message of this field is taken back.
 */
export function tell(
  field: TakingBinding<Instant | null>,
  current: Instant | null,
  outcome: InstantOutcome,
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
export function useRepeatedNote(instant: Instant | null, timeZone: TimeZone): string | undefined {
  const { i18n, t } = useLingui();
  const utc = instant === null ? null : repeatedTimeOffset(instant, timeZone);
  if (instant === null || utc === null) return undefined;
  const time = formatInstant(instant, "time", i18n.locale, timeZone);
  return t({ message: `${time} (${utc})`, comment: "A wall-clock time and its UTC offset" });
}

export interface InstantFieldProps<FormDraft> {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Instant. */
  readonly name: FieldTaking<FormDraft, Instant | null>;
  /** The zone the date and the time are read in; the caller reads it from the Setting. */
  readonly timeZone: TimeZone;
  /** The column the calendar starts its weeks with; the caller reads it from the Setting. */
  readonly firstDayOfWeek: FirstDayOfWeek;
  /** The day the calendar marks as today and opens on while empty: `useToday(timeZone)`. */
  readonly today: CalendarDay;
  /**
   * The date the field shows while the draft holds no Instant. It is no value of the draft: the
   * Instant takes it once its time is typed.
   */
  readonly day?: CalendarDay;
  /** The label of the time, such as "Start"; the date is labelled "Date". */
  readonly label: ReactNode;
  /** The name of the whole field, above both inputs. */
  readonly legend?: ReactNode;
}

/** The parts of the field that hold text which is no value yet. */
type Part = "day" | "time";

interface View {
  readonly parts: InstantParts;
  /** Parts holding unfinished text; their older value stays in `parts`. */
  readonly unfinished: ReadonlySet<Part>;
  /** The clocks skip the time on that day. */
  readonly skipped: boolean;
}

function sameView(a: View, b: View): boolean {
  return (
    a.parts.day === b.parts.day &&
    a.parts.time === b.parts.time &&
    a.unfinished.size === b.unfinished.size &&
    [...a.unfinished].every((part) => b.unfinished.has(part)) &&
    a.skipped === b.skipped
  );
}

/** Whether the field holds no value the draft can take: text that is no value, or a skipped time. */
const heldOf = ({ unfinished, skipped }: View) => skipped || unfinished.size > 0;

/**
 * One Instant, entered as a date and a wall-clock time in the given Time Zone. A part the user did
 * not change keeps the Instant's seconds (D344). A time the zone shows twice is resolved by
 * `resolveWallClockTime` of `time` and named at the field; a skipped one blocks the save with a
 * message (D347). A message of the Contract or of the Operation at the Instant shows at the time,
 * or at the date while the date holds text that is no day. The field reads no Setting and no clock.
 */
export const InstantField = typedMemo(function InstantField<FormDraft>({
  form,
  name,
  timeZone,
  ...props
}: InstantFieldProps<FormDraft>) {
  const field = useFieldTaking(form, name);
  const binding = bindingOf(form);
  return (
    <InstantInputs
      // A value from outside, by code or followed from the stored entry (D324), or another Time
      // Zone draws both parts anew, from the Instant the draft now holds.
      key={`${field.setFromOutside}:${timeZone}`}
      field={field}
      instantNow={() => checkedOrNull(instantSchema, binding.valueOf(name))}
      isEdit={binding.isEdit}
      timeZone={timeZone}
      {...props}
    />
  );
});

type InstantInputsProps = {
  readonly field: TakingBinding<Instant | null>;
  readonly instantNow: () => Instant | null;
  readonly isEdit: boolean;
} & Omit<InstantFieldProps<unknown>, "form" | "name">;

function InstantInputs({
  field,
  instantNow,
  isEdit,
  timeZone,
  firstDayOfWeek,
  today,
  day: emptyDay,
  label,
  legend,
}: InstantInputsProps) {
  const { t } = useLingui();
  const instant = checkedOrNull(instantSchema, field.value);
  const [view, setView] = useState<View>(() => {
    const shown = instantPartsOf(instant, timeZone);
    return {
      parts: shown.day === null && emptyDay !== undefined ? { ...shown, day: emptyDay } : shown,
      unfinished: new Set(),
      skipped: false,
    };
  });
  // The view as the last event left it: a picker reports unfinished text after a timeout, which
  // may run after a newer event than the draw it was scheduled in.
  const latest = useRef(view);
  // The Instant the parts were drawn from: untouched, it comes back with its seconds (D344).
  const original = useRef(instant);

  const apply = (change: (parts: InstantParts) => InstantParts, part: Part, finished: boolean) => {
    const before = latest.current;
    const parts = change(before.parts);
    const unfinished = new Set(before.unfinished);
    if (finished) unfinished.delete(part);
    else unfinished.add(part);
    const current = instantNow();
    const outcome = instantFrom(parts, current, timeZone, isEdit, original.current);
    const next: View = { parts, unfinished, skipped: outcome.case === "skipped" };
    latest.current = next;
    // Unfinished text reported again while it is typed changes nothing to draw.
    if (!sameView(before, next)) setView(next);
    tell(field, current, outcome, unfinished.size > 0, heldOf(before));
  };
  const { parts } = view;
  const note = useRepeatedNote(heldOf(view) ? null : instant, timeZone);
  // A day that is no value shows the message at the day, everything else at the time.
  const errorAtDay = view.unfinished.has("day");

  return (
    <Fieldset legend={legend} variant="unstyled">
      <Group align="flex-start" gap="sm" ref={field.ref}>
        <DayInput
          day={parts.day}
          error={errorAtDay ? field.error : undefined}
          firstDayOfWeek={firstDayOfWeek}
          label={t`Date`}
          onBlur={field.onBlur}
          onDay={(day: CalendarDay | null) => apply((now) => ({ ...now, day }), "day", true)}
          onUnfinished={() => apply((now) => now, "day", false)}
          today={today}
        />
        <TimeInput
          description={note}
          descriptionBelow
          error={errorAtDay ? undefined : field.error}
          label={label}
          onBlur={field.onBlur}
          onTime={(time: WallClockTime | null) => apply((now) => ({ ...now, time }), "time", true)}
          onUnfinished={() => apply((now) => now, "time", false)}
          time={parts.time}
        />
      </Group>
    </Fieldset>
  );
}
