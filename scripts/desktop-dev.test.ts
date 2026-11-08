import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createSupervisor,
  electronArgs,
  electronEnv,
  isBundle,
  type Kill,
  killGroup,
  stopGroup,
  waitUntil,
} from "./desktop-dev.ts";

function child(fields: Partial<ChildProcess>): ChildProcess {
  return Object.assign(new EventEmitter(), {
    pid: 7,
    exitCode: null,
    signalCode: null,
    ...fields,
  }) as ChildProcess;
}

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

function clock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
  };
}

describe("waitUntil", () => {
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

describe("createSupervisor", () => {
  const EXIT_DELAY_MS = 300;
  const DEBOUNCE_MS = 150;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A supervisor over the real `stopGroup`, with children that exit some time after SIGTERM. */
  function setup() {
    let nextPid = 100;
    const children = new Map<number, ChildProcess>();
    const alive = new Set<number>();
    const launched: number[] = [];
    const exit = vi.fn<(code: number) => void>();
    const report = vi.fn<(message: string) => void>();

    const spawned = (): ChildProcess => {
      const pid = nextPid++;
      const proc = child({ pid });
      children.set(pid, proc);
      alive.add(pid);
      return proc;
    };
    const exitChild = (pid: number): void => {
      if (!alive.delete(pid)) return;
      const proc = children.get(pid);
      if (proc === undefined) throw new Error(`no child ${pid}`);
      Object.assign(proc, { exitCode: 0 });
      proc.emit("exit", 0, null);
    };
    const kill: Kill = (groupId, signal) => {
      const pid = -groupId;
      if (signal === "SIGKILL") exitChild(pid);
      else setTimeout(() => exitChild(pid), EXIT_DELAY_MS);
    };
    const launchElectron = (): ChildProcess => {
      const proc = spawned();
      launched.push(proc.pid ?? -1);
      return proc;
    };
    const supervisor = createSupervisor({
      launchElectron,
      stop: (proc) => stopGroup(proc, kill, 1_500),
      exit,
      report,
      restartDebounceMs: DEBOUNCE_MS,
    });
    return { supervisor, spawned, alive, launched, exit, report, children, exitChild };
  }

  describe("restarts", () => {
    it("serializes overlapping restarts, so only the last Electron is alive and tracked", async () => {
      const { supervisor, alive, launched, exit } = setup();
      supervisor.launch();

      supervisor.scheduleRestart();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      // The first restart is now waiting for Electron 100 to exit, and a second one fires.
      supervisor.scheduleRestart();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      await vi.advanceTimersByTimeAsync(2 * EXIT_DELAY_MS + DEBOUNCE_MS);

      expect(launched).toEqual([100, 101, 102]);
      expect([...alive]).toEqual([102]);

      const stopped = supervisor.shutdown(0);
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);
      await stopped;
      expect([...alive]).toEqual([]);
      expect(exit.mock.calls).toEqual([[0]]);
    });

    it("does not launch when a shutdown arrives during a running restart", async () => {
      const { supervisor, alive, launched } = setup();
      supervisor.launch();
      supervisor.scheduleRestart();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + EXIT_DELAY_MS / 2);

      const stopped = supervisor.shutdown(0);
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);
      await stopped;

      expect(launched).toEqual([100]);
      expect([...alive]).toEqual([]);
    });

    it("does not launch for a restart still queued when a shutdown arrives", async () => {
      const { supervisor, alive, launched } = setup();
      supervisor.launch();
      supervisor.scheduleRestart();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      supervisor.scheduleRestart();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      const stopped = supervisor.shutdown(0);
      await vi.advanceTimersByTimeAsync(3 * EXIT_DELAY_MS);
      await stopped;

      expect(launched).toEqual([100]);
      expect([...alive]).toEqual([]);
    });

    it("drops a debounced restart when a shutdown arrives first", async () => {
      const { supervisor, launched } = setup();
      supervisor.launch();
      supervisor.scheduleRestart();
      const stopped = supervisor.shutdown(0);
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS + DEBOUNCE_MS);
      await stopped;
      expect(launched).toEqual([100]);
    });

    it("ends the run when the old Electron cannot be stopped during a restart", async () => {
      const report = vi.fn<(message: string) => void>();
      const exit = vi.fn<(code: number) => void>();
      const app = child({ pid: 100 });
      const supervisor = createSupervisor({
        launchElectron: () => app,
        stop: () => Promise.reject(new Error("kill EPERM")),
        exit,
        report,
        restartDebounceMs: DEBOUNCE_MS,
      });
      supervisor.launch();
      supervisor.scheduleRestart();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(report).toHaveBeenCalledWith("pnpm dev failed: kill EPERM");
      expect(exit.mock.calls).toEqual([[1]]);
    });
  });

  describe("failures", () => {
    it("stops every service and exits 1 when the start times out", async () => {
      const { supervisor, spawned, alive, exit, report } = setup();

      const running = supervisor.run(async () => {
        supervisor.addService(spawned());
        supervisor.addService(spawned());
        await waitUntil(async () => false, 50, 10, clock());
      });
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);
      await running;

      expect([...alive]).toEqual([]);
      expect(exit.mock.calls).toEqual([[1]]);
      expect(report).toHaveBeenCalledWith(
        "pnpm dev failed: dev server or bundles not ready after 50 ms",
      );
    });

    it("stops the services already started when a later start-up step throws", async () => {
      const { supervisor, spawned, alive, exit } = setup();

      const running = supervisor.run(async () => {
        supervisor.addService(spawned());
        throw new Error("spawn EAGAIN");
      });
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);
      await running;

      expect([...alive]).toEqual([]);
      expect(exit.mock.calls).toEqual([[1]]);
    });

    it("treats a service that cannot start as a failure of the run", async () => {
      const { supervisor, spawned, alive, exit, report } = setup();
      const failed = child({ pid: undefined });
      supervisor.addService(spawned());
      supervisor.addService(failed);

      failed.emit("error", new Error("spawn vp ENOENT"));
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);

      expect([...alive]).toEqual([]);
      expect(exit.mock.calls).toEqual([[1]]);
      expect(report).toHaveBeenCalledWith("pnpm dev failed: spawn vp ENOENT");
    });

    it("treats an Electron that cannot start as a failure of the run", async () => {
      const { supervisor, spawned, alive, children, exit, report } = setup();
      supervisor.addService(spawned());
      supervisor.launch();

      children.get(101)?.emit("error", new Error("spawn electron ENOENT"));
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);

      expect([...alive]).toEqual([]);
      expect(exit.mock.calls).toEqual([[1]]);
      expect(report).toHaveBeenCalledWith("pnpm dev failed: spawn electron ENOENT");
    });

    it("still stops the rest and exits non-zero when one child cannot be stopped", async () => {
      const report = vi.fn<(message: string) => void>();
      const exit = vi.fn<(code: number) => void>();
      const stubborn = child({ pid: 1 });
      const fine = child({ pid: 2 });
      const stop = vi.fn((proc: ChildProcess) =>
        proc === stubborn ? Promise.reject(new Error("kill EPERM")) : Promise.resolve(),
      );
      const supervisor = createSupervisor({
        launchElectron: () => child({}),
        stop,
        exit,
        report,
        restartDebounceMs: DEBOUNCE_MS,
      });
      supervisor.addService(stubborn);
      supervisor.addService(fine);

      await supervisor.shutdown(0);

      expect(stop).toHaveBeenCalledTimes(2);
      expect(report).toHaveBeenCalledWith("pnpm dev could not stop a process: kill EPERM");
      expect(exit.mock.calls).toEqual([[1]]);
    });
  });

  describe("shutdown", () => {
    it("ends the run with Electron's exit code when the window closes", async () => {
      const { supervisor, spawned, exitChild, exit } = setup();
      supervisor.addService(spawned());
      supervisor.launch();

      exitChild(101);
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);

      expect(exit.mock.calls).toEqual([[0]]);
    });

    it("stops once, closes the watcher and ignores a second request", async () => {
      const { supervisor, spawned, exit } = setup();
      const cleanup = vi.fn();
      supervisor.onShutdown(cleanup);
      supervisor.addService(spawned());

      const first = supervisor.shutdown(130);
      const second = supervisor.shutdown(143);
      await vi.advanceTimersByTimeAsync(EXIT_DELAY_MS);
      await Promise.all([first, second]);

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(exit.mock.calls).toEqual([[130]]);
      expect(supervisor.isStopping()).toBe(true);
    });
  });
});
