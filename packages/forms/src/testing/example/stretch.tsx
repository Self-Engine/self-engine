// An invented Contract and form for a stretch of time, as `time-tracking` will write its own: a
// title and two Instants, entered with the field "date, start, end". It belongs to no module and
// no Data Process serves it: the stories answer it with Fixed Answers. Its labels are plain
// English, like every story's sample text; the field's own parts speak the App Language.

import { msg } from "@lingui/core/macro";
import { Button, Stack } from "@mantine/core";
import { oc } from "@orpc/contract";
import { portHooks } from "@self-engine/data-client/react";
import { refusal } from "@self-engine/db/schema";
import { type CalendarDay, epochMsOf, type Instant, instantSchema, resolveTimeZone } from "@self-engine/time";
import { useState } from "react";
import { z } from "zod";
import { OperationFormBody, TextField, TimeRangeField, useOperationForm } from "../../index.ts";
import { EXAMPLE_TODAY } from "./example-form.tsx";

/** The zone of the example: Berlin, whose clocks change on 25 October 2026 and 28 March 2027. */
export const STRETCH_TIME_ZONE = resolveTimeZone("Europe/Berlin").timeZone;

const stretchFields = {
  title: z.string().trim().min(1).max(80),
  started_at: instantSchema,
  ended_at: instantSchema,
};

/** The rule across both Instants; an edit checks it when it sends both (they are tied). */
const endAfterStart = ({
  started_at,
  ended_at,
}: {
  readonly started_at?: Instant | undefined;
  readonly ended_at?: Instant | undefined;
}) =>
  started_at === undefined || ended_at === undefined || epochMsOf(ended_at) > epochMsOf(started_at);
const END_AFTER_START = { path: ["ended_at"], params: { reason: "end_before_start" } };

export const stretchSchema = z.object({ id: z.string(), ...stretchFields });
export type Stretch = z.output<typeof stretchSchema>;

export const stretchContract = {
  create: oc
    .input(z.strictObject(stretchFields).refine(endAfterStart, END_AFTER_START))
    .output(stretchSchema),
  update: oc
    .input(
      z
        .strictObject({
          id: z.string(),
          title: stretchFields.title.optional(),
          started_at: stretchFields.started_at.optional(),
          ended_at: stretchFields.ended_at.optional(),
        })
        .refine(endAfterStart, END_AFTER_START),
    )
    .output(stretchSchema)
    .errors({ ...refusal }),
};

const stretchPort = portHooks<typeof stretchContract>("stretch");
const useCreateStretch = stretchPort.operation("create");
const useUpdateStretch = stretchPort.operation("update");

const texts = { reasons: { end_before_start: msg`The end must lie after the start.` } };

/** Creates a stretch, or edits `stored`. */
export function StretchForm({
  stored,
  startDay,
}: {
  readonly stored?: Stretch;
  /** The day a new stretch opens on; without it, the date is empty too. */
  readonly startDay?: CalendarDay;
}) {
  if (stored !== undefined) return <EditStretch stored={stored} />;
  return startDay === undefined ? <NewStretch /> : <NewStretch startDay={startDay} />;
}

function Saved({ saved }: { readonly saved: boolean }) {
  return saved ? <output>Saved</output> : null;
}

function NewStretch({ startDay }: { readonly startDay?: CalendarDay }) {
  const [saved, setSaved] = useState(false);
  const form = useOperationForm({
    entry: stretchContract.create,
    operation: useCreateStretch(),
    draft: { title: "", started_at: null, ended_at: null },
    texts,
    onSuccess: () => setSaved(true),
  });
  return (
    <OperationFormBody form={form}>
      <Stack>
        <TextField form={form} label="Title" name="title" />
        <TimeRangeField
          end="ended_at"
          firstDayOfWeek="monday"
          form={form}
          label="Worked"
          start="started_at"
          {...(startDay === undefined ? {} : { startDay })}
          timeZone={STRETCH_TIME_ZONE}
          today={EXAMPLE_TODAY}
        />
        <Button type="submit">Save</Button>
        <Saved saved={saved} />
      </Stack>
    </OperationFormBody>
  );
}

function EditStretch({ stored }: { readonly stored: Stretch }) {
  const [saved, setSaved] = useState(false);
  const form = useOperationForm({
    entry: stretchContract.update,
    operation: useUpdateStretch(),
    draft: stored,
    texts,
    edit: { identity: { id: stored.id }, tiedFields: [["started_at", "ended_at"]] },
    onSuccess: () => setSaved(true),
  });
  return (
    <OperationFormBody form={form}>
      <Stack>
        <TextField form={form} label="Title" name="title" />
        <TimeRangeField
          end="ended_at"
          firstDayOfWeek="monday"
          form={form}
          label="Worked"
          start="started_at"
          timeZone={STRETCH_TIME_ZONE}
          today={EXAMPLE_TODAY}
        />
        <Button type="submit">Save</Button>
        <Saved saved={saved} />
      </Stack>
    </OperationFormBody>
  );
}
