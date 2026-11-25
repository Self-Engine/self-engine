import { describe, expect, it, vi } from "vite-plus/test";
import { acquireSingleInstanceLock } from "./single-instance.ts";

function instance(granted: boolean) {
  return {
    requestSingleInstanceLock: vi.fn(() => granted),
    quit: vi.fn(),
    on: vi.fn<(_event: "second-instance", listener: () => void) => void>(),
  };
}

function windowRecording(actions: string[], minimized: boolean) {
  return {
    isMinimized: () => minimized,
    restore: () => actions.push("restore"),
    show: () => actions.push("show"),
    focus: () => actions.push("focus"),
  };
}

describe("acquireSingleInstanceLock", () => {
  it("quits and refuses startup when another instance holds the lock", () => {
    const app = instance(false);
    const shownWindow = vi.fn();

    expect(acquireSingleInstanceLock(app, shownWindow)).toBe(false);
    expect(app.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(app.quit).toHaveBeenCalledOnce();
    expect(app.on).not.toHaveBeenCalled();
    expect(shownWindow).not.toHaveBeenCalled();
  });

  it.each([
    { minimized: true, expected: ["restore", "show", "focus"] },
    { minimized: false, expected: ["show", "focus"] },
  ])(
    "brings the shown window to the front on a second start, minimized=$minimized",
    ({ minimized, expected }) => {
      const app = instance(true);
      const actions: string[] = [];
      const shownWindow = vi.fn(() => windowRecording(actions, minimized));

      expect(acquireSingleInstanceLock(app, shownWindow)).toBe(true);
      expect(app.quit).not.toHaveBeenCalled();
      expect(shownWindow).not.toHaveBeenCalled();
      expect(app.on).toHaveBeenCalledExactlyOnceWith("second-instance", expect.any(Function));
      app.on.mock.calls[0]?.[1]();
      expect(actions).toEqual(expected);
    },
  );

  it("asks for the shown window at each second start, not once", () => {
    const app = instance(true);
    const actions: string[] = [];
    // No window is shown during the start and in a hidden run; later there is one.
    const shownWindow = vi
      .fn<() => ReturnType<typeof windowRecording> | undefined>()
      .mockReturnValueOnce(undefined)
      .mockReturnValue(windowRecording(actions, false));

    acquireSingleInstanceLock(app, shownWindow);
    const secondStart = app.on.mock.calls[0]?.[1];
    secondStart?.();
    expect(actions).toEqual([]);
    secondStart?.();
    expect(actions).toEqual(["show", "focus"]);
  });
});
