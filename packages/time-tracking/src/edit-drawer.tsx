import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@mantine/core";
import { useWithUndo } from "@self-engine/data-client/react";
import {
  type DraftOfEntry,
  EditDrawerForm,
  LongTextField,
  type OperationForm,
  TimeRangeField,
  useLeavingEntry,
  useOperationForm,
} from "@self-engine/forms";
import { type EditDrawerProps, useEditDrawerTitle } from "@self-engine/shell";
import { type CalendarDay, calendarDaySchema, formatInstant } from "@self-engine/time";
import { useFirstDayOfWeek, useTimeZone, useToday } from "@self-engine/time/react";
import { ErrorState, QueryStateBlock } from "@self-engine/ui";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  END_BEFORE_START,
  ROUNDING_RULE_UNKNOWN,
  type TimeEntryId,
  timeEntryIdSchema,
  timeEntryTiedFields,
  timeTrackingContract,
} from "./contracts/index.ts";
import { NEW_ENTRY, NEW_ENTRY_ON } from "./entry-address.ts";
import { LeadProjectField } from "./lead-project-field.tsx";
import {
  type TimeEntryWithProject,
  useCreateTimeEntry,
  useDeleteTimeEntry,
  useEditTimeEntry,
  useRestoreTimeEntry,
  useTimeEntry,
} from "./port.ts";

/**
 * The module's texts for the rules of its Contract (D320): "end after start" shows at the end. The
 * form has no field for the rule, so a rule this version cannot read shows in the Notice.
 */
const TEXTS = {
  reasons: {
    [END_BEFORE_START]: msg`The end must lie after the start.`,
    [ROUNDING_RULE_UNKNOWN]: msg`This time entry was saved by a newer version of the app. Update the app to edit it.`,
  },
};

// An element, not text: `Trans` translates when the Notice renders, in the language active then.
const DELETED = <Trans>Time entry deleted</Trans>;

/** What the Edit Drawer's address names: text, read without a throw whatever was typed into it. */
type EntryAddress =
  | { readonly kind: "new"; readonly day: CalendarDay | undefined }
  | { readonly kind: "stored"; readonly id: TimeEntryId }
  | { readonly kind: "unknown" };

function entryAddressOf(text: string): EntryAddress {
  if (text === NEW_ENTRY) return { kind: "new", day: undefined };
  if (text.startsWith(NEW_ENTRY_ON)) {
    const day = calendarDaySchema.safeParse(text.slice(NEW_ENTRY_ON.length));
    return day.success ? { kind: "new", day: day.data } : { kind: "unknown" };
  }
  const id = timeEntryIdSchema.safeParse(text);
  return id.success ? { kind: "stored", id: id.data } : { kind: "unknown" };
}

/**
 * The Edit Drawer of `time-tracking` (D317–D323, D330, D334, D346). It loads on demand with the
 * Contract, whose input schema the form checks with, and with the form helper and the project
 * picker; none of them is part of the start.
 */
export default function EditDrawer(props: EditDrawerProps<TimeEntryId>) {
  const address = entryAddressOf(props.id);
  if (address.kind === "new") return <NewEntryForm {...props} day={address.day} />;
  if (address.kind === "stored") return <StoredEntryDrawer {...props} id={address.id} />;
  return <NotFound {...props} />;
}

function NotFound({ onDone }: EditDrawerProps) {
  const { t } = useLingui();
  return (
    <ErrorState
      title={t`Time entry not found`}
      action={
        <Button onClick={onDone} variant="default">
          {t({ message: "Close", context: "Close the drawer" })}
        </Button>
      }
    />
  );
}

/**
 * The name a person knows a Time Entry by, in a Notice of a Refusal: its Lead Project and its start.
 * A refused undo names the project that has to come back first this way.
 */
function useEntryName(entry: TimeEntryWithProject | undefined): string | undefined {
  const { t, i18n } = useLingui();
  const timeZone = useTimeZone();
  if (entry === undefined) return undefined;
  const start = formatInstant(entry.startedAt, "dateTime", i18n.locale, timeZone);
  const project = entry.projectShares[0]?.project.title;
  return project === undefined
    ? t({
        message: `No project, ${start}`,
        comment: "A time entry without a project and its start",
      })
    : t({ message: `${project}, ${start}`, comment: "A time entry's project and its start" });
}

/** A new entry: on the day clicked in the week, otherwise on today; the times are empty. */
function NewEntryForm({
  day,
  onCancel,
  onCreated,
}: EditDrawerProps<TimeEntryId> & { readonly day: CalendarDay | undefined }) {
  const { t } = useLingui();
  useEditDrawerTitle(t`New time entry`);
  const form = useOperationForm({
    entry: timeTrackingContract.create,
    operation: useCreateTimeEntry(),
    // No field chooses a rule yet: the rule that holds rounds the entry.
    draft: { startedAt: null, endedAt: null, projects: [], note: "", ruleByHand: null },
    emptyTextFields: ["note"],
    texts: TEXTS,
    // The new entry's row takes the focus once the week shows it.
    onSuccess: (entry) => onCreated(entry.id),
  });
  return <EntryFields form={form} onCancel={onCancel} project={null} startDay={day} />;
}

function StoredEntryDrawer(props: EditDrawerProps & { readonly id: TimeEntryId }) {
  const input = useMemo(() => ({ id: props.id }), [props.id]);
  return (
    <QueryStateBlock state={useTimeEntry(input)}>
      {(found) => <FoundEntry {...props} found={found ?? undefined} />}
    </QueryStateBlock>
  );
}

/**
 * Keeps the last entry it found, so that one deleted elsewhere stays readable with the warning
 * (D324). Once "Delete" was chosen here, it keeps the entry as it was until the drawer has closed.
 * The drawer closes when the delete succeeded and offers undo in a Notice; a failed one leaves it
 * open with what was typed.
 */
function FoundEntry({
  found,
  ...props
}: EditDrawerProps & { readonly found: TimeEntryWithProject | undefined }) {
  const { entry, deleted, leave } = useLeavingEntry(found, props.onDone);
  const name = useEntryName(entry);
  const restore = useRestoreTimeEntry().run;
  // The frame refuses the undo when the project was deleted meanwhile (D337); its Notice names
  // the entry by its project, the one that has to come back first.
  const undo = useCallback<typeof restore>(
    (input, options) => restore(input, options ?? (name === undefined ? {} : { entry: name })),
    [restore, name],
  );
  const remove = useWithUndo(useDeleteTimeEntry().run, undo, DELETED);
  if (entry === undefined) return <NotFound {...props} />;
  return (
    <EditForm
      {...props}
      deleted={deleted}
      entry={entry}
      name={name}
      onDelete={() => void leave(() => remove(entry.id, name === undefined ? {} : { entry: name }))}
    />
  );
}

/**
 * The form of a stored entry. It sends the id and the changed fields, and start and end together
 * when either changed (D323); a part the user did not touch keeps its Instant with its seconds
 * (D344). The helper follows a change from elsewhere in the untouched fields (D324).
 */
function EditForm({
  entry,
  name,
  deleted,
  onDelete,
  onCancel,
  onDone,
}: EditDrawerProps & {
  readonly entry: TimeEntryWithProject;
  readonly name: string | undefined;
  readonly deleted: boolean;
  readonly onDelete: () => void;
}) {
  const { t } = useLingui();
  useEditDrawerTitle(t`Time entry`);
  const form = useOperationForm({
    entry: timeTrackingContract.edit,
    operation: useEditTimeEntry(),
    draft: {
      id: entry.id,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      projects: entry.projectShares.map(({ projectId, weight }) => ({ projectId, weight })),
      note: entry.note ?? "",
      // No field changes the rule, so the edit never sends it and the entry keeps its own.
      ruleByHand: null,
    },
    edit: { identity: { id: entry.id }, tiedFields: timeEntryTiedFields, deleted },
    emptyTextFields: ["note"],
    texts: TEXTS,
    ...(name !== undefined && { entryName: name }),
    onDone,
  });
  return (
    <EntryFields
      actions={
        // A named Operation, never a field (D322).
        <Button onClick={onDelete} variant="subtle">
          {t`Delete`}
        </Button>
      }
      form={form}
      onCancel={onCancel}
      project={entry.projectShares[0]?.project ?? null}
    />
  );
}

/** The fields create and edit share, from the one Field List (ADR 0032). */
type EntryDraft = Omit<DraftOfEntry<typeof timeTrackingContract.edit>, "id">;

/**
 * Date, start and end in the Time Zone of the Setting, with the duration that really passed below
 * them (the field shows it and redraws alone while the user types); the project, which can be
 * cleared; and the note. No upper limit on the length, and an entry in the future is allowed.
 */
function EntryFields({
  form,
  project,
  startDay,
  onCancel,
  actions,
}: {
  readonly form: OperationForm<EntryDraft>;
  /** The Lead Project of the stored entry, so an archived or deleted one shows as such. */
  readonly project: TimeEntryWithProject["projectShares"][number]["project"] | null;
  /** The date a new entry shows before its start is typed; today without one. */
  readonly startDay?: CalendarDay | undefined;
  readonly onCancel: () => void;
  readonly actions?: ReactNode;
}) {
  const { t } = useLingui();
  const timeZone = useTimeZone();
  const today = useToday(timeZone);
  const firstDayOfWeek = useFirstDayOfWeek();
  return (
    <EditDrawerForm actions={actions} form={form} onCancel={onCancel}>
      <TimeRangeField
        end="endedAt"
        firstDayOfWeek={firstDayOfWeek}
        form={form}
        label={t({ message: "Time", context: "When a time entry took place" })}
        start="startedAt"
        startDay={startDay ?? today}
        timeZone={timeZone}
        today={today}
      />
      <LeadProjectField current={project} form={form} label={t`Project`} />
      <LongTextField form={form} label={t`Note`} name="note" />
    </EditDrawerForm>
  );
}
