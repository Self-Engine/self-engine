import { useLingui } from "@lingui/react/macro";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { useDataAccess } from "@self-engine/data-client/react";
import { iconLength, TimeIcon } from "@self-engine/icons";
import { StartTimerIcon, StopTimerIcon } from "@self-engine/icons/indicator";
import type { IndicatorForm, ModuleIndicatorWithPanelProps } from "@self-engine/shell";
// Types only from the main entry, whose schemas need Zod's full build; the running time comes
// from its light entry.
import type { Instant } from "@self-engine/time";
import { useNow } from "@self-engine/time/react";
import { formatRunningTime } from "@self-engine/time/running-time";
import {
  type CSSProperties,
  type KeyboardEvent,
  lazy,
  type MouseEvent,
  type Ref,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
// Types only: the Contract's schemas never load with the indicator (startup check).
import type { TimerId, TimerWithProject } from "../contracts/index.ts";
import { useRunningTimers } from "../port.ts";
import { startTimerAndTell, stopTimerAndTell } from "../timer-actions.tsx";
import { FORM_IN_PLACE, timerPanel } from "../timer-panel-form.ts";

// The mark draws a project's icon from the directory of entry pictures. It loads only once a
// running timer has a project, so an idle indicator or one without a project never fetches it.
const ProjectEntryMark = lazy(() =>
  import("../project-mark.tsx").then(({ ProjectEntryMark }) => ({ default: ProjectEntryMark })),
);

const MARK_LENGTH = iconLength("sm");
/** Holds the mark's place while its code arrives, so nothing moves when it does. */
const MARK_PLACE: CSSProperties = { flex: "none", height: MARK_LENGTH, width: MARK_LENGTH };

// Tabular numbers keep each digit as wide as the next, so the time does not jitter as it ticks.
// It never shrinks: the title beside it shortens first.
const TIME_STYLE: CSSProperties = {
  flex: "none",
  fontVariantNumeric: "var(--se-tabular-nums)",
  whiteSpace: "nowrap",
};

const ICON_STYLE: CSSProperties = { display: "flex" };

/**
 * A click handler that acts on the first click of a series only. Stop, start and the opener of
 * the panel swap places as soon as the running timers change, so the second click of a double
 * click lands on another one: it would start a fresh timer after a stop, or stop the one just
 * started, or open its panel. The browser
 * counts the clicks of a series in `detail` (2 for the second); a single click is 1, and a press
 * of Enter or Space is 0, so both act at once and nothing waits.
 */
const firstClickOnly = (act: () => void) => (event: MouseEvent) => {
  if (event.detail <= 1) act();
};

/**
 * A held Enter repeats: once the focus has followed a start or a stop to the other control, the
 * repeats would start and stop in turn. Only the first press acts.
 */
const firstPressOnly = (event: KeyboardEvent) => {
  if (event.repeat) event.preventDefault();
};

// The part that opens the panel holds what the timer shows; its title shortens inside it.
const OPENER_STYLE: CSSProperties = {
  alignItems: "center",
  borderRadius: "var(--mantine-radius-sm)",
  display: "flex",
  gap: 6,
  minWidth: 0,
};

/**
 * The running time, "now" minus the start, read again at every full second (D348). The only part
 * that redraws on a tick. A plain text and no live region: a screen reader reads it when asked and
 * is not told every second. A page clock behind the start, after the computer's clock jumped
 * back, shows `0:00:00` rather than a negative time.
 */
function RunningTime({ startedAt }: { readonly startedAt: Instant }) {
  const { i18n } = useLingui();
  const now = useNow("second");
  return (
    <Text component="span" fw={500} role="timer" size="sm" style={TIME_STYLE}>
      {formatRunningTime(startedAt, now, i18n.locale)}
    </Text>
  );
}

/** The project's mark and title, the part that shortens when room is short; nothing without one. */
function TimerProject({ project }: { readonly project: TimerWithProject["project"] }) {
  if (project === null) return null;
  return (
    <Group gap={6} miw={0} wrap="nowrap">
      <Suspense fallback={<Box style={MARK_PLACE} />}>
        <ProjectEntryMark project={project} />
      </Suspense>
      <Text component="span" size="sm" truncate>
        {project.title}
      </Text>
    </Group>
  );
}

/** How many timers run, when more than one does, as after a sync (D310). */
function TimerCount({ count }: { readonly count: number }) {
  const { t } = useLingui();
  if (count < 2) return null;
  return (
    <Badge
      aria-label={t`${count} timers running`}
      circle
      flex="none"
      role="img"
      size="sm"
      variant="light"
    >
      {count}
    </Badge>
  );
}

interface RunningProps {
  readonly form: IndicatorForm;
  readonly timer: TimerWithProject;
  readonly count: number;
  readonly stopping: boolean;
  readonly onStop: (id: TimerId) => void;
  readonly togglePanel: () => void;
  readonly panelOpen: boolean;
  /** The control that starts or stops, for the focus after the two have swapped. */
  readonly action: Ref<HTMLButtonElement>;
}

/**
 * The running timer: in the full form with its project, in the short form without. What it shows
 * opens the Indicator Panel, which edits this timer; the stop button beside it stops with one
 * click (D314, D358). The opener is named by what it shows, after "Edit timer", which only a
 * screen reader reads.
 */
function RunningTimer({
  form,
  timer,
  count,
  stopping,
  onStop,
  togglePanel,
  panelOpen,
  action,
}: RunningProps) {
  const { t } = useLingui();
  return (
    <Group gap={6} miw={0} wrap="nowrap">
      <UnstyledButton
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        onClick={firstClickOnly(togglePanel)}
        style={OPENER_STYLE}
      >
        <VisuallyHidden>{t`Edit timer`}</VisuallyHidden>
        {form === "full" && <TimerProject project={timer.project} />}
        <RunningTime startedAt={timer.startedAt} />
        <TimerCount count={count} />
      </UnstyledButton>
      <ActionIcon
        aria-label={t`Stop timer`}
        disabled={stopping}
        flex="none"
        onClick={firstClickOnly(() => onStop(timer.id))}
        onKeyDown={firstPressOnly}
        ref={action}
        size={24}
        variant="subtle"
      >
        <StopTimerIcon size="sm" />
      </ActionIcon>
    </Group>
  );
}

/** The offer to start a timer without a project: with its label in the full form, an icon in the short one. */
function StartTimer({
  form,
  starting,
  onStart,
  action,
}: {
  readonly form: IndicatorForm;
  readonly starting: boolean;
  readonly onStart: () => void;
  readonly action: Ref<HTMLButtonElement>;
}) {
  const { t } = useLingui();
  if (form === "short") {
    return (
      <ActionIcon
        aria-label={t`Start timer`}
        disabled={starting}
        onClick={firstClickOnly(onStart)}
        onKeyDown={firstPressOnly}
        ref={action}
        size={24}
        variant="subtle"
      >
        <StartTimerIcon size="sm" />
      </ActionIcon>
    );
  }
  return (
    <Button
      disabled={starting}
      leftSection={<StartTimerIcon size="sm" />}
      onClick={firstClickOnly(onStart)}
      onKeyDown={firstPressOnly}
      ref={action}
      size="compact-sm"
      variant="subtle"
    >
      {t`Start timer`}
    </Button>
  );
}

/** Until the first answer, the module's icon the Shell showed before, so nothing moves. */
function TimerWaiting({ retry }: { readonly retry?: (() => void) | undefined }) {
  const { t } = useLingui();
  if (retry === undefined) {
    return (
      <Box aria-label={t`Time`} role="img" style={ICON_STYLE}>
        <TimeIcon size="md" />
      </Box>
    );
  }
  return (
    <ActionIcon
      aria-label={t`The timer could not be loaded. Try again.`}
      onClick={retry}
      size={24}
      variant="subtle"
    >
      <TimeIcon size="md" />
    </ActionIcon>
  );
}

/**
 * The timer's Module Indicator (D314, D357, D358): the running timer with its time and one click
 * to stop it, what opens its Indicator Panel, or the offer to start one. With several running it shows the most recently started
 * and their count. It reads the running timers through the module's Query, which follows every
 * Operation through the Table Change; nothing reads or writes per second, and with no timer
 * running nothing ticks.
 */
export default function TimerIndicator({
  form,
  togglePanel,
  panelOpen,
}: ModuleIndicatorWithPanelProps) {
  const running = useRunningTimers();
  const data = useDataAccess();
  // The Shell's opener of this panel while it is closed, for "Edit timer" from a Notice; while it
  // is open, none, so that a request never closes it.
  useEffect(
    () => timerPanel.register(panelOpen ? undefined : togglePanel),
    [panelOpen, togglePanel],
  );
  // The timer a stop was sent for, and whether a start was, so a double click sends one call. A
  // stop that left the timer running, or a start that failed, frees the button again.
  const [stopping, setStopping] = useState<TimerId | null>(null);
  const [starting, setStarting] = useState(false);
  // Start and stop take each other's place, and a pressed one is disabled until its answer. When
  // it held the focus, as from the keyboard, the focus follows to the control that starts or
  // stops once the shown timer has changed, instead of being lost with the pressed one; not when
  // it has moved on to something else in the meantime.
  const action = useRef<HTMLButtonElement>(null);
  const follow = useRef(false);
  // The timer shown, none while idle, unknown until the first answer.
  const shown =
    running.status === "loading" || running.status === "loadFailed"
      ? undefined
      : (running.data.at(0)?.id ?? null);
  useLayoutEffect(() => {
    if (!follow.current || shown === undefined) return;
    follow.current = false;
    const focused = document.activeElement;
    if (focused === null || focused === document.body) action.current?.focus();
  }, [shown]);

  if (running.status === "loading") return <TimerWaiting />;
  if (running.status === "loadFailed") return <TimerWaiting retry={running.retry} />;
  const timers = running.data;
  const [latest] = timers;
  // Once the stopped timer has left the list, a later one of the same id may be stopped again,
  // such as after "Undo"; once a timer runs, the next idle offer starts afresh.
  if (stopping !== null && !timers.some(({ id }) => id === stopping)) setStopping(null);
  if (starting && latest !== undefined) setStarting(false);

  const stop = (id: TimerId) => {
    follow.current = document.activeElement === action.current;
    setStopping(id);
    void stopTimerAndTell(data, id, FORM_IN_PLACE).then((result) => {
      if (result.status === "success" && result.data.kind !== "clockBeforeStart") return;
      follow.current = false;
      setStopping(null);
    });
  };
  const start = () => {
    follow.current = document.activeElement === action.current;
    setStarting(true);
    void startTimerAndTell(data, {}, FORM_IN_PLACE).then((result) => {
      if (result.status === "success") return;
      follow.current = false;
      setStarting(false);
    });
  };

  if (latest === undefined) {
    return <StartTimer action={action} form={form} onStart={start} starting={starting} />;
  }
  return (
    <RunningTimer
      action={action}
      count={timers.length}
      form={form}
      onStop={stop}
      panelOpen={panelOpen}
      stopping={stopping === latest.id}
      timer={latest}
      togglePanel={togglePanel}
    />
  );
}
