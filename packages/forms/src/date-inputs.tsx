// The inner parts of every date and time field of a form (D319, D325): Mantine's date input and
// time picker, set up once. They know no form: a field binds them to its field or fields of the
// draft. The pickers exchange `YYYY-MM-DD` and `HH:MM`, the stored forms of `time`, so no `Date`
// passes; the names of months and weekdays, the text of a day, "today" and the 12- or 24-hour
// clock come from `time` and the caller, never from the date library or the device's clock. This
// file loads with the first form, never at startup, and so do the pickers' styles.

import "@mantine/dates/styles.css";
import { useLingui } from "@lingui/react/macro";
import { Group } from "@mantine/core";
import { DateInput, type DateInputProps, TimePicker, type TimePickerProps } from "@mantine/dates";
import {
  type CalendarDay,
  calendarDayFromText,
  calendarDaySchema,
  calendarLabels,
  clockFormatOf,
  type FirstDayOfWeek,
  formatCalendarDay,
  mantineFirstDayOfWeek,
  type WallClockTime,
  wallClockTimeSchema,
} from "@self-engine/time";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { checkedOrNull } from "./checked-value.ts";

/** What a module may set on a date or time field; the helper sets everything else. */
export type Shown =
  | "label"
  | "description"
  | "placeholder"
  | "clearable"
  | "disabled"
  | "withAsterisk";

/**
 * What stands beside an input box, such as a button, lined up with the box itself: Mantine's
 * input container holds the box only, so the label, the description and the message above or
 * below it, at any font scale, move nothing out of line.
 */
export interface Beside {
  readonly beside?: ReactNode;
}

function besideOf(beside: ReactNode) {
  if (beside === undefined) return {};
  return {
    inputContainer: (box: ReactNode) => (
      <Group gap="sm" wrap="nowrap">
        {box}
        {beside}
      </Group>
    ),
  };
}

/** A name of `time` for a day, as a label function of the picker, which hands on `YYYY-MM-DD`. */
function labelling(label: (day: CalendarDay) => string) {
  return (text: string) => {
    const day = checkedOrNull(calendarDaySchema, text);
    return day === null ? text : label(day);
  };
}

export type DayInputProps = {
  /** The day the input shows when it is drawn; it keeps its own text after that. */
  readonly day: CalendarDay | null;
  /** A finished day, or `null` once the text is emptied. */
  readonly onDay: (day: CalendarDay | null) => void;
  /** The text is no whole, existing day. */
  readonly onUnfinished: () => void;
  readonly onBlur: () => void;
  readonly error: string | undefined;
  /** The column the calendar starts its weeks with. */
  readonly firstDayOfWeek: FirstDayOfWeek;
  /** The day the calendar marks as today and opens on while the input is empty. */
  readonly today: CalendarDay;
} & Beside &
  Pick<DateInputProps, Shown>;

/**
 * Mantine's date input with its calendar. Typed text in the language's numeric order, such as
 * `5.11.2026` or `11/5/2026`, or `2026-11-05`, becomes the day as soon as it is whole, and reads
 * in the field's format once the input is left; any other text keeps the older day, stays as
 * typed and is reported as unfinished. Emptying the text hands on "empty".
 * Draw it anew (a new `key`) to show another day.
 */
export function DayInput({
  day,
  onDay,
  onUnfinished,
  firstDayOfWeek,
  today,
  clearable = false,
  beside,
  ...props
}: DayInputProps) {
  const { i18n } = useLingui();
  const locale = i18n.locale;
  const labels = calendarLabels(locale);
  // Whether the text typed last is a whole day. Mantine writes its day in the field's format on
  // blur only with `fixOnBlur`, and then always: over unfinished text too, which would be lost.
  // So it is set only while the text is a whole day; a picked or drawn day is one as well.
  const [typedWhole, setTypedWhole] = useState(true);
  const parse = (text: string) => {
    if (text.trim() === "") {
      setTypedWhole(false);
      onDay(null);
      return null;
    }
    const parsed = calendarDayFromText(text, locale);
    setTypedWhole(parsed !== null);
    if (parsed === null) onUnfinished();
    return parsed;
  };
  return (
    <DateInput
      {...props}
      {...besideOf(beside)}
      // A click on the day the input holds keeps it: "empty" is the clear button or no text.
      allowDeselect={false}
      clearable={clearable}
      dateParser={parse}
      // Mantine reads "today" from the device's clock, which may lie in another zone than the
      // one the form speaks of: the caller's day replaces its mark, and an empty input opens on
      // its month.
      defaultDate={today}
      defaultValue={day}
      firstDayOfWeek={mantineFirstDayOfWeek(firstDayOfWeek)}
      fixOnBlur={typedWhole}
      getDayAriaLabel={labelling(labels.day)}
      getDayProps={(shown) => ({ "data-today": shown === today || undefined })}
      highlightToday
      locale={locale}
      monthLabelFormat={labelling(labels.month)}
      monthsListFormat={labelling(labels.monthShort)}
      onChange={(text) => {
        // A day picked in the calendar replaces any text.
        setTypedWhole(true);
        onDay(checkedOrNull(calendarDaySchema, text));
      }}
      valueFormat={labelling((shown) => formatCalendarDay(shown, "fieldDate", locale))}
      weekdayFormat={labelling(labels.weekday)}
      yearLabelFormat={labelling(labels.year)}
      yearsListFormat={labelling(labels.year)}
    />
  );
}

/** The inputs of a time picker: hours, minutes and, on a 12-hour clock, AM or PM. */
const SEGMENTS = '[role="spinbutton"], [data-am-pm]';

/** How many of the picker's inputs hold something, and how many there are. */
function segmentsOf(root: HTMLElement) {
  const segments = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(SEGMENTS)];
  const filled = segments.filter(({ value }) => value !== "" && value !== "--").length;
  return { filled, all: segments.length };
}

export type TimeInputProps = {
  /** The time the picker shows when it is drawn; it keeps its own inputs after that. */
  readonly time: WallClockTime | null;
  /** A whole time, or `null` once every part is emptied. */
  readonly onTime: (time: WallClockTime | null) => void;
  /** Some parts hold something, but not all. */
  readonly onUnfinished: () => void;
  readonly onBlur: () => void;
  readonly error: string | undefined;
  /** Where the description shows: above the inputs (Mantine's place) or below them. */
  readonly descriptionBelow?: boolean;
} & Beside &
  Pick<TimePickerProps, Exclude<Shown, "placeholder">>;

/**
 * Mantine's time picker, typed into its hours and minutes or picked from its lists, on the
 * language's 12- or 24-hour clock. A time is handed on when it is whole; hours without minutes
 * are reported as unfinished. Emptying every part hands on "empty". Draw it anew (a new `key`)
 * to show another time.
 */
export function TimeInput({
  time,
  onTime,
  onUnfinished,
  descriptionBelow = false,
  beside,
  ...props
}: TimeInputProps) {
  const { i18n, t } = useLingui();
  const locale = i18n.locale;
  // Mantine ties the message and the description to the picker's frame, which takes no focus; the
  // hours, the minutes and AM or PM, which do, are tied to them here, so a screen reader reads
  // them with whichever input has the focus.
  const id = useId();
  const describedBy = [
    props.error === undefined ? undefined : `${id}-error`,
    props.description === undefined ? undefined : `${id}-description`,
  ].filter((part) => part !== undefined);
  const tied = {
    "aria-describedby": describedBy.length === 0 ? undefined : describedBy.join(" "),
    "aria-invalid": props.error === undefined ? undefined : true,
  };
  // What the input last handed on: Mantine reports a time only when it is whole, and once with ""
  // when it stops being whole, so empty and half-filled are read from its inputs.
  const told = useRef<"time" | "empty" | "unfinished">(time === null ? "empty" : "time");
  const root = useRef<HTMLDivElement | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // After the input or key that changed a part has been drawn: React draws it before the next task.
  const settleSoon = () => {
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      if (root.current === null) return;
      const { filled, all } = segmentsOf(root.current);
      if (filled === all) return;
      if (filled === 0) {
        if (told.current !== "empty") onTime(null);
        told.current = "empty";
        return;
      }
      told.current = "unfinished";
      onUnfinished();
    });
  };
  useEffect(() => () => clearTimeout(pending.current), []);
  return (
    <div
      onChangeCapture={settleSoon}
      onClickCapture={settleSoon}
      onInputCapture={settleSoon}
      onKeyDownCapture={settleSoon}
      onPasteCapture={settleSoon}
      ref={root}
    >
      <TimePicker
        {...props}
        {...besideOf(beside)}
        amPmInputLabel={t`AM or PM`}
        defaultValue={time ?? ""}
        descriptionProps={{ id: `${id}-description` }}
        errorProps={{ id: `${id}-error` }}
        amPmSelectProps={tied}
        hoursInputProps={tied}
        minutesInputProps={tied}
        format={clockFormatOf(locale)}
        {...(descriptionBelow && {
          inputWrapperOrder: ["label", "input", "description", "error"],
        })}
        minutesInputLabel={t`Minutes`}
        onChange={(text) => {
          const whole = checkedOrNull(wallClockTimeSchema, text);
          if (whole === null) return;
          told.current = "time";
          onTime(whole);
        }}
        withDropdown
      />
    </div>
  );
}
