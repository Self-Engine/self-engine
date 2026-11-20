import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import type { Clock } from "../clock.ts";
import type { Instant } from "../instant.ts";
import type { TickStep } from "../next-tick.ts";
import type { CalendarDay } from "../values.ts";
import type { TimeZone } from "../zone.ts";
import { createTicker, type PageVisibility, type Ticker } from "./ticker.ts";

export interface PageClockProviderProps {
  /** The page's one Clock: the app hands in the system clock, a story or a test a fixed one. */
  readonly clock: Clock;
  readonly visibility: PageVisibility;
  readonly children: ReactNode;
}

const PageClock = createContext<Ticker | null>(null);

/**
 * Hands the page its Clock (ADR 0027). Mounted once, beside the other providers; every View below
 * reads "now" and "today" through `useNow` and `useToday`, never through the Clock itself.
 */
export function PageClockProvider({ clock, visibility, children }: PageClockProviderProps) {
  const ticker = useMemo(() => createTicker(clock, visibility), [clock, visibility]);
  return <PageClock value={ticker}>{children}</PageClock>;
}

function useTicker(): Ticker {
  const ticker = useContext(PageClock);
  // No fallback to the system clock: a View without a Clock handed in fails at its first render.
  if (ticker === null) throw new Error("useNow and useToday require a PageClockProvider");
  return ticker;
}

/**
 * The Clock's Instant, read again at every full second or minute. A step of a minute redraws once
 * a minute, also while another reading ticks each second.
 */
export function useNow(step: TickStep): Instant {
  const { read, subscribe } = useTicker().now(step);
  return useSyncExternalStore(subscribe, read);
}

/** The Calendar Day it is in `timeZone`, changing at the start of the next day there. */
export function useToday(timeZone: TimeZone): CalendarDay {
  const { read, subscribe } = useTicker().today(timeZone);
  return useSyncExternalStore(subscribe, read);
}
