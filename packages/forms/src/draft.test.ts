// The types of a draft (D365): a value the input schema brands keeps its brand, so the compiler
// binds a field of `time` to a field of that value and to no other.

import { oc } from "@orpc/contract";
import {
  calendarDaySchema,
  type CalendarDay,
  type Instant,
  instantSchema,
  type WallClockTime,
  wallClockTimeSchema,
} from "@self-engine/time";
import { describe, expectTypeOf, it } from "vite-plus/test";
import { z } from "zod";
import type { CalendarDayFieldProps, WallClockTimeFieldProps } from "./date-fields.tsx";
import type { DraftOfEntry, InputOfEntry } from "./operation-form.ts";
import type { IconFieldProps } from "./picker-fields.tsx";
import type { TextFieldProps } from "./text-fields.tsx";
import type { TimeRangeFieldProps } from "./time-range-field.tsx";

const entry = oc.input(
  z.strictObject({
    title: z.string().min(1),
    note: z.string().nullable(),
    icon: z.string().nullable().optional(),
    day: calendarDaySchema,
    until: calendarDaySchema.nullable().optional(),
    start: wallClockTimeSchema.nullable(),
    started_at: instantSchema,
    ended_at: instantSchema.optional(),
    hours: z.number().nullable(),
  }),
);
type Entry = typeof entry;
type EntryDraft = DraftOfEntry<Entry>;

describe("the draft of a Contract entry", () => {
  it("keeps the brand of a value the input schema brands, and holds plain text elsewhere", () => {
    expectTypeOf<EntryDraft>().toEqualTypeOf<{
      title: string | null;
      note: string | null;
      icon: string | null | undefined;
      day: CalendarDay | null;
      until: CalendarDay | null | undefined;
      start: WallClockTime | null;
      started_at: Instant | null;
      ended_at: Instant | null | undefined;
      hours: number | null;
    }>();
  });

  it("is still what the Operation takes: the input itself carries no brand", () => {
    expectTypeOf<InputOfEntry<Entry>["day"]>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<EntryDraft["day"]>>().toExtend<InputOfEntry<Entry>["day"]>();
  });
});

describe("the fields a draft's field may be bound to", () => {
  it("a date field takes a Calendar Day and no other text", () => {
    expectTypeOf<CalendarDayFieldProps<EntryDraft>["name"]>().toEqualTypeOf<"day" | "until">();
  });

  it("a time field takes a Wall-Clock Time and no other text", () => {
    expectTypeOf<WallClockTimeFieldProps<EntryDraft>["name"]>().toEqualTypeOf<"start">();
  });

  it('the field "date, start, end" takes two Instants', () => {
    type Names = "started_at" | "ended_at";
    expectTypeOf<TimeRangeFieldProps<EntryDraft>["start"]>().toEqualTypeOf<Names>();
    expectTypeOf<TimeRangeFieldProps<EntryDraft>["end"]>().toEqualTypeOf<Names>();
  });

  it("a text field and a picker of plain text take no branded value", () => {
    expectTypeOf<TextFieldProps<EntryDraft>["name"]>().toEqualTypeOf<"title" | "note" | "icon">();
    expectTypeOf<IconFieldProps<EntryDraft>["name"]>().toEqualTypeOf<"title" | "note" | "icon">();
  });
});
