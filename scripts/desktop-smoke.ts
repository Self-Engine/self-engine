// The `smoke` stage of `pnpm verify` (spec #29, testing seam 3): starts the built desktop app with
// a throwaway data folder and checks what a broken start would break. The page loads, the
// data connection gets ready (the data process only answers when its `health` is ready), the
// first answer comes within FIRST_ANSWER_LIMIT_MS, the page shows the app, and after the data
// process is killed the page is ready again without a reload and still shows the app.
//
// The checks run against `SmokeApp`, so the packaged app (#146) runs the same ones through
// desktop-app.ts with another executable: `node scripts/desktop-smoke.ts --executable <path>`.
// Run alone, the default needs `vp run -r build` first; `pnpm verify` builds before this stage.

import { parseArgs } from "node:util";
import { CONNECTION_MARK } from "@self-engine/desktop-bridge";
import type { ElectronApplication } from "playwright";
import {
  builtDesktopApp,
  type DesktopLaunch,
  launchElectron,
  RENDERER_DIR,
  serveRenderer,
  withDesktopApp,
  waitForApp,
  DESKTOP_HIDDEN_ENV,
} from "./desktop-app.ts";
import { DESKTOP_DIR } from "./ensure-electron.ts";

/** Loose on purpose (spec #29): measured 253 ms, so only a regression by a multiple fails. */
export const FIRST_ANSWER_LIMIT_MS = 2000;

/**
 * One state of the page's data connection, as the page marks it (apps/web/src/desktop-data.ts,
 * `markConnectionStates`): `at` is milliseconds since the window's page started loading.
 */
export interface ConnectionMark {
  readonly status: string;
  readonly at: number;
}

/** The marks of one page document; `document` changes when the page reloads. */
export interface PageMarks {
  readonly document: number;
  readonly marks: readonly ConnectionMark[];
}

/** The running app, as the smoke test drives it. */
export interface SmokeApp {
  /** Waits until the app has a page, even when its native window stays hidden. */
  waitForPage(): Promise<void>;
  /**
   * Waits until the page shows the app: the Shell's main landmark, which a render error replaces
   * with an error page. Fails naming what the page shows instead.
   */
  waitForApp(): Promise<void>;
  /** Waits until the page's connection has settled `count` times, then reads its marks. */
  waitForSettled(count: number): Promise<PageMarks>;
  /** Kills the data process the way a crash would. */
  killDataProcess(): Promise<void>;
}

export interface SmokeResult {
  readonly firstAnswerMs: number;
}

const WAITING_STATES: ReadonlySet<string> = new Set(["connecting", "reconnecting"]);

/** Whether the connection has stopped waiting: ready, or one of its failure states. */
export function isSettled(mark: ConnectionMark): boolean {
  return !WAITING_STATES.has(mark.status);
}

export async function smokeTest(app: SmokeApp): Promise<SmokeResult> {
  await app.waitForPage();

  const start = await app.waitForSettled(1);
  const first = start.marks.find(isSettled);
  if (first?.status !== "ready") {
    throw new Error(`The data connection settled as "${first?.status}" instead of "ready".`);
  }
  if (first.at > FIRST_ANSWER_LIMIT_MS) {
    throw new Error(
      `The first answer from the data process came after ${Math.round(first.at)} ms; the limit is ${FIRST_ANSWER_LIMIT_MS} ms.`,
    );
  }
  await app.waitForApp();

  await app.killDataProcess();
  const after = await app.waitForSettled(2);
  if (after.document !== start.document) {
    throw new Error(
      "The page reloaded after the data process was killed; it must reconnect without a reload.",
    );
  }
  const later = after.marks.slice(start.marks.indexOf(first) + 1);
  if (!later.some((mark) => mark.status === "reconnecting")) {
    throw new Error("After the data process was killed, the data connection never reconnected.");
  }
  const again = later.find(isSettled);
  if (again?.status !== "ready") {
    throw new Error(
      `After the data process was killed, the data connection settled as "${again?.status}" instead of "ready".`,
    );
  }
  await app.waitForApp();
  return { firstAnswerMs: first.at };
}

/** `--executable <path>` tests that executable, a packaged app; without it, the built app. */
export function smokeOptions(args: readonly string[]): { executable: string | undefined } {
  const { values } = parseArgs({
    args: [...args],
    options: { executable: { type: "string" } },
    strict: true,
  });
  return { executable: values.executable };
}

const WAIT_TIMEOUT_MS = 30_000;

/**
 * Drives the app through Playwright. The waits are generous: a slow machine shows up as a
 * measured time, which the checks judge, not as a timeout.
 */
export function smokeDriver(app: ElectronApplication): SmokeApp {
  const page = app.firstWindow({ timeout: WAIT_TIMEOUT_MS });
  return {
    async waitForPage() {
      await page;
    },
    async waitForApp() {
      await waitForApp(await page);
    },
    async waitForSettled(count) {
      const target = await page;
      const waiting = [...WAITING_STATES];
      await target
        .waitForFunction(
          ({ name, waiting, count }) =>
            performance
              .getEntriesByName(name)
              .filter(
                (entry) => !waiting.includes(String("detail" in entry ? entry.detail : undefined)),
              ).length >= count,
          { name: CONNECTION_MARK, waiting, count },
          { timeout: WAIT_TIMEOUT_MS },
        )
        .catch((error: unknown) => {
          throw new Error(
            `The data connection did not settle ${count === 1 ? "once" : `${count} times`} within ${WAIT_TIMEOUT_MS} ms.`,
            { cause: error },
          );
        });
      return target.evaluate(
        (name) => ({
          document: performance.timeOrigin,
          marks: performance.getEntriesByName(name).map((entry) => ({
            status: String("detail" in entry ? entry.detail : undefined),
            at: entry.startTime,
          })),
        }),
        CONNECTION_MARK,
      );
    },
    async killDataProcess() {
      const pid = await app.evaluate(
        ({ app: electronApp }) =>
          electronApp
            .getAppMetrics()
            .find(
              (metric) =>
                metric.type === "Utility" && metric.name === `${electronApp.getName()} Data`,
            )?.pid,
      );
      if (pid === undefined) throw new Error("The app runs no data process to kill.");
      process.kill(pid, "SIGKILL");
    },
  };
}

/** Starts `launch` with a throwaway data folder and runs the checks on it. */
export function smokeTestApp(launch: DesktopLaunch): Promise<SmokeResult> {
  return withDesktopApp(launch, (app) => smokeTest(smokeDriver(app)), launchElectron);
}

async function main(): Promise<void> {
  const { executable } = smokeOptions(process.argv.slice(2));
  let result: SmokeResult;
  if (executable !== undefined) {
    result = await smokeTestApp({ executablePath: executable, args: [], env: {} });
  } else {
    const server = await serveRenderer(RENDERER_DIR);
    try {
      const launch = builtDesktopApp(DESKTOP_DIR, server.url);
      result = await smokeTestApp({
        ...launch,
        env: { ...launch.env, [DESKTOP_HIDDEN_ENV]: "1" },
      });
    } finally {
      await server.close();
    }
  }
  console.log(
    `Desktop smoke test passed: first answer after ${Math.round(result.firstAnswerMs)} ms (limit ${FIRST_ANSWER_LIMIT_MS} ms), ready again after the data process was killed.`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
