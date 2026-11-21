// The timer's Indicator Panel (#350, D322, D358): the content the Shell shows below the timer's
// Module Indicator, as a popover or on the phone as a sheet from below. It loads at the first
// opening, or when the Shell preloads it in an idle moment, with the Contract the forms check
// with, the form helper and the project picker; none of them is part of the start or of the
// indicator.

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Button, Stack, Text } from "@mantine/core";
import { useDataAccess } from "@self-engine/data-client/react";
import { EditDrawerForm, InstantField, LongTextField, useOperationForm } from "@self-engine/forms";
import { ProjectField } from "@self-engine/projects/picker";
import type { IndicatorPanelProps } from "@self-engine/shell";
import { formatInstant } from "@self-engine/time";
import { useFirstDayOfWeek, useTimeZone, useToday } from "@self-engine/time/react";
import { QueryStateBlock } from "@self-engine/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  END_BEFORE_START,
  END_IN_FUTURE,
  START_IN_FUTURE,
  type TimerId,
  timeTrackingContract,
} from "../contracts/index.ts";
import { type TimerWithProject, useEditTimer, useRunningTimers, useStopTimer } from "../port.ts";
import { discardTimerAndTell, NO_TIMER_RUNNING, tellStop } from "../timer-actions.tsx";
import { type PanelPart, panelPart, STOP_AT_IN_PLACE } from "../timer-panel-part.ts";

/** The texts of the reasons the Operations raise at a field (D369); the compiler asks for each. */
const EDIT_TEXTS = { reasons: { [START_IN_FUTURE]: msg`The start cannot lie in the future.` } };
const STOP_TEXTS = {
  reasons: {
    [END_BEFORE_START]: msg`The end must lie after the start.`,
    [END_IN_FUTURE]: msg`The end cannot lie in the future.`,
  },
};

/**
 * The panel of the running timer the indicator shows, the most recently started (D310): the form
 * for project, note and start, or "Stop at …", whichever the module's state asks for. It keeps
 * the timer it opened with: when that one stops elsewhere, the panel says so rather than turning
 * to another.
 */
export default function TimerPanel(props: IndicatorPanelProps) {
  return (
    <QueryStateBlock state={useRunningTimers()}>
      {(timers) => <OpenedTimer {...props} timers={timers} />}
    </QueryStateBlock>
  );
}

function OpenedTimer({
  timers,
  ...props
}: IndicatorPanelProps & { readonly timers: readonly TimerWithProject[] }) {
  const [latest] = timers;
  // The timer the indicator showed when the panel opened, from the first answer that has one.
  const [opened, setOpened] = useState<TimerId | undefined>(latest?.id);
  if (opened === undefined && latest !== undefined) setOpened(latest.id);
  const timer = timers.find(({ id }) => id === (opened ?? latest?.id));
  if (timer === undefined) return <NoTimer gone={opened !== undefined} onDone={props.onDone} />;
  return <RunningTimerPanel {...props} timer={timer} />;
}

/** No timer runs, or the panel's timer stopped elsewhere while it was open. */
function NoTimer({ gone, onDone }: { readonly gone: boolean; readonly onDone: () => void }) {
  const { t, i18n } = useLingui();
  return (
    <Stack gap="sm">
      <Text size="sm">{gone ? t`This timer is no longer running.` : i18n._(NO_TIMER_RUNNING)}</Text>
      <Button onClick={onDone} variant="default">
        {t({ message: "Close", context: "Close the panel" })}
      </Button>
    </Stack>
  );
}

type PartProps = IndicatorPanelProps & {
  readonly timer: TimerWithProject;
  /** Shows the other part, asking first when this one holds unsaved changes. */
  readonly switchTo: (part: PanelPart) => void;
};

/**
 * One part at a time, so the small panel holds one form. A request of the module's state, such as
 * from the Notice of a clock before the start, switches the open panel as a button here does.
 */
function RunningTimerPanel(props: IndicatorPanelProps & { readonly timer: TimerWithProject }) {
  const { confirmDiscard } = props;
  const [part, setPart] = useState<PanelPart>(panelPart.opening);
  const shown = useRef(part);
  // The latest question of the frame, before the paint, as `useUnsavedChanges` reads its check:
  // the switch below is made once and outlives the render that made it.
  const confirm = useRef(confirmDiscard);
  useLayoutEffect(() => {
    confirm.current = confirmDiscard;
  });
  const switchTo = useRef(async (next: PanelPart) => {
    if (next === shown.current) return;
    if (!(await confirm.current())) return;
    shown.current = next;
    setPart(next);
  });
  useEffect(() => panelPart.attach((next) => void switchTo.current(next)), []);
  // The focus goes into each part as it appears, on the field marked for it or else on the first
  // field: when the panel opens, the Shell's focus trap may have looked before the timers' first
  // answer drew the form, and after a switch the control that switched is gone with its part.
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const within = content.current;
    (
      within?.querySelector<HTMLElement>("[data-autofocus]") ??
      within?.querySelector<HTMLElement>("input:not([disabled]), textarea")
    )?.focus();
  }, [part]);
  const partProps = { ...props, switchTo: (next: PanelPart) => void switchTo.current(next) };
  return <div ref={content}>{partOf(part, partProps)}</div>;
}

function partOf(part: PanelPart, props: PartProps) {
  switch (part) {
    case "edit":
      return <EditTimerForm {...props} />;
    case "stopAt":
      return <StopAtForm {...props} />;
    default:
      return part satisfies never;
  }
}

/**
 * Project, note and start of the running timer (D329). It sends the id and the changed fields; an
 * untouched start keeps its seconds (D344). The project can be cleared, and an archived one the
 * timer carries shows as archived. A start in the future comes back from the Operation and shows
 * at the start (D369). "Stop at …" and "Discard" are named Operations beside the form (D322).
 */
function EditTimerForm({ timer, onCancel, onDone, confirmDiscard, switchTo }: PartProps) {
  const { t } = useLingui();
  const data = useDataAccess();
  const timeZone = useTimeZone();
  const today = useToday(timeZone);
  const firstDayOfWeek = useFirstDayOfWeek();
  const [discarding, setDiscarding] = useState(false);
  const form = useOperationForm({
    entry: timeTrackingContract.editTimer,
    operation: useEditTimer(),
    draft: {
      id: timer.id,
      startedAt: timer.startedAt,
      projectId: timer.projectId,
      note: timer.note ?? "",
    },
    edit: { identity: { id: timer.id } },
    emptyTextFields: ["note"],
    texts: EDIT_TEXTS,
    onDone,
  });
  const discard = async () => {
    if (!(await confirmDiscard())) return;
    setDiscarding(true);
    const result = await discardTimerAndTell(data, timer.id, STOP_AT_IN_PLACE);
    switch (result.status) {
      // Gone already: nothing is left to edit here, and the building block told why.
      case "success":
      case "notFound":
        onDone();
        return;
      case "refused":
      case "invalid":
      case "unexpected":
        setDiscarding(false);
        return;
      default:
        result satisfies never;
    }
  };
  return (
    <EditDrawerForm
      actions={
        <>
          <Button disabled={discarding} onClick={() => switchTo("stopAt")} variant="subtle">
            {t`Stop at …`}
          </Button>
          <Button color="red" disabled={discarding} onClick={() => void discard()} variant="subtle">
            {t({ message: "Discard", context: "Discard the running timer" })}
          </Button>
        </>
      }
      form={form}
      onCancel={onCancel}
    >
      <ProjectField
        clearable
        current={timer.project}
        form={form}
        label={t`Project`}
        name="projectId"
      />
      {/* The note takes the focus when the panel opens: the picker above opens its list on focus. */}
      <LongTextField data-autofocus form={form} label={t`Note`} name="note" />
      <InstantField
        firstDayOfWeek={firstDayOfWeek}
        form={form}
        label={t({ message: "Start", context: "beginning of a stretch of time" })}
        name="startedAt"
        timeZone={timeZone}
        today={today}
      />
    </EditDrawerForm>
  );
}

/**
 * "Stop at …": the timer becomes its entry with the end typed here (D349), with the Notice and
 * "Undo" of a stop from the indicator. An end not after the start, or after the Data Process's
 * "now", comes back from the Operation and shows at the end (D369).
 */
function StopAtForm({ timer, onCancel, onDone, switchTo }: PartProps) {
  const { t, i18n } = useLingui();
  const data = useDataAccess();
  const timeZone = useTimeZone();
  const today = useToday(timeZone);
  const firstDayOfWeek = useFirstDayOfWeek();
  const form = useOperationForm({
    entry: timeTrackingContract.stopTimer,
    operation: useStopTimer(),
    draft: { id: timer.id, endedAt: null },
    texts: STOP_TEXTS,
    onSuccess: (stop) => tellStop(data, timer.id, stop, STOP_AT_IN_PLACE),
    onDone,
  });
  const start = formatInstant(timer.startedAt, "dateTime", i18n.locale, timeZone);
  return (
    <EditDrawerForm
      actions={
        <Button onClick={() => switchTo("edit")} variant="subtle">
          {t({ message: "Back", context: "Back to the timer's form" })}
        </Button>
      }
      form={form}
      onCancel={onCancel}
      submitLabel={t({ message: "Stop", context: "Stop the timer at the chosen end" })}
    >
      <Text c="dimmed" size="sm">
        {t`Running since ${start}`}
      </Text>
      <InstantField
        day={today}
        firstDayOfWeek={firstDayOfWeek}
        form={form}
        label={t({ message: "End", context: "end of a stretch of time" })}
        legend={t`Stop at …`}
        name="endedAt"
        timeZone={timeZone}
        today={today}
      />
    </EditDrawerForm>
  );
}
