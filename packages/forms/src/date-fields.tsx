// The fields for a Calendar Day and a Wall-Clock Time (D319, D325): Mantine's date and time
// pickers, bound to their field of the draft. Each can be picked and typed. The pickers exchange
// `YYYY-MM-DD` and `HH:MM`, the stored forms of `time`, so no `Date` passes; the names of months
// and weekdays, the text of a day and the 12- or 24-hour clock come from `time`, never from the
// date library the pickers bring. This file loads with the first form, never at startup, and so do
// the pickers' styles.

import "@mantine/dates/styles.css";
import { useLingui } from "@lingui/react/macro";
import { DateInput, type DateInputProps, TimePicker, type TimePickerProps } from "@mantine/dates";
import {
  type CalendarDay,
  calendarDayFromText,
  calendarDaySchema,
  calendarDayText,
  calendarLabels,
  clockFormatOf,
  type FirstDayOfWeek,
  mantineFirstDayOfWeek,
  type WallClockTime,
  wallClockTimeSchema,
} from "@self-engine/time";
import { useCallback, useEffect, useId, useRef } from "react";
import { typedMemo, useFieldBinding } from "./field-binding.ts";
import type { OperationForm } from "./operation-form.ts";
import type { FieldTaking } from "./picker-fields.tsx";

/** What a module may set on a date or time field; the helper sets everything else. */
type Shown = "label" | "description" | "placeholder" | "clearable" | "disabled" | "withAsterisk";

export type CalendarDayFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Calendar Day. */
  readonly name: FieldTaking<FormDraft, CalendarDay | null>;
  /** The column the calendar starts its weeks with; the caller reads it from the Setting. */
  readonly firstDayOfWeek: FirstDayOfWeek;
} & Pick<DateInputProps, Shown>;

export type WallClockTimeFieldProps<FormDraft> = {
  readonly form: OperationForm<FormDraft>;
  /** The field of the draft that holds the Wall-Clock Time. */
  readonly name: FieldTaking<FormDraft, WallClockTime | null>;
} & Pick<TimePickerProps, Exclude<Shown, "placeholder">>;

/**
 * The Calendar Day a value stands for: what the draft holds, or what the picker hands on. A
 * draft's day is a text to the compiler (a Contract's input carries no brand), so it is checked.
 */
function dayOf(value: unknown): CalendarDay | null {
  const parsed = calendarDaySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function timeOf(value: unknown): WallClockTime | null {
  const parsed = wallClockTimeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A name of `time` for a day, as a label function of the picker, which hands on `YYYY-MM-DD`. */
function labelling(label: (day: CalendarDay) => string) {
  return (text: string) => {
    const day = dayOf(text);
    return day === null ? text : label(day);
  };
}

/**
 * A Calendar Day of the draft: Mantine's date input with its calendar. Typed text in the
 * language's numeric order, such as `5.11.2026` or `11/5/2026`, or `2026-11-05`, becomes the day
 * as soon as it is whole; any other text keeps the older value, blocks the save and shows a
 * message once the field is left (D319). Emptying the text hands on "empty".
 */
export const CalendarDayField = typedMemo(function CalendarDayField<FormDraft>({
  form,
  name,
  firstDayOfWeek,
  clearable = false,
  ...props
}: CalendarDayFieldProps<FormDraft>) {
  const field = useFieldBinding(form, name);
  const onChange = field.onChange as (day: CalendarDay | null) => void;
  const { i18n } = useLingui();
  const locale = i18n.locale;
  const labels = calendarLabels(locale);
  const handOn = (text: string | null) => onChange(text === null ? null : dayOf(text));
  const parse = (text: string) => {
    if (text.trim() === "") {
      onChange(null);
      return null;
    }
    const day = calendarDayFromText(text, locale);
    if (day === null) field.onUnfinished();
    return day;
  };
  return (
    <div ref={field.ref}>
      <DateInput
        // The input keeps its own value and text (uncontrolled), so a day picked in the calendar
        // always replaces the text, also when it is the day the field held. A value from outside
        // replaces both.
        key={field.setFromOutside}
        {...props}
        // A click on the day the field holds keeps it: "empty" is the clear button or no text.
        allowDeselect={false}
        clearable={clearable}
        dateParser={parse}
        error={field.error}
        firstDayOfWeek={mantineFirstDayOfWeek(firstDayOfWeek)}
        fixOnBlur={false}
        getDayAriaLabel={labelling(labels.day)}
        locale={locale}
        monthLabelFormat={labelling(labels.month)}
        monthsListFormat={labelling(labels.monthShort)}
        onBlur={field.onBlur}
        onChange={handOn}
        defaultValue={dayOf(field.value)}
        valueFormat={labelling((day) => calendarDayText(day, locale))}
        weekdayFormat={labelling(labels.weekday)}
        yearLabelFormat={labelling(labels.year)}
        yearsListFormat={labelling(labels.year)}
      />
    </div>
  );
});

/** The inputs of a time picker: hours, minutes and, on a 12-hour clock, AM or PM. */
const SEGMENTS = '[role="spinbutton"], [data-am-pm]';

/** How many of the picker's inputs hold something, and how many there are. */
function segmentsOf(root: HTMLElement) {
  const segments = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(SEGMENTS)];
  const filled = segments.filter(({ value }) => value !== "" && value !== "--").length;
  return { filled, all: segments.length };
}

/**
 * A Wall-Clock Time of the draft: Mantine's time picker, typed into its hours and minutes or
 * picked from its lists, on the language's 12- or 24-hour clock. A time is handed on when it is
 * whole; hours without minutes keep the older value, block the save and show a message once the
 * field is left (D319). Emptying every part hands on "empty".
 */
export const WallClockTimeField = typedMemo(function WallClockTimeField<FormDraft>({
  form,
  name,
  ...props
}: WallClockTimeFieldProps<FormDraft>) {
  const field = useFieldBinding(form, name);
  const { onUnfinished, ref: register } = field;
  const onChange = field.onChange as (time: WallClockTime | null) => void;
  const { i18n, t } = useLingui();
  const locale = i18n.locale;
  const value = timeOf(field.value);
  // Mantine ties the message and the description to the picker's frame, which takes no focus; the
  // hours, which do, are tied to them here, so a screen reader reads them with the field.
  const id = useId();
  const describedBy = [
    field.error === undefined ? undefined : `${id}-error`,
    props.description === undefined ? undefined : `${id}-description`,
  ].filter((part) => part !== undefined);
  // What the field last told the form: Mantine reports a time only when it is whole, and once with
  // "" when it stops being whole, so empty and half-filled are read from its inputs.
  const told = useRef<"time" | "empty" | "unfinished">(value === null ? "empty" : "time");
  const root = useRef<HTMLElement | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = useCallback(
    (element: HTMLElement | null) => {
      root.current = element;
      return register(element);
    },
    [register],
  );
  // After the input or key that changed a part has been drawn: React draws it before the next task.
  const settleSoon = () => {
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      if (root.current === null) return;
      const { filled, all } = segmentsOf(root.current);
      if (filled === all) return;
      if (filled === 0) {
        if (told.current !== "empty") onChange(null);
        told.current = "empty";
        return;
      }
      told.current = "unfinished";
      onUnfinished();
    });
  };
  useEffect(() => () => clearTimeout(pending.current), []);
  const setFromOutside = field.setFromOutside;
  useEffect(() => {
    // The picker is drawn anew with the value from outside.
    told.current = timeOf(field.value) === null ? "empty" : "time";
  }, [setFromOutside]);
  return (
    <div
      onChangeCapture={settleSoon}
      onClickCapture={settleSoon}
      onInputCapture={settleSoon}
      onKeyDownCapture={settleSoon}
      onPasteCapture={settleSoon}
      ref={ref}
    >
      <TimePicker
        // A value from outside replaces whatever the inputs hold.
        key={field.setFromOutside}
        {...props}
        amPmInputLabel={t`AM or PM`}
        defaultValue={value ?? ""}
        descriptionProps={{ id: `${id}-description` }}
        error={field.error}
        errorProps={{ id: `${id}-error` }}
        hoursInputProps={{
          "aria-describedby": describedBy.length === 0 ? undefined : describedBy.join(" "),
          "aria-invalid": field.error === undefined ? undefined : true,
        }}
        format={clockFormatOf(locale)}
        minutesInputLabel={t`Minutes`}
        onBlur={field.onBlur}
        onChange={(text) => {
          const time = timeOf(text);
          if (time === null) return;
          told.current = "time";
          onChange(time);
        }}
        withDropdown
      />
    </div>
  );
});
