import { describe, expect, it, vi } from "vite-plus/test";
import { acquireSingleInstanceLock } from "./single-instance.ts";

function instance(granted: boolean) {
  return {
    requestSingleInstanceLock: vi.fn(() => granted),
    quit: vi.fn(),
    on: vi.fn<(_event: "second-instance", listener: () => void) => void>(),
  };
}

describe("acquireSingleInstanceLock", () => {
  it("quits and refuses startup when another instance holds the lock", () => {
    const app = instance(false);
    const getWindow = vi.fn();

    expect(acquireSingleInstanceLock(app, false, getWindow)).toBe(false);
    expect(app.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(app.quit).toHaveBeenCalledOnce();
    expect(app.on).not.toHaveBeenCalled();
    expect(getWindow).not.toHaveBeenCalled();
  });

  it.each([
    { minimized: true, expected: ["restore", "show", "focus"] },
    { minimized: false, expected: ["show", "focus"] },
  ])(
    "shows and focuses the existing window with minimized=$minimized",
    ({ minimized, expected }) => {
      const app = instance(true);
      const actions: string[] = [];
      const window = {
        isMinimized: () => minimized,
        restore: () => actions.push("restore"),
        show: () => actions.push("show"),
        focus: () => actions.push("focus"),
      };
      const getWindow = vi.fn(() => window);

      expect(acquireSingleInstanceLock(app, false, getWindow)).toBe(true);
      expect(app.quit).not.toHaveBeenCalled();
      expect(getWindow).not.toHaveBeenCalled();
      expect(app.on).toHaveBeenCalledExactlyOnceWith("second-instance", expect.any(Function));
      app.on.mock.calls[0]?.[1]();
      expect(actions).toEqual(expected);
    },
  );

  it("can receive a second launch before there is a window", () => {
    const app = instance(true);
    const getWindow = vi.fn(() => undefined);

    acquireSingleInstanceLock(app, false, getWindow);
    app.on.mock.calls[0]?.[1]();
    expect(getWindow).toHaveBeenCalledOnce();
  });

  it("takes the lock for a hidden run without registering a window activation listener", () => {
    const app = instance(true);
    const getWindow = vi.fn();

    expect(acquireSingleInstanceLock(app, true, getWindow)).toBe(true);
    expect(app.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(app.on).not.toHaveBeenCalled();
    expect(getWindow).not.toHaveBeenCalled();
  });
});
