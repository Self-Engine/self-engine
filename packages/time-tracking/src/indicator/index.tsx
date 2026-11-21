import { useLingui } from "@lingui/react/macro";
import { ActionIcon, Badge, Box, Button, Group, Text } from "@mantine/core";
import { useDataAccess } from "@self-engine/data-client/react";
import { iconLength, TimeIcon } from "@self-engine/icons";
import { StartTimerIcon, StopTimerIcon } from "@self-engine/icons/indicator";
import type { IndicatorForm, ModuleIndicatorProps } from "@self-engine/shell";
// Types only from the main entry, whose schemas need Zod's full build; the running time comes
// from its light entry.
import type { Instant } from "@self-engine/time";
import { useNow } from "@self-engine/time/react";
import { formatRunningTime } from "@self-engine/time/running-time";
import { type CSSProperties, lazy, Suspense, useState } from "react";
// Types only: the Contract's schemas never load with the indicator (startup check).
import type { TimerId, TimerWithProject } from "../contracts/index.ts";
import { useRunningTimers } from "../port.ts";
import { startTimerAndTell, stopTimerAndTell } from "../timer-actions.tsx";

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
 * The running time, "now" minus the start, read again at every full second (D348). The only part
 * that redraws on a tick. A plain text and no live region: a screen reader reads it when asked and
 * is not told every second. A page clock behind the start, after the computer's clock jumped
 * back, shows no time rather than a negative one.
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
}

/** The running timer: in the full form with its project, in the short form without. */
function RunningTimer({ form, timer, count, stopping, onStop }: RunningProps) {
  const { t } = useLingui();
  return (
    <Group gap={6} miw={0} wrap="nowrap">
      {form === "full" && <TimerProject project={timer.project} />}
      <RunningTime startedAt={timer.startedAt} />
      <TimerCount count={count} />
      <ActionIcon
        aria-label={t`Stop timer`}
        disabled={stopping}
        flex="none"
        onClick={() => onStop(timer.id)}
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
}: {
  readonly form: IndicatorForm;
  readonly starting: boolean;
  readonly onStart: () => void;
}) {
  const { t } = useLingui();
  if (form === "short") {
    return (
      <ActionIcon
        aria-label={t`Start timer`}
        disabled={starting}
        onClick={onStart}
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
      onClick={onStart}
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
 * The timer's Module Indicator (D314, D357): the running timer with its time and one click to
 * stop it, or the offer to start one. With several running it shows the most recently started
 * and their count. It reads the running timers through the module's Query, which follows every
 * Operation through the Table Change; nothing reads or writes per second, and with no timer
 * running nothing ticks.
 */
export default function TimerIndicator({ form }: ModuleIndicatorProps) {
  const running = useRunningTimers();
  const data = useDataAccess();
  // The timer a stop was sent for, and whether a start was, so a double click sends one call. A
  // stop that left the timer running, or a start that failed, frees the button again.
  const [stopping, setStopping] = useState<TimerId | null>(null);
  const [starting, setStarting] = useState(false);

  if (running.status === "loading") return <TimerWaiting />;
  if (running.status === "loadFailed") return <TimerWaiting retry={running.retry} />;
  const timers = running.data;
  const [latest] = timers;
  // Once the stopped timer has left the list, a later one of the same id may be stopped again,
  // such as after "Undo"; once a timer runs, the next idle offer starts afresh.
  if (stopping !== null && !timers.some(({ id }) => id === stopping)) setStopping(null);
  if (starting && latest !== undefined) setStarting(false);

  const stop = (id: TimerId) => {
    setStopping(id);
    void stopTimerAndTell(data, id).then((result) => {
      if (result.status !== "success" || result.data.kind === "clockBeforeStart") setStopping(null);
    });
  };
  const start = () => {
    setStarting(true);
    void startTimerAndTell(data).then((result) => {
      if (result.status !== "success") setStarting(false);
    });
  };

  if (latest === undefined) return <StartTimer form={form} onStart={start} starting={starting} />;
  return (
    <RunningTimer
      count={timers.length}
      form={form}
      onStop={stop}
      stopping={stopping === latest.id}
      timer={latest}
    />
  );
}
