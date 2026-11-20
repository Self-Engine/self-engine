// The page clock's one ticker (D348): every reading of "now" and "today" on the page shares a
// single timeout, set to the earliest moment one of them has something new to show. It runs only
// while someone listens and the window is visible. A reading always takes the Clock's time and
// never counts ticks. A timeout may not count the time the computer slept, so it waits at most a
// minute: after a sleep or a jump of the clock a reading is right at the next tick, at most a
// minute after waking.

import { epochMsOf } from "../borders.ts";
import type { Clock } from "../clock.ts";
import type { Instant } from "../instant.ts";
import { nextTick, startOfNextDay, type TickStep } from "../next-tick.ts";
import type { CalendarDay } from "../values.ts";
import type { TimeZone } from "../zone.ts";
import { calendarDayOf } from "../zoned-day.ts";

/**
 * Whether the window is visible, and word when that changes. The app supplies the one source of
 * its page, so the page watches its visibility once.
 */
export interface PageVisibility {
  readonly visible: () => boolean;
  /** Calls `listener` each time the window shows or hides. Returns the function that stops it. */
  readonly onChange: (listener: () => void) => () => void;
}

/** A reading in the shape of `useSyncExternalStore`: both functions keep their identity. */
export interface Reading<T> {
  readonly read: () => T;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface Ticker {
  readonly now: (step: TickStep) => Reading<Instant>;
  readonly today: (timeZone: TimeZone) => Reading<CalendarDay>;
}

interface Channel {
  /** What the channel shows at a moment, and when it next shows something new. */
  readonly valueAt: (now: Instant) => unknown;
  readonly nextAfter: (now: Instant) => Instant;
  value: unknown;
  /** The epoch milliseconds the value was taken at, and when it is due again. */
  takenMs: number;
  dueMs: number;
  readonly listeners: Set<() => void>;
  readonly reading: Reading<unknown>;
}

/** Due once its next moment came, or when the clock went back behind the value. */
const isDue = (channel: Channel, nowMs: number) =>
  nowMs >= channel.dueMs || nowMs < channel.takenMs;

function take(channel: Channel, now: Instant, nowMs: number) {
  channel.value = channel.valueAt(now);
  channel.takenMs = nowMs;
  channel.dueMs = epochMsOf(channel.nextAfter(now));
}

/**
 * The longest a timeout waits. A timer may not count the time the computer slept, so a timeout
 * set for midnight could fire hours late; a capped tick that finds nothing due redraws nothing and
 * sets the next timeout. The cost: one timeout a minute, while something listens and the window
 * is visible, each reading the Clock once and comparing a number per heard channel.
 */
const LONGEST_WAIT_MS = 60_000;

export function createTicker(clock: Clock, visibility: PageVisibility): Ticker {
  const channels = new Map<string, Channel>();
  let listening = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopWatchingVisibility: (() => void) | undefined;

  const heard = () => [...channels.values()].filter((channel) => channel.listeners.size > 0);

  function schedule(nowMs: number) {
    clearTimeout(timeout);
    timeout = undefined;
    if (listening === 0 || !visibility.visible()) return;
    const dueMs = Math.min(...heard().map((channel) => channel.dueMs));
    timeout = setTimeout(tick, Math.min(LONGEST_WAIT_MS, Math.max(0, dueMs - nowMs)));
  }

  /** Reads the Clock once, takes every heard channel that is due, then tells their listeners. */
  function tick() {
    const now = clock();
    const nowMs = epochMsOf(now);
    const changed = heard().filter((channel) => isDue(channel, nowMs));
    for (const channel of changed) take(channel, now, nowMs);
    schedule(nowMs);
    for (const channel of changed) for (const listener of channel.listeners) listener();
  }

  function onVisibility() {
    if (visibility.visible()) tick();
    else schedule(0);
  }

  function channel<T>(
    key: string,
    valueAt: (now: Instant) => T,
    nextAfter: (now: Instant) => Instant,
  ) {
    const existing = channels.get(key);
    if (existing !== undefined) return existing.reading as Reading<T>;
    const now = clock();
    const created: Channel = {
      valueAt,
      nextAfter,
      value: undefined,
      takenMs: 0,
      dueMs: 0,
      listeners: new Set(),
      reading: {
        // A heard channel keeps its value until the timeout, so all its listeners agree; an
        // unheard one takes the Clock when it is due, so a first render is never stale.
        read: () => {
          if (created.listeners.size === 0) {
            const at = clock();
            const atMs = epochMsOf(at);
            if (isDue(created, atMs)) take(created, at, atMs);
          }
          return created.value;
        },
        subscribe: (listener) => {
          // A wrapper per call, so the same function subscribed twice stops one at a time.
          const entry = () => listener();
          created.listeners.add(entry);
          listening += 1;
          if (listening === 1) stopWatchingVisibility = visibility.onChange(onVisibility);
          // Catch up with the Clock and set the timeout for the earliest heard channel.
          tick();
          return () => {
            created.listeners.delete(entry);
            listening -= 1;
            if (listening === 0) {
              stopWatchingVisibility?.();
              stopWatchingVisibility = undefined;
            }
            schedule(epochMsOf(clock()));
          };
        },
      },
    };
    take(created, now, epochMsOf(now));
    channels.set(key, created);
    return created.reading as Reading<T>;
  }

  return {
    now: (step) =>
      channel(
        `now:${step}`,
        (now) => now,
        (now) => nextTick(now, step),
      ),
    today: (timeZone) =>
      channel(
        `today:${timeZone}`,
        (now) => calendarDayOf(now, timeZone),
        (now) => startOfNextDay(now, timeZone),
      ),
  };
}
