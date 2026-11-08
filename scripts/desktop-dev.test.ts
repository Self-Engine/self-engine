import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  electronArgs,
  electronEnv,
  isBundle,
  killGroup,
  stopGroup,
  waitUntil,
} from "./desktop-dev.ts";

describe("isBundle", () => {
  it.each([
    ["main.cjs", true],
    ["preload.cjs", true],
    ["main.cjs.map", false],
    [null, false],
  ])("%s -> %s", (name, expected) => {
    expect(isBundle(name)).toBe(expected);
  });
});

describe("electronEnv", () => {
  it("sets the dev server and clears ELECTRON_RUN_AS_NODE", () => {
    const env = electronEnv({ ELECTRON_RUN_AS_NODE: "1", PATH: "/bin" }, "http://x/");
    expect(env).toEqual({ PATH: "/bin", VITE_DEV_SERVER_URL: "http://x/" });
  });
});

describe("electronArgs", () => {
  it("adds the debugging port only when set", () => {
    expect(electronArgs({})).toEqual(["."]);
    expect(electronArgs({ SELF_ENGINE_REMOTE_DEBUGGING_PORT: "9222" })).toEqual([
      "--remote-debugging-port=9222",
      ".",
    ]);
  });
});

describe("killGroup", () => {
  it("signals the group, not the single process", () => {
    const kill = vi.fn();
    killGroup(42, "SIGTERM", kill);
    expect(kill).toHaveBeenCalledWith(-42, "SIGTERM");
  });

  it("accepts a group that is already gone", () => {
    const gone = Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
    expect(() =>
      killGroup(42, "SIGTERM", () => {
        throw gone;
      }),
    ).not.toThrow();
  });

  it("rethrows any other failure", () => {
    const denied = Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    expect(() =>
      killGroup(42, "SIGTERM", () => {
        throw denied;
      }),
    ).toThrow(denied);
  });
});

describe("stopGroup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function child(fields: Partial<ChildProcess>): ChildProcess {
    return Object.assign(new EventEmitter(), {
      pid: 7,
      exitCode: null,
      signalCode: null,
      ...fields,
    }) as ChildProcess;
  }

  it("resolves on exit without escalating", async () => {
    const kill = vi.fn();
    const proc = child({});
    const stopped = stopGroup(proc, kill, 100);
    proc.emit("exit", 0, null);
    await stopped;
    await vi.advanceTimersByTimeAsync(200);
    expect(kill.mock.calls).toEqual([[-7, "SIGTERM"]]);
  });

  it("escalates to SIGKILL after the grace", async () => {
    const kill = vi.fn();
    const proc = child({});
    const stopped = stopGroup(proc, kill, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(kill.mock.calls).toEqual([
      [-7, "SIGTERM"],
      [-7, "SIGKILL"],
    ]);
    proc.emit("exit", null, "SIGKILL");
    await stopped;
  });

  it("does nothing for a child that has already exited", async () => {
    const kill = vi.fn();
    await stopGroup(child({ exitCode: 0 }), kill, 100);
    expect(kill).not.toHaveBeenCalled();
  });
});

describe("waitUntil", () => {
  function clock() {
    let time = 0;
    return {
      now: () => time,
      sleep: async (ms: number) => {
        time += ms;
      },
    };
  }

  it("returns once ready", async () => {
    let calls = 0;
    await waitUntil(async () => ++calls === 3, 1_000, 10, clock());
    expect(calls).toBe(3);
  });

  it("throws at the deadline", async () => {
    await expect(waitUntil(async () => false, 50, 10, clock())).rejects.toThrow(
      "not ready after 50 ms",
    );
  });
});
