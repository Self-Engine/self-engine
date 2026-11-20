// @vitest-environment happy-dom

import { act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { instantFrom } from "../supported-years.ts";
import { alwaysVisible, fixedClock, requireInstant } from "../testing.ts";
import { resolveTimeZone, type TimeZone } from "../zone.ts";
import { ClockReadout } from "./example/clock-readout.tsx";
import { PageClockProvider, type PageVisibility, useNow, useToday } from "./index.tsx";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;
const BERLIN = zone("Europe/Berlin");

/** The test runner's fake time as a Clock: the test moves it with the timers or jumps it. */
const fakeTimeClock = () => instantFrom(Temporal.Instant.fromEpochMilliseconds(Date.now()));

/** A window whose visibility the test sets. */
function testWindow() {
  let visible = true;
  const listeners = new Set<() => void>();
  const visibility: PageVisibility = {
    visible: () => visible,
    onChange: (listener) => {
      const entry = () => listener();
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
  };
  return {
    visibility,
    listeners: () => listeners.size,
    becomes: (state: "visible" | "hidden") => {
      visible = state === "visible";
      for (const listener of listeners) listener();
    },
  };
}

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

function render(children: ReactNode, visibility: PageVisibility = alwaysVisible) {
  act(() =>
    root.render(
      <StrictMode>
        <PageClockProvider clock={fakeTimeClock} visibility={visibility}>
          {children}
        </PageClockProvider>
      </StrictMode>,
    ),
  );
}

/** Moves the fake time on and runs the timeouts due on the way. */
const advance = (milliseconds: number) =>
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });

/** A reading of "now" that counts its renders. */
function counted(step: "second" | "minute") {
  const counter = { renders: 0 };
  function Now() {
    counter.renders += 1;
    return <p data-step={step}>{useNow(step)}</p>;
  }
  return { counter, element: <Now /> };
}

const textOf = (selector: string) => container.querySelector(selector)?.textContent;

test("a component reads now and today from the Clock it is handed, the same every time", () => {
  const clock = fixedClock(requireInstant("2026-11-20T22:30:15.000Z"));
  for (let run = 0; run < 2; run += 1) {
    act(() =>
      root.render(
        <PageClockProvider clock={clock} visibility={alwaysVisible}>
          <ClockReadout timeZone={zone("Asia/Bangkok")} />
        </PageClockProvider>,
      ),
    );
    // 05:30 on the 21st in Bangkok (+07:00).
    expect(container.textContent).toBe("Now 2026-11-20T22:30:15.000Z, today 2026-11-21");
  }
});

test("a hook without a Clock handed in fails loudly", () => {
  function Orphan() {
    return <p>{useNow("second")}</p>;
  }
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => act(() => root.render(<Orphan />))).toThrow(/PageClockProvider/);
  error.mockRestore();
});

test("one timeout serves every listener, and none runs without a listener", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.500Z") });
  const second = counted("second");
  const minute = counted("minute");
  function Today() {
    return <p>{useToday(BERLIN)}</p>;
  }
  render(
    <>
      {second.element}
      {counted("second").element}
      {minute.element}
      <Today />
    </>,
  );
  expect(vi.getTimerCount()).toBe(1);
  advance(1000);
  expect(textOf('[data-step="second"]')).toBe("2026-11-20T10:00:01.000Z");
  expect(vi.getTimerCount()).toBe(1);

  render(null);
  expect(vi.getTimerCount()).toBe(0);
});

test("a listener with a step of a minute is not redrawn on every second", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.500Z") });
  const second = counted("second");
  const minute = counted("minute");
  render(
    <>
      {second.element}
      {minute.element}
    </>,
  );
  const [secondStart, minuteStart] = [second.counter.renders, minute.counter.renders];

  // One `act` per second, so React draws each tick instead of batching them.
  for (let elapsed = 0; elapsed < 59; elapsed += 1) advance(1000);
  // StrictMode draws each render twice.
  expect(second.counter.renders - secondStart).toBe(59 * 2);
  expect(minute.counter.renders - minuteStart).toBe(0);
  expect(textOf('[data-step="minute"]')).toBe("2026-11-20T10:00:00.500Z");

  advance(1000);
  expect(minute.counter.renders - minuteStart).toBe(2);
  expect(textOf('[data-step="minute"]')).toBe("2026-11-20T10:01:00.000Z");
});

test("a minute alone wakes once a minute", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.500Z") });
  const minute = counted("minute");
  render(minute.element);
  const start = minute.counter.renders;
  const wakes = vi.spyOn(globalThis, "setTimeout");
  advance(59_000);
  expect(vi.getTimerCount()).toBe(1);
  expect(minute.counter.renders).toBe(start);
  advance(1_000);
  // The one wake at the full minute set the timeout for the next.
  expect(wakes).toHaveBeenCalledTimes(1);
  expect(textOf('[data-step="minute"]')).toBe("2026-11-20T10:01:00.000Z");
});

test("after the Clock jumped far ahead between two ticks, the next tick delivers its time", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.000Z") });
  render(counted("second").element);
  // Hours of sleep: the timers did not run, the time moved.
  vi.setSystemTime(Date.parse("2026-11-20T17:42:10.250Z"));
  advance(1000);
  expect(textOf('[data-step="second"]')).toBe("2026-11-20T17:42:11.250Z");
});

test("a hidden window runs no timeout and catches up with one tick when it shows again", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.000Z") });
  const window = testWindow();
  const second = counted("second");
  render(second.element, window.visibility);
  expect(vi.getTimerCount()).toBe(1);

  act(() => window.becomes("hidden"));
  expect(vi.getTimerCount()).toBe(0);
  const hiddenRenders = second.counter.renders;
  advance(3_600_000);
  expect(second.counter.renders).toBe(hiddenRenders);
  expect(textOf('[data-step="second"]')).toBe("2026-11-20T10:00:00.000Z");

  act(() => window.becomes("visible"));
  expect(textOf('[data-step="second"]')).toBe("2026-11-20T11:00:00.000Z");
  expect(vi.getTimerCount()).toBe(1);

  render(null, window.visibility);
  expect(window.listeners()).toBe(0);
});

test("a window that shows no listener sets no timeout", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.000Z") });
  const window = testWindow();
  render(<p>quiet</p>, window.visibility);
  act(() => window.becomes("hidden"));
  act(() => window.becomes("visible"));
  expect(vi.getTimerCount()).toBe(0);
  expect(window.listeners()).toBe(0);
});

test("today changes exactly at the start of the next day, across a clock change, by one timeout", () => {
  // Berlin springs forward on 2026-03-29, so that day ends at 22:00 UTC, at +02:00.
  vi.useFakeTimers({ now: Date.parse("2026-03-28T22:59:59.999Z") });
  const counter = { renders: 0 };
  function Today() {
    counter.renders += 1;
    return <p>{useToday(BERLIN)}</p>;
  }
  render(<Today />);
  expect(container.textContent).toBe("2026-03-28");
  expect(vi.getTimerCount()).toBe(1);

  advance(1);
  expect(container.textContent).toBe("2026-03-29");
  const drawn = counter.renders;

  // 23 hours less a millisecond later it is still the 29th, with no redraw on the way.
  advance(23 * 3_600_000 - 1);
  expect(container.textContent).toBe("2026-03-29");
  expect(counter.renders).toBe(drawn);
  expect(vi.getTimerCount()).toBe(1);

  advance(1);
  expect(container.textContent).toBe("2026-03-30");
});

test("today follows a change of the Time Zone handed in", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T20:00:00.000Z") });
  function Today({ timeZone }: { readonly timeZone: TimeZone }) {
    return <p>{useToday(timeZone)}</p>;
  }
  render(<Today timeZone={BERLIN} />);
  expect(container.textContent).toBe("2026-11-20");
  render(<Today timeZone={zone("Asia/Tokyo")} />);
  expect(container.textContent).toBe("2026-11-21");
  expect(vi.getTimerCount()).toBe(1);
  // 15:00 UTC is the start of the 22nd in Tokyo (+09:00), while Berlin is still on the 21st.
  advance(19 * 3_600_000 - 1);
  expect(container.textContent).toBe("2026-11-21");
  advance(1);
  expect(container.textContent).toBe("2026-11-22");
});

test("today shows the new day at most a minute after the computer slept over midnight", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.000Z") });
  function Today() {
    return <p>{useToday(BERLIN)}</p>;
  }
  render(<Today />);
  expect(container.textContent).toBe("2026-11-20");
  // The computer sleeps: the time moves past midnight in Berlin, the timeout counts nothing.
  vi.setSystemTime(Date.parse("2026-11-21T07:00:00.000Z"));
  advance(59_999);
  expect(container.textContent).toBe("2026-11-20");
  advance(1);
  expect(container.textContent).toBe("2026-11-21");
});

test("a tick the one-minute cap brings, with nothing due, redraws no listener", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-20T10:00:00.000Z") });
  const counter = { renders: 0 };
  function Today() {
    counter.renders += 1;
    return <p>{useToday(BERLIN)}</p>;
  }
  render(<Today />);
  const drawn = counter.renders;
  const wakes = vi.spyOn(globalThis, "setTimeout");
  for (let minute = 0; minute < 10; minute += 1) advance(60_000);
  // Ten capped ticks, each setting the next timeout, and not one redraw.
  expect(wakes).toHaveBeenCalledTimes(10);
  expect(counter.renders).toBe(drawn);
  expect(vi.getTimerCount()).toBe(1);
});
