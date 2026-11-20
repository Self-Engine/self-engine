// The fields for a Calendar Day and a Wall-Clock Time (D319, D325): the inputs of
// `date-inputs.tsx`, each bound to its field of the draft. Each can be picked and typed.

import type { DateInputProps, TimePickerProps } from "@mantine/dates";
import {
  type CalendarDay,
  calendarDaySchema,
  type FirstDayOfWeek,
  type WallClockTime,
  wallClockTimeSchema,
} from "@self-engine/time";
import { checkedOrNull } from "./checked-value.ts";
import { DayInput, type Shown, TimeInput } from "./date-inputs.tsx";
import { type FieldTaking, typedMemo, useFieldTaking } from "./field-binding.ts";
import type { OperationForm } from "./operation-form.ts";

export type CalendarDayFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Calendar Day. */
  readonly name: FieldTaking<FormDraft, CalendarDay | null>;
  /** The column the calendar starts its weeks with; the caller reads it from the Setting. */
  readonly firstDayOfWeek: FirstDayOfWeek;
  /**
   * The day the calendar marks as today and opens on while the field is empty: the caller passes
   * `useToday(timeZone)` of `@self-engine/time/react`, so the mark follows the form's Time Zone
   * and a story fixes it.
   */
  readonly today: CalendarDay;
} & Pick<DateInputProps, Shown>;

export type WallClockTimeFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Wall-Clock Time. */
  readonly name: FieldTaking<FormDraft, WallClockTime | null>;
} & Pick<TimePickerProps, Exclude<Shown, "placeholder">>;

/**
 * A Calendar Day of the draft: Mantine's date input with its calendar. A typed day is handed on
 * as soon as it is whole; any other text keeps the older value, blocks the save and shows a
 * message once the field is left (D319). Emptying the text hands on "empty".
 */
export const CalendarDayField = typedMemo(function CalendarDayField<FormDraft>({
  form,
  name,
  ...props
}: CalendarDayFieldProps<FormDraft>) {
  const field = useFieldTaking(form, name);
  return (
    <div ref={field.ref}>
      <DayInput
        // The input keeps its own value and text (uncontrolled), so a day picked in the calendar
        // always replaces the text, also when it is the day the field held. A value from outside
        // replaces both.
        key={field.setFromOutside}
        {...props}
        day={checkedOrNull(calendarDaySchema, field.value)}
        error={field.error}
        onBlur={field.onBlur}
        onDay={field.onChange}
        onUnfinished={() => field.onUnfinished()}
      />
    </div>
  );
});

/**
 * A Wall-Clock Time of the draft: Mantine's time picker on the language's 12- or 24-hour clock. A
 * time is handed on when it is whole; hours without minutes keep the older value, block the save
 * and show a message once the field is left (D319). Emptying every part hands on "empty".
 */
export const WallClockTimeField = typedMemo(function WallClockTimeField<FormDraft>({
  form,
  name,
  ...props
}: WallClockTimeFieldProps<FormDraft>) {
  const field = useFieldTaking(form, name);
  return (
    <div ref={field.ref}>
      <TimeInput
        // A value from outside replaces whatever the inputs hold.
        key={field.setFromOutside}
        {...props}
        error={field.error}
        onBlur={field.onBlur}
        onTime={field.onChange}
        onUnfinished={() => field.onUnfinished()}
        time={checkedOrNull(wallClockTimeSchema, field.value)}
      />
    </div>
  );
});
